/** Ficha do lote de mudas: germinação, fases, perdas, medições e rastreio. */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { atrasado, bloqueioSaidaMudas, dataPrevistaPronta, entradaPorContagem, saldoMudas, taxaGerminacao } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CAMPO_DECIMAL, lerNumero, mostrarNumero } from '../../plataforma/numero';
import { nomesEspecies } from '../coleta/dados';
import { RECIPIENTES, ROTULO_FASE } from './dados';
import { BotaoExcluir } from '../../componentes/BotaoExcluir';
import { EditarRegistro } from '../../componentes/EditarRegistro';
import { FotosLote } from './FotosLote';
import { BotaoPdf } from '../../componentes/BotaoPdf';
import { etiquetasPdf } from '../../plataforma/pdfFichas';
import { linkRastreio } from '../../plataforma/rastreio';

type Acao = '' | 'contagem' | 'perda' | 'pronta' | 'medicao';
const CAUSAS = ['Seca', 'Praga ou formiga', 'Doença', 'Descarte', 'Outra'];
const ROTULO_EVENTO: Record<string, string> = {
  semeadura: 'Semeadura',
  contagem_germinacao: 'Contagem de germinação',
  repicagem: 'Repicagem',
  mudanca_fase: 'Ficou pronta para doação',
  medicao: 'Medição',
  perda: 'Perda',
  transferencia: 'Transferência',
};

