/** Moldura de toda tela: título grande, botão voltar e a faixa de sincronização. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraSync } from './BarraSync';
import { Icone } from './Icone';

export function Tela({ titulo, children, voltar = true }: { titulo: string; children: ReactNode; voltar?: boolean }) {
  const navegar = useNavigate();
  return (
    <div className="tela">
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
      <main className="conteudo">{children}</main>
    </div>
  );
}
