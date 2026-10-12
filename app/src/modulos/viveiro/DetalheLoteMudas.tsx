/** Ficha do lote de mudas: germinação, fases, perdas, medições e rastreio. */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { atrasado, bloqueioMudancaFase, bloqueioSaidaMudas, dataPrevistaPronta, entradaPorContagem, proximasFases, saldoMudas, taxaGerminacao } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CAMPO_DECIMAL, lerNumero, mostrarNumero } from '../../plataforma/numero';
import { nomesEspecies } from '../coleta/dados';
import { RECIPIENTES, ROTULO_FASE } from './dados';

type Acao = '' | 'contagem' | 'perda' | 'fase' | 'medicao' | 'repicagem';
const CAUSAS = ['Seca', 'Praga ou formiga', 'Doença', 'Descarte', 'Outra'];
const ROTULO_EVENTO: Record<string, string> = {
  semeadura: 'Semeadura',
  contagem_germinacao: 'Contagem de germinação',
  repicagem: 'Repicagem',
  mudanca_fase: 'Mudança de fase',
  medicao: 'Medição',
  perda: 'Perda',
  transferencia: 'Transferência',
};

export function DetalheLoteMudas() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo } = useApp();
  const lote = useLiveQuery(() => db.colecao('lote_mudas').get(id!), [id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const especie = useLiveQuery(() => (lote ? db.colecao('especie').get(String(lote.especie_id)) : undefined), [lote?.especie_id]);
  const ls = useLiveQuery(() => (lote ? db.colecao('lote_sementes').get(String(lote.lote_sementes_id)) : undefined), [lote?.lote_sementes_id]);
  const movs = useLiveQuery(() => db.colecao('movimento_estoque_mudas').where('lote_mudas_id').equals(id!).toArray(), [id]) ?? [];
  const eventos = useLiveQuery(async () => (await db.colecao('evento_lote_mudas').where('lote_mudas_id').equals(id!).toArray()).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_no_aparelho_em).localeCompare(String(a.criado_no_aparelho_em))), [id]) ?? [];

  const [acao, setAcao] = useState<Acao>('');
  const [valor, setValor] = useState('');
  const [causa, setCausa] = useState(CAUSAS[0]);
  const [fase, setFase] = useState('');
  const [recipiente, setRecipiente] = useState('tubete');
  const [canteiro, setCanteiro] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  if (!lote) return <Tela titulo="Lote de mudas">{null}</Tela>;
  const saldo = saldoMudas(movs as never);
  const germinadas = Math.max(0, ...eventos.filter((e) => e.tipo === 'contagem_germinacao').map((e) => Number(e.quantidade ?? 0)));
  const taxa = taxaGerminacao(lote.sementes_semeadas as number, germinadas);
  const previsao = dataPrevistaPronta(lote.data_semeadura as string, especie?.meses_ate_pronta as number);
  const faseAtual = String(lote.fase_atual ?? 'semeadura');
  const inicial = lote.origem === 'estoque_inicial';
  const hoje = new Date().toISOString().slice(0, 10);
  const base = { lote_mudas_id: id, data: hoje, viveiro_id: lote.viveiro_id };

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (acao === 'contagem') {
      const r = entradaPorContagem(lote!.sementes_semeadas as number, germinadas, lerNumero(valor) ?? -1);
      if ('erro' in r) return setErro(r.erro);
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'contagem_germinacao', quantidade: lerNumero(valor) });
      if (r.entrada) await repo.salvar('movimento_estoque_mudas', { ...base, tipo: 'entrada', quantidade: r.entrada, referencia: 'germinação' });
      if (faseAtual === 'semeadura') await repo.salvar('lote_mudas', { fase_atual: 'germinacao' }, id);
    } else if (acao === 'perda') {
      const q = lerNumero(valor) ?? 0;
      const b = bloqueioSaidaMudas(saldo, q);
      if (b) return setErro(b);
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'perda', quantidade: q, causa });
      await repo.salvar('movimento_estoque_mudas', { ...base, tipo: 'perda', quantidade: q, referencia: causa });
    } else if (acao === 'fase') {
      const b = bloqueioMudancaFase(faseAtual, fase);
      if (b) return setErro(b);
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'mudanca_fase', fase_nova: fase, quantidade: saldo });
      await repo.salvar('lote_mudas', { fase_atual: fase }, id);
    } else if (acao === 'medicao') {
      const cm = lerNumero(valor);
      if (!cm || cm <= 0) return setErro('Informe a altura média em centímetros.');
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'medicao', altura_media_cm: cm });
    } else if (acao === 'repicagem') {
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'repicagem', quantidade: saldo, observacao: `${recipiente}${canteiro ? `, canteiro ${canteiro}` : ''}` });
      await repo.salvar('lote_mudas', { recipiente, canteiro: canteiro || lote!.canteiro || null, ...(faseAtual === 'semeadura' || faseAtual === 'germinacao' ? { fase_atual: 'repicagem' } : {}) }, id);
    }
    setAcao('');
    setValor('');
    setMsg('Registrado.');
  }

  const ACOES: { id: Acao; rotulo: string }[] = [
    { id: 'contagem', rotulo: 'Contar germinação' },
    { id: 'perda', rotulo: 'Perda' },
    { id: 'fase', rotulo: 'Mudar de fase' },
    { id: 'medicao', rotulo: 'Medir' },
    { id: 'repicagem', rotulo: 'Repicagem' },
  ];

  return (
    <Tela titulo={`Lote ${String(lote.codigo)}`}>
      {params.get('novo') && <p className="mensagem">Lote de mudas {String(lote.codigo)} criado.</p>}
      {msg && <p className="mensagem">{msg}</p>}
      <section className="plaqueta" data-testid="etiqueta-lm">
        <CodigoQr texto={String(lote.codigo)} tamanho={110} />
        <div>
          <strong className="codigo-grande">{String(lote.codigo)}</strong>
          <span>{nomes?.get(String(lote.especie_id)) ?? ''}</span>
          {inicial ? <small>Estoque inicial (já estava no viveiro)</small> : <small>Semeado em {new Date(String(lote.data_semeadura) + 'T12:00').toLocaleDateString('pt-BR')}</small>}
        </div>
      </section>
      <dl className="ficha" data-testid="resumo-lm">
        <dt>Fase</dt>
        <dd>
          {ROTULO_FASE[faseAtual]}
          {atrasado(previsao, faseAtual, hoje) ? ' (atrasado)' : ''}
        </dd>
        <dt>Mudas no lote</dt>
        <dd data-testid="saldo-mudas">{saldo}</dd>
        {!inicial && (
          <>
            <dt>Germinação</dt>
            <dd data-testid="germinacao">
              {germinadas} de {String(lote.sementes_semeadas ?? '?')}
              {taxa !== null ? ` (${mostrarNumero(taxa)}%)` : ''}
            </dd>
          </>
        )}
        {previsao && (
          <>
            <dt>Previsão de ficar pronta</dt>
            <dd>{new Date(previsao + 'T12:00').toLocaleDateString('pt-BR')}</dd>
          </>
        )}
        <dt>Recipiente</dt>
        <dd>
          {RECIPIENTES.find((r) => r.valor === lote.recipiente)?.rotulo ?? '—'}
          {lote.canteiro ? ` · canteiro ${String(lote.canteiro)}` : ''}
        </dd>
        <dt>Origem</dt>
        <dd data-testid="origem-lm">{inicial ? String(lote.observacao_origem || 'Estoque inicial: origem das sementes não registrada.') : ls ? <Link to={`/coleta/lotes/${ls.id}`}>{String(ls.codigo)}</Link> : '—'}</dd>
      </dl>

      <section className="cartao nao-imprimir">
        <h2>Registrar</h2>
        <div className="meses">
          {ACOES.map((a) => (
            <button key={a.id} type="button" className={`chip ${acao === a.id ? 'ativo' : ''}`} onClick={() => setAcao(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        {acao && (
          <form className="formulario" onSubmit={registrar} style={{ marginTop: 12 }}>
            {acao === 'contagem' && (
              <label>
                Total de plântulas nascidas até hoje
                <input type="number" inputMode="numeric" min="0" step="1" value={valor} onChange={(e) => setValor(e.target.value)} />
              </label>
            )}
            {acao === 'perda' && (
              <>
                <label>
                  Quantas mudas morreram ou foram descartadas
                  <input type="number" inputMode="numeric" min="1" step="1" value={valor} onChange={(e) => setValor(e.target.value)} />
                </label>
                <div className="meses">
                  {CAUSAS.map((c) => (
                    <button key={c} type="button" className={`chip ${causa === c ? 'ativo' : ''}`} onClick={() => setCausa(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
            {acao === 'fase' && (
              <div className="meses">
                {proximasFases(faseAtual).map((f) => (
                  <button key={f} type="button" className={`chip ${fase === f ? 'ativo' : ''}`} onClick={() => setFase(f)}>
                    {ROTULO_FASE[f]}
                  </button>
                ))}
              </div>
            )}
            {acao === 'medicao' && (
              <label>
                Altura média (cm)
                <input {...CAMPO_DECIMAL} value={valor} onChange={(e) => setValor(e.target.value)} />
              </label>
            )}
            {acao === 'repicagem' && (
              <>
                <div className="meses">
                  {RECIPIENTES.map((r) => (
                    <button key={r.valor} type="button" className={`chip ${recipiente === r.valor ? 'ativo' : ''}`} onClick={() => setRecipiente(r.valor)}>
                      {r.rotulo}
                    </button>
                  ))}
                </div>
                <label>
                  Novo canteiro (opcional)
                  <input value={canteiro} onChange={(e) => setCanteiro(e.target.value)} />
                </label>
              </>
            )}
            {erro && <p className="erro">{erro}</p>}
            <button className="botao-principal">Registrar</button>
          </form>
        )}
      </section>

      <section className="cartao">
        <h2>Histórico</h2>
        <ul className="historico">
          {eventos.map((e) => (
            <li key={e.id}>
              {new Date(String(e.data) + 'T12:00').toLocaleDateString('pt-BR')}: {ROTULO_EVENTO[String(e.tipo)] ?? String(e.tipo)}
              {e.quantidade ? ` · ${String(e.quantidade)}` : ''}
              {e.causa ? ` · ${String(e.causa)}` : ''}
              {e.fase_nova ? ` → ${ROTULO_FASE[String(e.fase_nova)]}` : ''}
              {e.altura_media_cm ? ` · ${String(e.altura_media_cm).replace('.', ',')} cm` : ''}
            </li>
          ))}
        </ul>
      </section>
    </Tela>
  );
}
