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
import { apagarDeVez, lerLixeira, restaurar, type ItemLixeira } from './api';

export function Lixeira() {
  const { db, repo, sessao, online, sincronizar } = useApp();
  const [aba, setAba] = useState<'excluir' | 'lixeira'>('excluir');
  const [tipo, setTipo] = useState('matriz');
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [itens, setItens] = useState<ItemLixeira[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

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
          Excluir um cadastro
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
          <p className="dica">O que for excluído vai para a lixeira: some de todos os aparelhos e pode voltar. Matrizes reprovadas já vão para a lixeira sozinhas.</p>
          <div className="filtros" role="group" aria-label="Tipo de cadastro">
            {COLECOES_LIXEIRA.map((c) => (
              <button key={c.nome} className={`chip ${tipo === c.nome ? 'ativo' : ''}`} onClick={() => setTipo(c.nome)}>
                {c.rotulo}
              </button>
            ))}
          </div>
          <input className="campo-busca" type="search" placeholder="Procurar pelo código ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar cadastro" />
          <ul className="lista" data-testid="cadastros">
            {lista.map((r) => (
              <li key={r.id} className="item-lista">
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
          <ul className="lista" data-testid="lixeira">
            {(itens ?? []).map((i) => (
              <li key={`${i.colecao}-${i.id}`} className="pedido-acesso">
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
