import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';

export function EmBreve({ titulo, icone }: { titulo: string; icone: string }) {
  return (
    <Tela titulo={titulo}>
      <div className="vazio">
        <Icone nome={icone} tamanho={72} />
        <p>Esta parte está sendo construída.</p>
      </div>
    </Tela>
  );
}
