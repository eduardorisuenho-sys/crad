/**
 * Logomarca com a animação de abertura (água, semente, broto, CRAD). Roda uma vez a
 * cada abertura do app e para no último quadro, que é o próprio logo; ao voltar para a
 * tela no mesmo uso, já aparece parado. Sem animação (aparelho com "reduzir movimento",
 * vídeo bloqueado pela economia de bateria ou sem carregar), mostra o logo parado.
 */
import { useEffect, useRef, useState } from 'react';

let jaTocouNestaAbertura = false;

const LARGURA = 400;
const ALTURA = 494;

function reduzirMovimento(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function LogoAnimado({ classe = '' }: { classe?: string }) {
  const [animar] = useState(() => !jaTocouNestaAbertura && !reduzirMovimento());
  const [parado, setParado] = useState(!animar);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!animar) return;
    jaTocouNestaAbertura = true;
    // autoplay recusado (economia de bateria, iPhone em pouca energia): fica o logo parado
    video.current?.play().catch(() => setParado(true));
  }, [animar]);

  const cls = `logo-animado ${classe}`.trim();
  if (parado) return <img className={cls} src="/marca/abertura-final.png" alt="" width={LARGURA} height={ALTURA} data-testid="logo-parado" />;
  return (
    <video
      ref={video}
      className={cls}
      width={LARGURA}
      height={ALTURA}
      muted
      playsInline
      autoPlay
      preload="auto"
      aria-hidden="true"
      data-testid="logo-animado"
    >
      {/* WebM (VP9) para Chrome, Edge, Firefox e Android; MP4 (H.264) para iPhone. Nenhum serve: logo parado */}
      <source src="/marca/abertura.webm" type="video/webm" />
      <source src="/marca/abertura.mp4" type="video/mp4" onError={() => setParado(true)} />
    </video>
  );
}
