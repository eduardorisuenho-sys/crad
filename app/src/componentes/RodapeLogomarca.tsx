/** Rodapé de todas as telas: a logomarca da instituição que usa o app (Ajustes). Sem logomarca, não aparece. */
import { useLogomarca } from '../plataforma/logomarca';

export function RodapeLogomarca() {
  const logo = useLogomarca();
  if (!logo) return null;
  return (
    <footer className="rodape-logomarca" data-testid="rodape-logomarca">
      <img src={logo.imagem} alt="Logomarca da instituição" />
    </footer>
  );
}
