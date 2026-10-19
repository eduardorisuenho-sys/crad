/**
 * Corrigir cadastros (administrador): excluir o que foi preenchido errado
 * (vai para a lixeira, funciona sem internet) e, na lixeira, restaurar ou
 * apagar de vez (com internet).
 */
import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { COLECOES_LIXEIRA, normalizarBusca, rotuloRegistro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { ordemParaApagar } from '@crads/dominio';
import { apagarDeVez, lerLixeira, restaurar, type ItemLixeira } from './api';
import { bloqueioExclusao } from '../../componentes/BotaoExcluir';

export function Lixeira() {
  const { db, repo, sessao, online, sincronizar } = useApp();
  const [aba, setAba] = useState<'excluir' | 'lixeira'>('excluir');
  const [tipo, setTipo] = useState('matriz');
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState<ItemLixeira[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // vários de uma vez: ids marcados (na lixeira, "colecao:id")
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  useEffect(() => setMarcados(new Set()), [aba, tipo]);
  const alternar = (k: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const registros = useLiveQuery(async () => (await db.colecao(tipo).toArray()).filter((r) => !r.excluido).map((r) => ({ id: r.id, rotulo: rotuloRegistro(tipo, r) })), [db, tipo]) ?? [];
  const lista = registros.filter((r) => !busca || normalizarBusca(r.rotulo).includes(normalizarBusca(busca))).slice(0, 100);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    try {
      setItens((await lerLixeira(sessao)).itens);
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [sessao]);
  useEffect(() => {
    if (aba === 'lixeira') void carregar();
  }, [aba, carregar, online]);

  if (!sessao?.gestorGeral) return <Tela titulo="Lixeira"><p className="vazio">Só o administrador usa a lixeira.</p></Tela>;

  /** Exclui os cadastros marcados; os que têm algo ativo ligado ficam e o motivo aparece. */
  async function excluirMarcados() {
    const alvo = lista.filter((r) => marcados.has(r.id));
    if (!alvo.length || !confirm(`Excluir ${alvo.length} cadastro(s)? Eles vão para a lixeira.`)) return;
    setOcupado(true);
    setErro('');
    const ficaram: string[] = [];
    let feitos = 0;
    for (const r of alvo) {
      const b = await bloqueioExclusao(db, tipo, r.id);
      if (b) {
        ficaram.push(`${r.rotulo}: ${b}`);
        continue;
      }
      await repo.excluir(tipo, r.id);
      feitos++;
    }
    setMarcados(new Set());
    setOcupado(false);
    setMsg(`${feitos} cadastro(s) foram para a lixeira.`);
    if (ficaram.length) setErro(`Não excluídos: ${ficaram.join(' · ')}`);
  }

  /** Restaura ou apaga de vez os itens marcados da lixeira, um por um. */
  async function naLixeira(acao: 'restaurar' | 'apagar') {
    // pedidos antes dos lotes, lotes antes das espécies: o que aponta para os outros sai primeiro
    const alvo = (itens ?? []).filter((i) => marcados.has(`${i.colecao}:${i.id}`)).sort((a, b) => ordemParaApagar(a.colecao) - ordemParaApagar(b.colecao));
    if (!alvo.length) return;
    if (acao === 'apagar' && !confirm(`Apagar ${alvo.length} item(ns) de vez? Não dá para desfazer.`)) return;
    setOcupado(true);
    setErro('');
    const falhas: string[] = [];
    let feitos = 0;
    for (const i of alvo) {
      try {
        await (acao === 'restaurar' ? restaurar(sessao!, i.colecao, i.id) : apagarDeVez(sessao!, i.colecao, i.id));
        feitos++;
      } catch (e) {
        falhas.push(`${i.rotulo}: ${(e as Error).message}`);
      }
    }
    setMarcados(new Set());
    setMsg(acao === 'restaurar' ? `${feitos} item(ns) voltaram.` : `${feitos} item(ns) apagados de vez.`);
    if (falhas.length) setErro(`Não deu certo: ${falhas.join(' · ')}`);
    await carregar();
    void sincronizar();
    setOcupado(false);
  }

  async function fazer(acao: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setErro('');
    setMsg('');
    try {
      await acao();
      setMsg(ok);
      await carregar();
      void sincronizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tela titulo="Corrigir cadastros">
      <div className="filtros" role="group" aria-label="Aba">
        <button className={`chip ${aba === 'excluir' ? 'ativo' : ''}`} onClick={() => setAba('excluir')}>
          Excluir cadastros
        </button>
        <button className={`chip ${aba === 'lixeira' ? 'ativo' : ''}`} onClick={() => setAba('lixeira')}>
          Lixeira
        </button>
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {msg && <p className="mensagem">{msg}</p>}

      {aba === 'excluir' && (
        <>
          <p className="dica">O que for excluído vai para a lixeira: some de todos os aparelhos e pode voltar.</p>
          <div className="filtros" role="group" aria-label="Tipo de cadastro">
            {COLECOES_LIXEIRA.map((c) => (
              <button key={c.nome} className={`chip ${tipo === c.nome ? 'ativo' : ''}`} onClick={() => setTipo(c.nome)}>
                {c.rotulo}
              </button>
            ))}
          </div>
          <input className="campo-busca" type="search" placeholder="Procurar pelo código ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar cadastro" />
          {lista.length > 0 && (
            <div className="acoes-lote">
              <label className="linha-check">
                <input type="checkbox" checked={lista.every((r) => marcados.has(r.id))} onChange={(e) => setMarcados(e.target.checked ? new Set(lista.map((r) => r.id)) : new Set())} /> Selecionar todos ({lista.length})
              </label>
              <button className="botao-principal perigo" disabled={!marcados.size || ocupado} onClick={() => void excluirMarcados()}>
                <Icone nome="lixo" /> Excluir selecionados ({marcados.size})
              </button>
            </div>
          )}
          <ul className="lista" data-testid="cadastros">
            {lista.map((r) => (
              <li key={r.id} className="item-lista">
                <input type="checkbox" aria-label={`Selecionar ${r.rotulo}`} checked={marcados.has(r.id)} onChange={() => alternar(r.id)} />
                <div>
                  <strong>{r.rotulo}</strong>
                </div>
                <button
                  className="botao-mini"
                  onClick={() => {
                    if (!confirm(`Excluir ${r.rotulo}? Ele vai para a lixeira.`)) return;
                    void repo.excluir(tipo, r.id).then(
                      () => setMsg(`${r.rotulo} foi para a lixeira.`),
                      (e) => setErro((e as Error).message),
                    );
                  }}
                >
                  Excluir
                </button>
              </li>
            ))}
            {!lista.length && <li className="vazio">Nada encontrado.</li>}
          </ul>
        </>
      )}

      {aba === 'lixeira' && (
        <>
          <p className="dica">
            <b>Restaurar</b> traz o cadastro de volta. <b>Apagar de vez</b> não tem volta: o registro e seus detalhes (fotos, flor e fruto, itens) somem; fica só a anotação de quem apagou e quando.
          </p>
          {!itens && !erro && <p className="vazio">Carregando…</p>}
          {(itens ?? []).length > 0 && (
            <div className="acoes-lote">
              <label className="linha-check">
                <input
                  type="checkbox"
                  checked={(itens ?? []).every((i) => marcados.has(`${i.colecao}:${i.id}`))}
                  onChange={(e) => setMarcados(e.target.checked ? new Set((itens ?? []).map((i) => `${i.colecao}:${i.id}`)) : new Set())}
                />{' '}
                Selecionar todos ({itens!.length})
              </label>
              <div className="acoes">
                <button className="botao-secundario" disabled={!marcados.size || ocupado} onClick={() => void naLixeira('restaurar')}>
                  <Icone nome="voltar" /> Restaurar selecionados ({marcados.size})
                </button>
                <button className="botao-secundario perigo" disabled={!marcados.size || ocupado} onClick={() => void naLixeira('apagar')}>
                  Apagar de vez selecionados ({marcados.size})
                </button>
              </div>
            </div>
          )}
          <ul className="lista" data-testid="lixeira">
            {(itens ?? []).map((i) => (
              <li key={`${i.colecao}-${i.id}`} className="pedido-acesso">
                <input type="checkbox" aria-label={`Selecionar ${i.rotulo}`} checked={marcados.has(`${i.colecao}:${i.id}`)} onChange={() => alternar(`${i.colecao}:${i.id}`)} />
                <div>
                  <strong>{i.rotulo}</strong>
                  <small>
                    {i.tipo} · excluído em {new Date(i.excluido_em.replace(' ', 'T')).toLocaleDateString('pt-BR')}
                    {i.por ? ` por ${i.por}` : ''}
                  </small>
                </div>
                <div className="acoes">
                  <button className="botao-secundario" disabled={ocupado} onClick={() => void fazer(() => restaurar(sessao, i.colecao, i.id), `${i.rotulo} voltou.`)}>
                    <Icone nome="voltar" /> Restaurar
                  </button>
                  <button
                    className="botao-secundario perigo"
                    disabled={ocupado}
                    onClick={() => confirm(`Apagar ${i.rotulo} de vez? Não dá para desfazer.`) && void fazer(() => apagarDeVez(sessao, i.colecao, i.id), `${i.rotulo} foi apagado de vez.`)}
                  >
                    Apagar de vez
                  </button>
                </div>
              </li>
            ))}
            {itens && !itens.length && <li className="vazio">A lixeira está vazia.</li>}
          </ul>
        </>
      )}
    </Tela>
  );
}
