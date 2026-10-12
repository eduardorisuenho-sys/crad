/** A própria pessoa cria a conta pelo celular. Solicitante entra na hora; equipe aguarda o gestor. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { entrar, servidorGuardado } from '../../dados/sessao';
import { criarConta, viveirosPublicos, type ViveiroPublico } from './api';

type Escolha = 'solicitante' | 'coletor' | 'viveirista';
const OPCOES: { valor: Escolha; rotulo: string; dica: string; icone: string }[] = [
  { valor: 'solicitante', rotulo: 'Quero pedir mudas', dica: 'Produtor, prefeitura, escola, associação', icone: 'doacao' },
  { valor: 'coletor', rotulo: 'Vou coletar sementes', dica: 'Precisa da aprovação do gestor', icone: 'semente' },
  { valor: 'viveirista', rotulo: 'Vou trabalhar no viveiro', dica: 'Precisa da aprovação do gestor', icone: 'muda' },
];

export function CriarConta() {
  const { db, definirSessao } = useApp();
  const navegar = useNavigate();
  const servidor = servidorGuardado();
  const [perfil, setPerfil] = useState<Escolha | null>(null);
  const [viveiros, setViveiros] = useState<ViveiroPublico[] | null>(null);
  const [viveiro, setViveiro] = useState('');
  const [dados, setDados] = useState({ nome: '', email: '', senha: '' });
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const equipe = perfil === 'coletor' || perfil === 'viveirista';

  useEffect(() => {
    if (!equipe || viveiros) return;
    viveirosPublicos(servidor)
      .then((vs) => {
        setViveiros(vs);
        if (vs.length === 1) setViveiro(vs[0].id);
      })
      .catch((e) => setErro((e as Error).message));
  }, [equipe, viveiros, servidor]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await criarConta(servidor, { ...dados, email: dados.email.trim(), perfil: perfil!, viveiro_id: equipe ? viveiro : undefined });
      definirSessao(await entrar(db, servidor, dados.email.trim(), dados.senha));
      navegar('/', { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela tela-entrar">
      <div className="marca">
        <img src="/marca/logo-completa.png" alt="CRAD — Centro de Recuperação de Áreas Degradadas" />
      </div>
      <h1 className="pergunta">Criar conta</h1>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      {!perfil && (
        <div className="lista-grande">
          <p className="passo">O que você vai fazer no CRAD?</p>
          {OPCOES.map((o) => (
            <button key={o.valor} className="botao-grande" onClick={() => setPerfil(o.valor)}>
              <Icone nome={o.icone} tamanho={40} />
              <span>
                {o.rotulo}
                <small className="dica-botao">{o.dica}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {perfil && equipe && !viveiro && (
        <div className="lista-grande">
          <p className="passo">Em qual viveiro?</p>
          {viveiros === null && !erro && <p className="vazio">Carregando…</p>}
          {viveiros?.map((v) => (
            <button key={v.id} className="botao-grande" onClick={() => setViveiro(v.id)}>
              <Icone nome="viveiro" tamanho={40} /> <span>{v.nome}</span>
            </button>
          ))}
          <button className="link" onClick={() => setPerfil(null)}>
            Voltar
          </button>
        </div>
      )}

      {perfil && (!equipe || viveiro) && (
        <form className="formulario" onSubmit={enviar}>
          <p className="passo">
            {OPCOES.find((o) => o.valor === perfil)!.rotulo}
            {equipe && viveiros ? ` · ${viveiros.find((v) => v.id === viveiro)?.nome ?? ''}` : ''}
          </p>
          <label>
            Nome completo
            <input autoComplete="name" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} required minLength={3} />
          </label>
          <label>
            E-mail
            <input type="email" autoComplete="email" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} required />
          </label>
          <label>
            Senha (pelo menos 8 letras ou números)
            <input type={verSenha ? 'text' : 'password'} autoComplete="new-password" value={dados.senha} onChange={(e) => setDados({ ...dados, senha: e.target.value })} required minLength={8} />
          </label>
          <label className="linha-check">
            <input type="checkbox" checked={verSenha} onChange={(e) => setVerSenha(e.target.checked)} /> Mostrar a senha
          </label>
          {equipe && <p className="dica">Depois de criar, o gestor do viveiro precisa aprovar o seu acesso.</p>}
          <button className="botao-principal" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar conta'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              if (equipe && viveiro && (viveiros?.length ?? 0) > 1) setViveiro('');
              else {
                setViveiro('');
                setPerfil(null);
              }
            }}
          >
            Voltar
          </button>
        </form>
      )}
      <Link to="/" className="botao-secundario">
        Já tenho conta: entrar
      </Link>
    </div>
  );
}
