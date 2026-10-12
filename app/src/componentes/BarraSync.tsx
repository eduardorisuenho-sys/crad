/** Faixa que diz, em poucas palavras, se o que foi feito já chegou ao servidor. */
import { Link } from 'react-router-dom';
import { useApp } from '../contexto';
import { Icone } from './Icone';

export function BarraSync() {
  const { online, estadoSync, mensagemSync, pendentes, avisosAbertos, sincronizar } = useApp();

  let classe = 'ok';
  let texto = 'Tudo enviado';
  if (estadoSync === 'sincronizando') {
    classe = 'andando';
    texto = 'Enviando…';
  } else if (estadoSync === 'entrar_de_novo') {
    classe = 'alerta';
    texto = 'Entre de novo para enviar';
  } else if (!online || estadoSync === 'sem_sinal') {
    classe = pendentes ? 'alerta' : 'neutro';
    texto = pendentes ? `Sem sinal · ${pendentes} guardado(s) no aparelho` : 'Sem sinal · pode continuar usando';
  } else if (pendentes) {
    classe = 'alerta';
    texto = estadoSync === 'erro' ? `${pendentes} para enviar · erro: ${mensagemSync}` : `${pendentes} para enviar`;
  } else if (estadoSync === 'erro') {
    classe = 'alerta';
    texto = 'Não foi possível enviar agora';
  }

  return (
    <div className={`barra-sync ${classe}`} role="status" data-testid="barra-sync">
      <Icone nome={online ? 'sinal' : 'semSinal'} tamanho={22} />
      <span>{texto}</span>
      {avisosAbertos > 0 && (
        <Link to="/avisos" className="selo-aviso">
          {avisosAbertos} aviso(s)
        </Link>
      )}
      {online && pendentes > 0 && estadoSync !== 'sincronizando' && (
        <button className="botao-mini" onClick={() => void sincronizar()}>
          Enviar
        </button>
      )}
    </div>
  );
}
