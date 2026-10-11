import { useState, type FormEvent } from 'react';
import { useApp } from '../contexto';
import { entrar, SERVIDOR_PADRAO } from '../dados/sessao';

export function Entrar() {
  const { db, definirSessao } = useApp();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [servidor, setServidor] = useState(localStorage.getItem('crads_servidor') || SERVIDOR_PADRAO);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      localStorage.setItem('crads_servidor', servidor);
      definirSessao(await entrar(db, servidor, email.trim(), senha));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela tela-entrar">
      <div className="marca">
        <img src="/icones/icone-192.png" alt="" width={96} height={96} />
        <h1>CRADS</h1>
        <p>Mudas nativas do Tocantins</p>
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
        <details className="avancado">
          <summary>Endereço do servidor</summary>
          <input value={servidor} onChange={(e) => setServidor(e.target.value)} aria-label="Endereço do servidor" />
        </details>
      </form>
    </div>
  );
}
