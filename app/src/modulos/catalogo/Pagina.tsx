/** Moldura das páginas do catálogo: dentro do app (com login) ou pública. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';

export function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { sessao } = useApp();
  if (sessao) return <Tela titulo={titulo}>{children}</Tela>;
  return (
    <div className="tela">
      <header className="topo topo-publico">
        <Link to="/catalogo" aria-label="Catálogo">
          <img src="/marca/simbolo.png" alt="" width={40} height={42} />
        </Link>
        <h1>{titulo}</h1>
        <Link to="/" className="botao-secundario botao-entrar">
          Entrar
        </Link>
      </header>
      <main className="conteudo">
        {children}
        <svg className="ondas" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C 80 4, 160 36, 240 18 S 360 8, 400 16 V40 H0Z" fill="var(--azul)" />
          <path d="M0 30 C 90 16, 170 40, 250 26 S 360 22, 400 28 V40 H0Z" fill="var(--azul-escuro)" />
        </svg>
      </main>
    </div>
  );
}
