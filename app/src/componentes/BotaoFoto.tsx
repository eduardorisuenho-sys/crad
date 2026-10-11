/** Botão grande que abre a câmera do aparelho (ou a galeria no computador). */
import { useId, type ReactNode } from 'react';

export function BotaoFoto({ aoEscolher, children, className = 'botao-grande' }: { aoEscolher: (f: File) => void; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={className} role="button">
      {children}
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) aoEscolher(f);
        }}
      />
    </label>
  );
}
