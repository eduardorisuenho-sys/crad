/** Equipe do viveiro: aprovar pedidos de acesso, cadastrar pessoas e tirar acessos (com internet). */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { apagarConta } from '../lixeira/api';
import { cadastrarPessoa, lerEquipe, removerAcesso, responderPedido, ROTULO_PERFIL, type DadosEquipe } from './api';
import { useMarcarVisto } from '../../dados/usePendencias';

const PERFIS_EQUIPE = ['coletor', 'viveirista', 'gestor'];

export function Equipe() {
  const { sessao, online, sincronizar } = useApp();
  // abrir esta tela tira a pendência do número vermelho
  useMarcarVisto('pedido_acesso:');
  const [dados, setDados] = useState<DadosEquipe | null>(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; email: string; senha: string; viveiro_id: string; perfil: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    try {
      setDados(await lerEquipe(sessao));
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [sessao]);
  useEffect(() => {
    void carregar();
  }, [carregar, online]);

  const nomeViveiro = (id: string) => dados?.viveiros.find((v) => v.id === id)?.nome ?? '';

  async function fazer(acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(true);
    setErro('');
    setMsg('');
    try {
      await acao();
      setMsg(sucesso);
      await carregar();
      void sincronizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function salvarNovo(e: FormEvent) {
    e.preventDefault();
    if (!novo || !sessao) return;
    void fazer(async () => {
      const r = await cadastrarPessoa(sessao, { ...novo, email: novo.email.trim() });
      setNovo(null);
      return r;
    }, `${novo.nome} foi cadastrado(a). Passe o e-mail e a senha inicial para a pessoa.`);
  }

  if (!online && !dados) {
    return (
      <Tela titulo="Equipe">
        <p className="mensagem alerta">
          <Icone nome="semSinal" tamanho={20} /> A equipe é cuidada com internet. Conecte e abra de novo.
        </p>
      </Tela>
    );
  }

  return (
    <Tela titulo="Equipe">
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {msg && <p className="mensagem">{msg}</p>}
      {!dados && !erro && <p className="vazio">Carregando…</p>}

      {dados && (
        <>
          <section className="cartao" data-testid="pedidos-acesso">
            <h2>Pedidos de acesso ({dados.pedidos.length})</h2>
            {!dados.pedidos.length && <p className="dica">Nenhum pedido esperando.</p>}
            <ul className="lista">
              {dados.pedidos.map((p) => (
                <li key={p.id} className="pedido-acesso">
                  <div>
                    <strong>{p.nome}</strong>
                    <small>{p.email}</small>
                    <span>
                      quer ser <b>{ROTULO_PERFIL[p.perfil] ?? p.perfil}</b> · {nomeViveiro(p.viveiro_id)}
                    </span>
                  </div>
                  <div className="acoes">
                    <button className="botao-principal" disabled={ocupado} onClick={() => void fazer(() => responderPedido(sessao!, p.id, true), `${p.nome} agora faz parte da equipe.`)}>
                      Aprovar
                    </button>
                    <button
                      className="botao-secundario"
                      disabled={ocupado}
                      onClick={() => {
                        const motivo = prompt('Motivo da recusa (a pessoa vai ver):') ?? '';
                        void fazer(() => responderPedido(sessao!, p.id, false, motivo), 'Pedido recusado.');
                      }}
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {!novo ? (
            <button className="botao-grande" onClick={() => setNovo({ nome: '', email: '', senha: '', viveiro_id: dados.viveiros.length === 1 ? dados.viveiros[0].id : '', perfil: 'coletor' })}>
              <Icone nome="mais" tamanho={36} /> <span>Cadastrar pessoa</span>
            </button>
          ) : (
            <form className="cartao formulario" onSubmit={salvarNovo}>
              <h2>Cadastrar pessoa</h2>
              <label>
                Nome completo
                <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required minLength={3} />
              </label>
              <label>
                E-mail
                <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
              </label>
              <label>
                Senha inicial (a pessoa pode usar para entrar)
                <input value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} minLength={8} placeholder="pelo menos 8 letras ou números" />
              </label>
              <fieldset className="meses">
                <legend>Viveiro</legend>
                {dados.viveiros.map((v) => (
                  <button type="button" key={v.id} className={`chip ${novo.viveiro_id === v.id ? 'ativo' : ''}`} onClick={() => setNovo({ ...novo, viveiro_id: v.id })}>
                    {v.nome}
                  </button>
                ))}
              </fieldset>
              <fieldset className="meses">
                <legend>Vai trabalhar como</legend>
                {PERFIS_EQUIPE.map((p) => (
                  <button type="button" key={p} className={`chip ${novo.perfil === p ? 'ativo' : ''}`} onClick={() => setNovo({ ...novo, perfil: p })}>
                    {ROTULO_PERFIL[p]}
                  </button>
                ))}
              </fieldset>
              <p className="dica">Se a pessoa já tem conta (mesmo e-mail), ela só ganha o novo acesso; a senha dela não muda.</p>
              <div className="acoes">
                <button type="button" className="botao-secundario" onClick={() => setNovo(null)}>
                  Cancelar
                </button>
                <button className="botao-principal" disabled={ocupado || !novo.viveiro_id}>
                  Cadastrar
                </button>
              </div>
            </form>
          )}

          <section className="cartao">
            <h2>Pessoas ({dados.pessoas.length})</h2>
            <ul className="lista" data-testid="pessoas">
              {dados.pessoas.map((p) => (
                <li key={p.usuario_id} className="pessoa-equipe">
                  <div>
                    <strong>{p.nome || p.email}</strong>
                    <small>{p.email}</small>
                  </div>
                  {sessao?.gestorGeral && p.usuario_id !== sessao.id && (
                    <button
                      className="link"
                      disabled={ocupado}
                      onClick={() => confirm(`Apagar a conta de ${p.nome || p.email}? A pessoa não consegue mais entrar. O que ela já registrou continua.`) && void fazer(() => apagarConta(sessao, p.usuario_id), 'Conta apagada.')}
                    >
                      Apagar conta
                    </button>
                  )}
                  <ul className="chips">
                    {p.vinculos.map((v) => (
                      <li key={v.id} className="chip">
                        {ROTULO_PERFIL[v.perfil] ?? v.perfil}
                        {dados.viveiros.length > 1 ? ` · ${nomeViveiro(v.viveiro_id)}` : ''}
                        {p.usuario_id !== sessao?.id && (
                          <button
                            aria-label={`Tirar acesso de ${p.nome} como ${ROTULO_PERFIL[v.perfil]}`}
                            disabled={ocupado}
                            onClick={() => confirm(`Tirar o acesso de ${p.nome} como ${ROTULO_PERFIL[v.perfil]}?`) && void fazer(() => removerAcesso(sessao!, v.id), 'Acesso retirado.')}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <Link to="/permissoes" className="botao-grande">
            <Icone nome="cadeado" tamanho={36} /> <span>O que cada perfil pode fazer</span>
          </Link>
        </>
      )}
    </Tela>
  );
}
