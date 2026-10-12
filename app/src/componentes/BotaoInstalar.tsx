/** Botão "Baixar o app": instala com um toque quando o navegador deixa; senão, abre o passo a passo. */
import { useNavigate } from 'react-router-dom';
import { useInstalacao } from '../plataforma/instalacao';
import { Icone } from './Icone';

export function BotaoInstalar({ classe = 'botao-instalar' }: { classe?: string }) {
  const { instalado, direto, instalar } = useInstalacao();
  const navegar = useNavigate();
  if (instalado) return null;
  return (
    <button
      type="button"
      className={classe}
      onClick={async () => {
        if (!(direto && (await instalar()))) navegar('/instalar');
      }}
    >
      <Icone nome="baixar" tamanho={28} />
      <span>
        Baixar o app
        <small>Fica na tela do celular e funciona sem internet</small>
      </span>
    </button>
  );
}
