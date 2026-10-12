/**
 * Tabela de permissões: cada linha é uma coisa do app, cada coluna um perfil.
 * Só o administrador muda; os outros veem para saber quem faz o quê.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { celulaEditavel, FUNCIONALIDADES, GRUPOS_PERMISSAO, matrizPadrao, normalizarMatriz, PERFIS_PERMISSAO, type MatrizPermissoes, type Perfil } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';

function useTelaEstreita() {
  const consulta = '(max-width: 699px)';
  const [estreita, setEstreita] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(consulta).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia(consulta);
    const aoMudar = () => setEstreita(m.matches);
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  }, []);
  return estreita;
}

export function Permissoes() {
  const { db, repo, sessao, matriz } = useApp();
  const admin = !!sessao?.gestorGeral;
  const [rascunho, setRascunho] = useState<MatrizPermissoes>(matriz);
  const [msg, setMsg] = useState('');
  // No celular, um perfil por vez (a tabela inteira não cabe na tela).
  const celular = useTelaEstreita();
  const [perfilCelular, setPerfilCelular] = useState<Perfil>('coletor');
  const registro = useLiveQuery(async () => (await db.colecao('parametro').toArray()).find((p) => p.chave === 'permissoes' && !p.viveiro_id && !p.excluido), [db]);
  useEffect(() => setRascunho(matriz), [matriz]);

  const mudou = useMemo(() => JSON.stringify(rascunho) !== JSON.stringify(matriz), [rascunho, matriz]);

  function alternar(chave: string, perfil: Perfil) {
    setMsg('');
    setRascunho((r) => {
      const atual = new Set(r[chave] ?? []);
      if (atual.has(perfil)) atual.delete(perfil);
      else atual.add(perfil);
      return normalizarMatriz({ ...r, [chave]: [...atual] });
    });
  }

  async function salvar() {
    await repo.salvar('parametro', { chave: 'permissoes', valor: rascunho, viveiro_id: null, descricao: 'Tabela de permissões por perfil' }, registro?.id);
    setMsg('Permissões salvas. Valem para todos assim que os aparelhos sincronizarem.');
  }

  return (
    <Tela titulo="Permissões">
      <p className="dica">
        {admin ? 'Marque o que cada perfil pode fazer. As caixas cinzas não mudam (proteção de dados e segurança).' : 'O que cada perfil pode fazer no app. Só o administrador muda esta tabela.'}
      </p>
      {admin && (
        <div className="acoes acoes-permissoes">
          <button className="botao-secundario" onClick={() => setRascunho(matrizPadrao())}>
            <Icone nome="sincronizar" /> Restaurar padrão
          </button>
          <button className="botao-principal" onClick={() => void salvar()} disabled={!mudou}>
            <Icone nome="certo" /> Salvar permissões
          </button>
        </div>
      )}
      {msg && <p className="mensagem">{msg}</p>}
      {celular ? (
        <>
          <p className="passo">Escolha o perfil:</p>
          <div className="filtros" role="group" aria-label="Perfil">
            {PERFIS_PERMISSAO.map((c) => (
              <button key={c.perfil} className={`chip ${perfilCelular === c.perfil ? 'ativo' : ''}`} onClick={() => setPerfilCelular(c.perfil)}>
                {c.rotulo}
              </button>
            ))}
          </div>
          <div data-testid="permissoes" className="lista-permissoes">
            {GRUPOS_PERMISSAO.map((g) => (
              <section key={g} className="cartao">
                <h2>{g}</h2>
                {FUNCIONALIDADES.filter((f) => f.grupo === g).map((f) => {
                  const editavel = admin && celulaEditavel(f, perfilCelular);
                  return (
                    <label key={f.chave} className={`linha-check linha-permissao ${editavel ? '' : 'travada'}`}>
                      <input type="checkbox" checked={(rascunho[f.chave] ?? []).includes(perfilCelular)} disabled={!editavel} onChange={() => alternar(f.chave, perfilCelular)} />
                      <span>{f.rotulo}</span>
                      {!celulaEditavel(f, perfilCelular) && <Icone nome="cadeado" tamanho={18} />}
                    </label>
                  );
                })}
              </section>
            ))}
            <p className="dica">O administrador pode tudo.</p>
          </div>
        </>
      ) : (
      <div className="rolagem">
        <table className="tabela-permissoes" data-testid="permissoes">
          <thead>
            <tr>
              <th scope="col">O que fazer</th>
              <th scope="col">
                <span className="pilula pilula-admin">Administrador</span>
              </th>
              {PERFIS_PERMISSAO.map((c) => (
                <th scope="col" key={c.perfil}>
                  <span className={`pilula pilula-${c.perfil}`}>{c.rotulo}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS_PERMISSAO.map((g) => (
              <Fragment key={g}>
                <tr className="grupo">
                  <th colSpan={2 + PERFIS_PERMISSAO.length} scope="rowgroup">
                    {g}
                  </th>
                </tr>
                {FUNCIONALIDADES.filter((f) => f.grupo === g).map((f) => (
                  <tr key={f.chave}>
                    <th scope="row">{f.rotulo}</th>
                    <td>
                      <input type="checkbox" checked disabled aria-label={`${f.rotulo}: administrador`} />
                    </td>
                    {PERFIS_PERMISSAO.map((c) => (
                      <td key={c.perfil}>
                        <input
                          type="checkbox"
                          checked={(rascunho[f.chave] ?? []).includes(c.perfil)}
                          disabled={!admin || !celulaEditavel(f, c.perfil)}
                          onChange={() => alternar(f.chave, c.perfil)}
                          aria-label={`${f.rotulo}: ${c.rotulo}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Tela>
  );
}
