/** Assinatura com o dedo na tela (vira imagem PNG para o termo de doação). */
import { useEffect, useRef, useState } from 'react';

export function Assinatura({ aoMudar }: { aoMudar: (png: Blob | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazia, setVazia] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const escala = window.devicePixelRatio || 1;
    c.width = c.clientWidth * escala;
    c.height = c.clientHeight * escala;
    const ctx = c.getContext('2d')!;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#33618d';
  }, []);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    setVazia(false);
    ref.current!.toBlob((b) => aoMudar(b), 'image/png');
  }

  function limpar() {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setVazia(true);
    aoMudar(null);
  }

  return (
    <div className="assinatura">
      <canvas
        ref={ref}
        aria-label="Área para assinar"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          desenhando.current = true;
          const p = ponto(e);
          const ctx = ref.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 0.1, p.y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const p = ponto(e);
          const ctx = ref.current!.getContext('2d')!;
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      <div className="assinatura-rodape">
        <span>{vazia ? 'Assine com o dedo aqui em cima' : 'Assinado'}</span>
        <button type="button" className="link" onClick={limpar}>
          Limpar
        </button>
      </div>
    </div>
  );
}
