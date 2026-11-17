/** QR Code do app: outra pessoa aponta a câmera e abre a página "Baixar o CRAD" (gerado no aparelho, sem internet). */
import { useState } from 'react';
import { CodigoQr } from './CodigoQr';
import { Icone } from './Icone';

export function QrDoApp() {
  const [aberto, setAberto] = useState(false);
  const link = `${window.location.origin}/instalar`;
  return (
    <>
      <button type="button" className="botao-secundario" aria-expanded={aberto} onClick={() => setAberto(!aberto)} data-testid="mostrar-qr-app">
        <Icone nome="qr" /> {aberto ? 'Esconder o QR Code' : 'Mostrar QR Code do app'}
      </button>
      {aberto && (
        <section className="cartao qr-do-app" data-testid="qr-app">
          <CodigoQr texto={link} tamanho={240} />
          <p>
            Peça para a outra pessoa <strong>apontar a câmera do celular</strong> para este código. Abre a página para baixar o CRAD.
          </p>
          <small>{link.replace(/^https?:\/\//, '')}</small>
        </section>
      )}
    </>
  );
}
