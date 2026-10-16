import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BotaoInstalar } from '../componentes/BotaoInstalar';
import { useApp } from '../contexto';
import { descobrirServidor, entrar } from '../dados/sessao';

export function Entrar() {
  const { db, definirSessao } = useApp();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      // o app acha o servidor sozinho (não precisa digitar endereço)
      definirSessao(await entrar(db, await descobrirServidor(), email.trim(), senha));
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
      <form onSubmit={aoEnviar} className="formulario">
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao-principal" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <BotaoInstalar />
        <Link to="/criar-conta" className="botao-secundario">
          Criar conta
        </Link>
        <Link to="/catalogo" className="botao-secundario">
          Ver o catálogo de mudas (sem login)
        </Link>
      </form>
    </div>
  );
}
