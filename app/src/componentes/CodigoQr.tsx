import { useEffect, useState } from 'react';
import { gerarQrSvg } from '../plataforma/qr';

/** QR code gerado no aparelho (sem internet). */
export function CodigoQr({ texto, tamanho = 160 }: { texto: string; tamanho?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    void gerarQrSvg(texto).then(setSvg);
  }, [texto]);
  // O SVG vem da biblioteca qrcode a partir do código do lote (sem conteúdo do usuário em HTML).
  return <div className="qr" style={{ width: tamanho, height: tamanho }} aria-label={`QR code ${texto}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