export function DetalheLoteMudas() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo, pode } = useApp();
  const lote = useLiveQuery(() => db.colecao('lote_mudas').get(id!), [id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const especie = useLiveQuery(() => (lote ? db.colecao('especie').get(String(lote.especie_id)) : undefined), [lote?.especie_id]);
  const ls = useLiveQuery(() => (lote ? db.colecao('lote_sementes').get(String(lote.lote_sementes_id)) : undefined), [lote?.lote_sementes_id]);
  const movs = useLiveQuery(() => db.colecao('movimento_estoque_mudas').where('lote_mudas_id').equals(id!).toArray(), [id]) ?? [];
  const eventos = useLiveQuery(async () => (await db.colecao('evento_lote_mudas').where('lote_mudas_id').equals(id!).toArray()).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_no_aparelho_em).localeCompare(String(a.criado_no_aparelho_em))), [id]) ?? [];

  const [acao, setAcao] = useState<Acao>('');
  const [valor, setValor] = useState('');
  const [causa, setCausa] = useState(CAUSAS[0]);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [copias, setCopias] = useState('');

  if (!lote) return <Tela titulo="Lote de mudas">{null}</Tela>;
  const saldo = saldoMudas(movs as never);
  const germinadas = Math.max(0, ...eventos.filter((e) => e.tipo === 'contagem_germinacao').map((e) => Number(e.quantidade ?? 0)));
  const taxa = taxaGerminacao(lote.sementes_semeadas as number, germinadas);
  const previsao = dataPrevistaPronta(lote.data_semeadura as string, especie?.meses_ate_pronta as number);
  const faseAtual = String(lote.fase_atual ?? 'semeadura');
  const inicial = lote.origem === 'estoque_inicial';
  const podeCuidar = pode('producao', lote.viveiro_id);
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
    } else if (acao === 'pronta') {
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'mudanca_fase', fase_nova: 'pronta', quantidade: saldo });
      await repo.salvar('lote_mudas', { fase_atual: 'pronta' }, id);
    } else if (acao === 'medicao') {
      const cm = lerNumero(valor);
      if (!cm || cm <= 0) return setErro('Informe a altura média em centímetros.');
      await repo.salvar('evento_lote_mudas', { ...base, tipo: 'medicao', altura_media_cm: cm });
    }
    setAcao('');
    setValor('');
    setMsg('Registrado.');
  }

  const ACOES: { id: Acao; rotulo: string }[] = [
    ...(faseAtual !== 'pronta' ? [{ id: 'pronta' as Acao, rotulo: 'Marcar como pronta' }] : []),
    ...(!inicial && faseAtual !== 'pronta' ? [{ id: 'contagem' as Acao, rotulo: 'Contar germinação' }] : []),
    { id: 'perda', rotulo: 'Perda' },
    { id: 'medicao', rotulo: 'Medir' },
  ];

  return (
    <Tela titulo={`Lote de mudas ${String(lote.codigo)}`}>
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
      <section className="cartao formulario nao-imprimir" data-testid="etiquetas-lm">
        <h2>Etiquetas com QR para as mudas</h2>
        <p className="dica">Folha A4 com 24 etiquetas para recortar e fixar nas mudas. O QR abre a origem do lote em qualquer celular.</p>
        <label>
          Quantas etiquetas?
          <input type="number" inputMode="numeric" min="1" max="1000" value={copias} placeholder={String(Math.max(1, saldo))} onChange={(e) => setCopias(e.target.value)} />
        </label>
        <BotaoPdf
          className="botao-principal"
          rotulo="Imprimir etiquetas (PDF)"
          nome={`etiquetas-${String(lote.codigo)}.pdf`}
          gerar={async () => {
            const n = Math.min(1000, Math.max(1, Math.round(Number(copias) || saldo || 1)));
            const v = await db.colecao('viveiro').get(String(lote.viveiro_id));
            const nomesPop = (await db.colecao('nome_popular').where('especie_id').equals(String(lote.especie_id)).toArray()).filter((x) => !x.excluido);
            const etiqueta = {
              codigo: String(lote.codigo),
              nome: String(nomesPop[0]?.nome ?? especie?.nome_cientifico ?? ''),
              cientifico: String(especie?.nome_cientifico ?? ''),
              viveiro: v ? String(v.nome) : undefined,
              data: inicial ? 'Estoque inicial' : lote.data_semeadura ? `Semeado em ${new Date(String(lote.data_semeadura) + 'T12:00').toLocaleDateString('pt-BR')}` : undefined,
              qr: linkRastreio(String(lote.codigo)),
            };
            return etiquetasPdf(Array.from({ length: n }, () => etiqueta));
          }}
        />
      </section>
      <dl className="ficha" data-testid="resumo-lm">
        <dt>Situação</dt>
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

      {podeCuidar && <FotosLote loteId={lote.id} viveiroId={String(lote.viveiro_id ?? '')} />}

      {podeCuidar && (
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
            {acao === 'pronta' && <p>As {saldo} mudas deste lote vão ficar disponíveis para doação.</p>}
            {acao === 'medicao' && (
              <label>
                Altura média (cm)
                <input {...CAMPO_DECIMAL} value={valor} onChange={(e) => setValor(e.target.value)} />
              </label>
            )}
            {erro && <p className="erro">{erro}</p>}
            <button className="botao-principal">Registrar</button>
          </form>
        )}
      </section>
      )}

      <section className="cartao">
        <h2>Histórico</h2>
        <ul className="historico">
          {eventos.map((e) => (
            <li key={e.id}>
              {new Date(String(e.data) + 'T12:00').toLocaleDateString('pt-BR')}: {ROTULO_EVENTO[String(e.tipo)] ?? String(e.tipo)}
              {e.quantidade ? ` · ${String(e.quantidade)}` : ''}
              {e.causa ? ` · ${String(e.causa)}` : ''}
              {e.fase_nova && e.fase_nova !== 'pronta' ? ` → ${ROTULO_FASE[String(e.fase_nova)]}` : ''}
              {e.altura_media_cm ? ` · ${String(e.altura_media_cm).replace('.', ',')} cm` : ''}
            </li>
          ))}
        </ul>
      </section>
      <EditarRegistro
        colecao="lote_mudas"
        registro={lote}
        rotulo="Editar o lote de mudas"
        podeEditar={podeCuidar}
        campos={[
          { nome: 'especie_id', rotulo: 'Espécie', tipo: 'especie' },
          ...(inicial ? [] : [{ nome: 'data_semeadura', rotulo: 'Data da semeadura', tipo: 'data' as const }, { nome: 'sementes_semeadas', rotulo: 'Sementes semeadas', tipo: 'numero' as const }]),
          { nome: 'recipiente', rotulo: 'Recipiente', tipo: 'opcao', opcoes: RECIPIENTES },
          { nome: 'canteiro', rotulo: 'Canteiro', tipo: 'texto' },
          { nome: 'observacao_origem', rotulo: 'Observação', tipo: 'textoLongo' },
        ]}
        depois={
          <>
            <FotosLote loteId={lote.id} viveiroId={String(lote.viveiro_id ?? '')} editando />
            <p className="dica">A quantidade de mudas muda por perda ou inventário, e a fase pelos botões acima, para ficar no histórico.</p>
          </>
        }
      />
      <BotaoExcluir colecao="lote_mudas" registro={lote} voltarPara="/viveiro" />
    </Tela>
  );
}
