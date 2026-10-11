/** Guia com figuras para instalar o app na tela de início (essencial no iPhone). */
import { useEffect, useState } from 'react';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { ehIOS, estaInstalado } from '../plataforma/dispositivo';

interface EventoInstalar extends Event {
  prompt(): Promise<void>;
}

export function Instalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  useEffect(() => {
    const f = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener('beforeinstallprompt', f);
    return () => window.removeEventListener('beforeinstallprompt', f);
  }, []);

  if (estaInstalado()) {
    return (
      <Tela titulo="Instalar">
        <div className="vazio">
          <Icone nome="certo" tamanho={72} />
          <p>O CRADS já está instalado neste aparelho.</p>
        </div>
      </Tela>
    );
  }

  return (
    <Tela titulo="Instalar o CRADS">
      {ehIOS() ? (
        <ol className="passos">
          <li>
            <Icone nome="compartilhar" tamanho={48} />
            <span>
              No <strong>Safari</strong>, toque no botão <strong>Compartilhar</strong>.
            </span>
          </li>
          <li>
            <Icone nome="mais" tamanho={48} />
            <span>
              Toque em <strong>Adicionar à Tela de Início</strong>.
            </span>
          </li>
          <li>
            <img src="/icones/icone-192.png" alt="" width={48} height={48} />
            <span>
              Abra sempre pelo <strong>ícone do CRADS</strong>. Assim o iPhone não apaga o que você guardou sem internet.
            </span>
          </li>
        </ol>
      ) : evento ? (
        <button className="botao-principal" onClick={() => void evento.prompt()}>
          <Icone nome="mais" /> Instalar no aparelho
        </button>
      ) : (
        <ol className="passos">
          <li>
            <Icone nome="configuracoes" tamanho={48} />
            <span>
              No Chrome, toque nos <strong>três pontinhos</strong>.
            </span>
          </li>
          <li>
            <Icone nome="mais" tamanho={48} />
            <span>
              Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </span>
          </li>
        </ol>
      )}
    </Tela>
  );
}
