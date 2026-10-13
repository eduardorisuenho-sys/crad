/** Ficha do lote de sementes: etiqueta com QR, origem (matrizes), saldo e movimentos. */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { bloqueioSaida, parametro, saldoSementes, situacaoValidade } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { CAMPO_DECIMAL, lerNumero, mostrarNumero } from '../../plataforma/numero';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from './dados';
import { ROTULO_VALIDADE } from './Lotes';
import { BotaoExcluir } from '../../componentes/BotaoExcluir';

const TIPOS = [
  { valor: 'teste', rotulo: 'Teste de germinação', saida: true },
  { valor: 'descarte', rotulo: 'Descarte', saida: true },
  { valor: 'ajuste', rotulo: 'Ajuste de peso', saida: false },
  { valor: 'mudanca_endereco', rotulo: 'Mudar de lugar', saida: false },
];
const ROTULO_MOV: Record<string, string> = { entrada: 'Entrada', semeadura: 'Semeadura', teste: 'Teste de germinação', descarte: 'Descarte', ajuste: 'Ajuste', mudanca_endereco: 'Mudou de lugar' };

export function DetalheLote() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo, viveiroId } = useApp();
  const lote = useLiveQuery(() => db.colecao('lote_sementes').get(id!), [id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const movs = useLiveQuery(async () => (await db.colecao('movimento_sementes').where('lote_sementes_id').equals(id!).toArray()).sort((a, b) => String(b.data).localeCompare(String(a.data))), [id]) ?? [];
  const origem = useLiveQuery(async () => {
    const ligs = (await db.colecao('lote_sementes_coleta').where('lote_sementes_id').equals(id!).toArray()).filter((l) => !l.excluido);
    const coletas = await db.colecao('coleta').bulkGet(ligs.map((l) => String(l.coleta_id)));
    const comMatriz = coletas.filter((c) => c && !c.excluido && c.matriz_id);
    const matrizes = await db.colecao('matriz').bulkGet(comMatriz.map((c) => String(c!.matriz_id)));
    const unicas = new Map<string, { id: string; codigo: string; coletas: number }>();
    matrizes.forEach((m) => {
      if (!m) return;
      const u = unicas.get(m.id) ?? { id: m.id, codigo: String(m.codigo), coletas: 0 };
      u.coletas++;
      unicas.set(m.id, u);
    });
    const semMatriz = coletas.filter((c) => c && !c.excluido && !c.matriz_id).length;
    return semMatriz ? [...unicas.values(), { id: '', codigo: 'Árvore sem matriz', coletas: semMatriz }] : [...unicas.values()];
  }, [id]);
  const enderecos = useLiveQuery(() => repo.listar('endereco_armazenamento', (e) => e.ativo !== false), [repo]) ?? [];
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];

  const [tipo, setTipo] = useState('');
  const [g, setG] = useState('');
  const [unid, setUnid] = useState('');
  const [pct, setPct] = useState('');
  const [endereco, setEndereco] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  if (!lote) return <Tela titulo="Lote de sementes">{null}</Tela>;
  const saldo = saldoSementes(movs as never);
  const enderecoAtual = enderecos.find((e) => e.id === lote.endereco_id);
  const val = situacaoValidade(lote.validade as string, new Date().toISOString(), parametro<number>(parametros, 'aviso_validade_sementes_dias', viveiroId));
  const especie = nomes?.get(String(lote.especie_id)) ?? '';

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const def = TIPOS.find((t) => t.valor === tipo)!;
    const qg = lerNumero(g);
    const qu = unid === '' ? null : Number(unid);
    if (def.saida) {
      const b = bloqueioSaida(saldo, { g: qg, unid: qu });
      if (b) return setErro(b);
    }
    if (tipo === 'mudanca_endereco' && !endereco) return setErro('Escolha o novo lugar.');
    await repo.salvar('movimento_sementes', {
      lote_sementes_id: id,
      tipo,
      quantidade_g: tipo === 'mudanca_endereco' ? null : qg,
      quantidade_unid: tipo === 'mudanca_endereco' ? null : qu,
      data: new Date().toISOString().slice(0, 10),
      endereco_id: tipo === 'mudanca_endereco' ? endereco : null,
      viveiro_id: lote!.viveiro_id,
    });
    const mudancas: Record<string, unknown> = {};
    if (tipo === 'mudanca_endereco') mudancas.endereco_id = endereco;
    if (tipo === 'teste' && pct) mudancas.germinacao_teste_pct = lerNumero(pct);
    if (Object.keys(mudancas).length) await repo.salvar('lote_sementes', mudancas, id);
    setTipo('');
    setG('');
    setUnid('');
    setPct('');
    setMsg('Registrado.');
  }

  return (
    <Tela titulo={`Lote ${String(lote.codigo)}`}>
      {params.get('novo') && <p className="mensagem">Lote {String(lote.codigo)} criado. Imprima a etiqueta para o saco ou pote.</p>}
      {msg && <p className="mensagem">{msg}</p>}
      <section className="plaqueta" data-testid="etiqueta">
        <CodigoQr texto={String(lote.codigo)} tamanho={130} />
        <div>
          <strong className="codigo-grande">{String(lote.codigo)}</strong>
          <span>{especie}</span>
          <small>Formado em {new Date(String(lote.data_formacao) + 'T12:00').toLocaleDateString('pt-BR')}</small>
          <small>{lote.origem === 'estoque_inicial' ? 'Sementes que já estavam no viveiro' : `${origem?.filter((m) => m.id).length ?? 0} matriz(es)`}</small>
          <small>{String(enderecoAtual?.codigo ?? 'sem endereço')}</small>
        </div>
      </section>
      <button className="botao-secundario nao-imprimir" onClick={() => window.print()}>
        Imprimir etiqueta
      </button>

      {saldo.g > 0 && (
        <Link to={`/viveiro/semeadura?ls=${id}`} className="botao-principal nao-imprimir">
          <Icone nome="muda" /> Semear deste lote
        </Link>
      )}

      <dl className="ficha nao-imprimir">
        <dt>Saldo</dt>
        <dd data-testid="saldo">
          {saldo.g} g{saldo.unid ? ` · ${saldo.unid} sementes` : ''}
        </dd>
        <dt>Onde está</dt>
        <dd>{String(enderecoAtual?.codigo ?? 'sem endereço')}</dd>
        {lote.validade ? (
          <>
            <dt>Validade</dt>
            <dd>
              {new Date(String(lote.validade) + 'T12:00').toLocaleDateString('pt-BR')} {ROTULO_VALIDADE[val] && `(${ROTULO_VALIDADE[val]})`}
            </dd>
          </>
        ) : null}
        {lote.germinacao_teste_pct ? (
          <>
            <dt>Teste de germinação</dt>
            <dd>{mostrarNumero(lote.germinacao_teste_pct)}%</dd>
          </>
        ) : null}
      </dl>

      <section className="cartao nao-imprimir" data-testid="origem-ls">
        <h2>Origem das sementes</h2>
        {lote.origem === 'estoque_inicial' && <p>{String(lote.observacao_origem || 'Sementes que já estavam no viveiro antes do app (matrizes não registradas).')}</p>}
        <ul className="lista">
          {origem?.map((m) =>
            m.id ? (
              <li key={m.id}>
                <Link to={`/matrizes/${m.id}`} className="item-lista">
                  <Icone nome="arvore" />
                  <div>
                    <strong>{m.codigo}</strong>
                    <small>{m.coletas} coleta(s)</small>
                  </div>
                </Link>
              </li>
            ) : (
              <li key="sem-matriz" className="item-lista">
                <Icone nome="semente" />
                <div>
                  <strong>{m.codigo}</strong>
                  <small>{m.coletas} coleta(s)</small>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="cartao nao-imprimir">
        <h2>Registrar</h2>
        <div className="meses">
          {TIPOS.map((t) => (
            <button key={t.valor} type="button" className={`chip ${tipo === t.valor ? 'ativo' : ''}`} onClick={() => setTipo(t.valor)}>
              {t.rotulo}
            </button>
          ))}
        </div>
        {tipo && (
          <form className="formulario" onSubmit={registrar} style={{ marginTop: 12 }}>
            {tipo === 'mudanca_endereco' ? (
              <label>
                Novo lugar
                <select value={endereco} onChange={(e) => setEndereco(e.target.value)}>
                  <option value="">—</option>
                  {enderecos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {String(e.codigo)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  {tipo === 'ajuste' ? 'Diferença em gramas (use − para tirar)' : 'Gramas'}
                  <input {...CAMPO_DECIMAL} value={g} onChange={(e) => setG(e.target.value)} />
                </label>
                <label>
                  Número de sementes (opcional)
                  <input type="number" inputMode="numeric" step="1" value={unid} onChange={(e) => setUnid(e.target.value)} />
                </label>
                {tipo === 'teste' && (
                  <label>
                    Resultado do teste: % que germinou (opcional)
                    <input {...CAMPO_DECIMAL} value={pct} onChange={(e) => setPct(e.target.value)} />
                  </label>
                )}
              </>
            )}
            {erro && <p className="erro">{erro}</p>}
            <button className="botao-principal">Registrar</button>
          </form>
        )}
      </section>

      <section className="cartao nao-imprimir">
        <h2>Histórico</h2>
        <ul className="historico">
          {movs.map((m) => (
            <li key={m.id}>
              {new Date(String(m.data) + 'T12:00').toLocaleDateString('pt-BR')}: {ROTULO_MOV[String(m.tipo)] ?? String(m.tipo)}
              {m.quantidade_g ? ` · ${String(m.quantidade_g)} g` : ''}
              {m.quantidade_unid ? ` · ${String(m.quantidade_unid)} sementes` : ''}
            </li>
          ))}
        </ul>
      </section>
      <BotaoExcluir colecao="lote_sementes" registro={lote} voltarPara="/coleta/lotes" />
    </Tela>
  );
}
