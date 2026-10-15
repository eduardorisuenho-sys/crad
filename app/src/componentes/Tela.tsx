/** Moldura de toda tela: título grande, botão voltar e a faixa de sincronização. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraSync } from './BarraSync';
import { Icone } from './Icone';

export function Tela({ titulo, children, voltar = true, acima }: { titulo: string; children: ReactNode; voltar?: boolean; acima?: ReactNode }) {
  const navegar = useNavigate();
  return (
    <div className="tela">
      {acima}
      <header className="topo">
        {voltar ? (
          <button className="botao-voltar" onClick={() => navegar(-1)} aria-label="Voltar">
            <Icone nome="voltar" />
          </button>
        ) : (
          <span className="topo-espaco" />
        )}
        <h1>{titulo}</h1>
      </header>
      <BarraSync />
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
