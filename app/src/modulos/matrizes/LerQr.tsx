/** Lê o QR da plaqueta com a câmera e abre a ficha (funciona sem internet). */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lerCodigo } from '@crads/dominio';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { lerQrDeImagem, lerQrDoVideo } from '../../plataforma/qr';

/** Onde procurar cada tipo de código (os outros módulos entram aqui). */
const ROTAS: Record<string, { colecao: string; rota: string }> = {
  MT: { colecao: 'matriz', rota: '/matrizes' },
};

export function LerQr() {
  const { db } = useApp();
  const navegar = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  const [digitado, setDigitado] = useState('');

  async function abrir(texto: string) {
    const c = lerCodigo(texto);
    const destino = c ? ROTAS[c.tipo] : undefined;
    if (!c || !destino) return setErro(`O código "${texto}" não é de uma plaqueta do CRADS.`);
    const reg = await db.colecao(destino.colecao).where('codigo').equals(texto.trim().toUpperCase()).first();
    if (!reg) return setErro(`${texto} ainda não está neste aparelho. Sincronize quando houver sinal.`);
    navegar(`${destino.rota}/${reg.id}`, { replace: true });
  }

  useEffect(() => {
    let parar = () => {};
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        parar = lerQrDoVideo(video.current, (t) => void abrir(t));
      } catch {
        setErro('Não foi possível abrir a câmera. Tire uma foto do QR ou digite o código.');
      }
    })();
    return () => {
      parar();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tela titulo="Ler plaqueta">
      <video ref={video} className="video-qr" playsInline muted />
      <p className="dica">Aponte a câmera para o QR code da plaqueta.</p>
      {erro && <p className="erro">{erro}</p>}
      <BotaoFoto
        aoEscolher={async (f) => {
          const t = await lerQrDeImagem(f);
          if (t) await abrir(t);
          else setErro('Não achei QR code na foto. Chegue mais perto.');
        }}
      >
        <Icone nome="compartilhar" tamanho={36} />
        <span>Tirar foto do QR</span>
      </BotaoFoto>
      <form
        className="linha-form"
        onSubmit={(e) => {
          e.preventDefault();
          void abrir(digitado);
        }}
      >
        <input value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder="ou digite: MT-0123" aria-label="Código da plaqueta" />
        <button className="botao-secundario">Abrir</button>
      </form>
    </Tela>
  );
}
