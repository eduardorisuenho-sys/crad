/** Lotes de sementes: lista e formação de lote a partir das coletas. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { emGramas, parametro, saldoSementes, situacaoValidade, verificarLote, type MatrizResumo, type Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { CAMPO_DECIMAL, lerNumero } from '../../plataforma/numero';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { coletasEmLote, nomesEspecies } from './dados';

export const ROTULO_VALIDADE: Record<string, string> = { vencido: 'vencido', vence_logo: 'vence logo', ok: '', sem_validade: '' };

export function ListaLotes() {
  const { repo, db, viveiroId, pode } = useApp();
  const lotes = useLiveQuery(async () => (await repo.listar('lote_sementes')).sort((a, b) => String(b.codigo).localeCompare(String(a.codigo))), [repo, viveiroId]) ?? [];
  const movs = useLiveQuery(() => repo.listar('movimento_sementes'), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const enderecos = useLiveQuery(async () => new Map((await repo.listar('endereco_armazenamento')).map((e) => [e.id, e])), [repo]);
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const aviso = parametro<number>(parametros, 'aviso_validade_sementes_dias', viveiroId);
  const hoje = new Date().toISOString();

  return (
    <Tela titulo="Lotes de sementes">
      {pode('lotes_sementes') && (
        <Link to="/coleta/lotes/novo" className="botao-principal">
          <Icone nome="mais" /> Formar lote
        </Link>
      )}
      <ul className="lista">
        {lotes.map((l) => {
          const saldo = saldoSementes(movs.filter((m) => m.lote_sementes_id === l.id) as never);
          const val = situacaoValidade(l.validade as string, hoje, aviso);
          return (
            <li key={l.id}>
              <Link to={`/coleta/lotes/${l.id}`} className="item-lista">
                <Icone nome="semente" />
                <div>
                  <strong>
                    {String(l.codigo)} · {nomes?.get(String(l.especie_id)) ?? ''}
                  </strong>
                  <small>
                    {saldo.g} g · {String(enderecos?.get(String(l.endereco_id))?.codigo ?? 'sem endereço')}
                  </small>
                </div>
                {ROTULO_VALIDADE[val] && <span className="selo">{ROTULO_VALIDADE[val]}</span>}
              </Link>
            </li>
          );
        })}
        {!lotes.length && <li className="vazio">Nenhum lote ainda.</li>}
      </ul>
    </Tela>
  );
}

type Etapa = 'especie' | 'coletas' | 'dados';

export function NovoLote() {
  const { repo, db, viveiroId } = useApp();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>('especie');
  const [especieId, setEspecieId] = useState<string>();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [dados, setDados] = useState({ peso_g: '', sementes: '', umidade: '', validade: '', endereco_id: '' });
  const [salvando, setSalvando] = useState(false);

  const coletas = useLiveQuery(() => repo.listar('coleta'), [repo]) ?? [];
  const matrizes = useLiveQuery(async () => new Map((await repo.listar('matriz')).map((m) => [m.id, m as unknown as MatrizResumo])), [repo]);
  const usadas = useLiveQuery(() => coletasEmLote(db), [db]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const enderecos = useLiveQuery(() => repo.listar('endereco_armazenamento', (e) => e.ativo !== false), [repo]) ?? [];
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const minMatrizes = parametro<number>(parametros, 'min_matrizes_por_lote', viveiroId);

  // Coletas livres (fora de lote), agrupadas por espécie da matriz.
  const livres = useMemo(() => coletas.filter((c) => !usadas?.has(c.id)), [coletas, usadas]);
  const porEspecie = useMemo(() => {
    const m = new Map<string, Registro[]>();
    for (const c of livres) {
      const e = String(matrizes?.get(String(c.matriz_id))?.especie_id ?? '');
      if (!e) continue;
      (m.get(e) ?? m.set(e, []).get(e)!).push(c);
    }
    return m;
  }, [livres, matrizes]);
  const daEspecie = especieId ? porEspecie.get(especieId) ?? [] : [];
  const escolhidas = daEspecie.filter((c) => marcadas.has(c.id));
  const verificacao = matrizes && usadas ? verificarLote(especieId, escolhidas as never, matrizes, usadas, minMatrizes) : null;
  const pesoColetado = escolhidas.reduce((s, c) => s + (emGramas(c.quantidade as number, c.unidade as string) ?? 0), 0);

  async function salvar() {
    setSalvando(true);
    const codigo = await repo.proximoCodigo('LS');
    const hoje = new Date().toISOString().slice(0, 10);
    const peso = lerNumero(dados.peso_g);
    const sementes = Number(dados.sementes) || null;
    const lote = await repo.salvar('lote_sementes', {
      codigo,
      especie_id: especieId,
      data_formacao: hoje,
      peso_g: peso,
      sementes_estimadas: sementes,
      umidade_pct: lerNumero(dados.umidade),
      validade: dados.validade || null,
      endereco_id: dados.endereco_id || null,
      situacao: 'armazenado',
    });
    for (const c of escolhidas) await repo.salvar('lote_sementes_coleta', { lote_sementes_id: lote.id, coleta_id: c.id, quantidade: c.quantidade ?? null });
    await repo.salvar('movimento_sementes', { lote_sementes_id: lote.id, tipo: 'entrada', quantidade_g: peso, quantidade_unid: sementes, data: hoje, endereco_id: dados.endereco_id || null });
    navegar(`/coleta/lotes/${lote.id}?novo=1`, { replace: true });
  }

  return (
    <Tela titulo="Formar lote de sementes">
      {etapa === 'especie' && (
        <div className="assistente">
          <h2 className="pergunta">De qual espécie?</h2>
          <ul className="lista">
            {[...porEspecie.entries()].map(([id, cs]) => (
              <li key={id}>
                <button
                  className="item-lista botao-lista"
                  onClick={() => {
                    setEspecieId(id);
                    setMarcadas(new Set(cs.map((c) => c.id)));
                    setEtapa('coletas');
                  }}
                >
                  <Icone nome="semente" />
                  <div>
                    <strong>{nomes?.get(id) ?? id}</strong>
                    <small>{cs.length} coleta(s) fora de lote</small>
                  </div>
                </button>
              </li>
            ))}
            {!porEspecie.size && <li className="vazio">Não há coletas fora de lote.</li>}
          </ul>
        </div>
      )}

      {etapa === 'coletas' && (
        <div className="assistente">
          <h2 className="pergunta">Quais coletas entram no lote?</h2>
          <ul className="lista">
            {daEspecie.map((c) => {
              const m = matrizes?.get(String(c.matriz_id));
              return (
                <li key={c.id} className="item-lista candidata">
                  <input
                    type="checkbox"
                    aria-label={`Coleta da matriz ${m?.codigo}`}
                    checked={marcadas.has(c.id)}
                    onChange={() => {
                      const n = new Set(marcadas);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      setMarcadas(n);
                    }}
                  />
                  <div>
                    <strong>{String(m?.codigo ?? '')}</strong>
                    <small>
                      {new Date(String(c.data)).toLocaleDateString('pt-BR')} · {String(c.quantidade ?? '')} {String(c.unidade ?? '')}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
          {verificacao?.bloqueios.map((b) => (
            <p key={b} className="erro">
              {b}
            </p>
          ))}
          {verificacao?.alertas.map((a) => (
            <p key={a} className="mensagem alerta">
              <Icone nome="aviso" tamanho={20} /> {a}
            </p>
          ))}
          <button className="botao-principal" disabled={!verificacao || verificacao.bloqueios.length > 0} onClick={() => setEtapa('dados')}>
            Continuar ({verificacao?.matrizes ?? 0} matrizes)
          </button>
          <button className="botao-secundario" onClick={() => setEtapa('especie')}>
            <Icone nome="voltar" /> Voltar
          </button>
        </div>
      )}

      {etapa === 'dados' && (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <h2 className="pergunta">Sementes limpas</h2>
          {pesoColetado > 0 && <p className="dica">Coletado: {pesoColetado} g de material.</p>}
          <label>
            Peso das sementes limpas (gramas)
            <input {...CAMPO_DECIMAL} required value={dados.peso_g} onChange={(e) => setDados({ ...dados, peso_g: e.target.value })} />
          </label>
          <label>
            Número de sementes (estimado, opcional)
            <input type="number" inputMode="numeric" min="0" value={dados.sementes} onChange={(e) => setDados({ ...dados, sementes: e.target.value })} />
          </label>
          <label>
            Umidade % (opcional)
            <input {...CAMPO_DECIMAL} value={dados.umidade} onChange={(e) => setDados({ ...dados, umidade: e.target.value })} />
          </label>
          <label>
            Validade (opcional)
            <input type="date" value={dados.validade} onChange={(e) => setDados({ ...dados, validade: e.target.value })} />
          </label>
          <label>
            Onde vai ficar guardado
            <select value={dados.endereco_id} onChange={(e) => setDados({ ...dados, endereco_id: e.target.value })}>
              <option value="">— escolher depois —</option>
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>
                  {String(e.codigo)}
                </option>
              ))}
            </select>
          </label>
          <button className="botao-principal" disabled={salvando}>
            <Icone nome="certo" /> Criar lote
          </button>
          <button type="button" className="botao-secundario" onClick={() => setEtapa('coletas')}>
            <Icone nome="voltar" /> Voltar
          </button>
        </form>
      )}
    </Tela>
  );
}
