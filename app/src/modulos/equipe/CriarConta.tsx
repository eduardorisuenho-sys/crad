/** A própria pessoa cria a conta pelo celular. Solicitante entra na hora; equipe aguarda o gestor. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { descobrirServidor, entrar } from '../../dados/sessao';
import { criarConta, viveirosPublicos, type ViveiroPublico } from './api';
import { LogoAnimado } from '../../componentes/LogoAnimado';

type Escolha = 'solicitante' | 'coletor' | 'viveirista' | 'gestor';
const OPCOES: { valor: Escolha; rotulo: string; dica: string; icone: string }[] = [
  { valor: 'solicitante', rotulo: 'Quero pedir mudas', dica: 'Produtor, prefeitura, escola, associação', icone: 'doacao' },
  { valor: 'coletor', rotulo: 'Vou coletar sementes', dica: 'Precisa da aprovação do gestor', icone: 'semente' },
  { valor: 'viveirista', rotulo: 'Vou trabalhar no viveiro', dica: 'Precisa da aprovação do gestor', icone: 'muda' },
  { valor: 'gestor', rotulo: 'Grupo Gestor', dica: 'Precisa da aprovação de um gestor ou do administrador', icone: 'pessoas' },
];

export function CriarConta() {
  const { db, definirSessao } = useApp();
  const navegar = useNavigate();
  const [perfil, setPerfil] = useState<Escolha | null>(null);
  const [viveiros, setViveiros] = useState<ViveiroPublico[] | null>(null);
  // viveiros escolhidos (um, vários ou todos) e se a escolha já foi confirmada
  const [escolhidos, setEscolhidos] = useState<string[] | 'todos'>([]);
  const [viveirosOk, setViveirosOk] = useState(false);
  const [dados, setDados] = useState({ nome: '', email: '', senha: '' });
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const equipe = perfil === 'coletor' || perfil === 'viveirista' || perfil === 'gestor';

  useEffect(() => {
    if (!equipe || viveiros) return;
    descobrirServidor()
      .then(viveirosPublicos)
      .then((vs) => {
        setViveiros(vs);
        if (vs.length === 1) {
          setEscolhidos([vs[0].id]);
          setViveirosOk(true);
        }
      })
      .catch((e) => setErro((e as Error).message));
  }, [equipe, viveiros]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const servidor = await descobrirServidor();
      await criarConta(servidor, { ...dados, email: dados.email.trim(), perfil: perfil!, viveiro_ids: equipe ? escolhidos : undefined });
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
        <LogoAnimado />
        <strong className="so-leitor">CRAD</strong>
        <small>Centro de Recuperação de Áreas Degradadas</small>
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

      {perfil && equipe && !viveirosOk && (
        <div className="lista-grande">
          <p className="passo">Em quais viveiros?</p>
          <p className="dica">Marque um ou mais. O gestor de cada viveiro aprova o seu acesso.</p>
          {viveiros === null && !erro && <p className="vazio">Carregando…</p>}
          {viveiros && viveiros.length > 1 && (
            <button type="button" className={`botao-grande escolha ${escolhidos === 'todos' ? 'marcada' : ''}`} aria-pressed={escolhidos === 'todos'} onClick={() => setEscolhidos(escolhidos === 'todos' ? [] : 'todos')}>
              <Icone nome={escolhidos === 'todos' ? 'certo' : 'viveiro'} tamanho={40} /> <span>Todos os viveiros</span>
            </button>
          )}
          {viveiros?.map((v) => {
            const marcado = escolhidos === 'todos' || escolhidos.includes(v.id);
            return (
              <button
                type="button"
                key={v.id}
                className={`botao-grande escolha ${marcado ? 'marcada' : ''}`}
                aria-pressed={marcado}
                onClick={() => {
                  const atuais = escolhidos === 'todos' ? viveiros.map((x) => x.id) : escolhidos;
                  setEscolhidos(marcado ? atuais.filter((id) => id !== v.id) : [...atuais, v.id]);
                }}
              >
                <Icone nome={marcado ? 'certo' : 'viveiro'} tamanho={40} /> <span>{v.nome}</span>
              </button>
            );
          })}
          <button className="botao-principal" disabled={escolhidos !== 'todos' && !escolhidos.length} onClick={() => setViveirosOk(true)}>
            Continuar{escolhidos === 'todos' ? ' (todos os viveiros)' : escolhidos.length ? ` (${escolhidos.length} ${escolhidos.length === 1 ? 'viveiro' : 'viveiros'})` : ''}
          </button>
          <button className="link" onClick={() => setPerfil(null)}>
            Voltar
          </button>
        </div>
      )}

      {perfil && (!equipe || viveirosOk) && (
        <form className="formulario" onSubmit={enviar}>
          <p className="passo">
            {OPCOES.find((o) => o.valor === perfil)!.rotulo}
            {equipe && viveiros ? ` · ${escolhidos === 'todos' ? 'todos os viveiros' : viveiros.filter((v) => escolhidos.includes(v.id)).map((v) => v.nome).join(', ')}` : ''}
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
          {equipe && <p className="dica">Depois de criar, o gestor de cada viveiro precisa aprovar o seu acesso.</p>}
          <button className="botao-principal" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar conta'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              if (equipe && (viveiros?.length ?? 0) > 1) setViveirosOk(false);
              else {
                setEscolhidos([]);
                setViveirosOk(false);
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
