/** QR code: gerar (plaqueta) e ler pela câmera (sem internet). */
import jsQR from 'jsqr';
import QRCode from 'qrcode';

/** Texto gravado no QR: só o código (ex.: MT-0123), legível por qualquer leitor. */
export function gerarQrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

interface Detector {
  detect(fonte: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Lê QR do vídeo da câmera. Usa o leitor nativo do navegador quando existe
 * (Chrome no Android) e o jsQR nos demais (Safari no iPhone).
 */
export function lerQrDoVideo(video: HTMLVideoElement, aoLer: (texto: string) => void): () => void {
  let ativo = true;
  const Nativo = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const detector = Nativo ? new Nativo({ formats: ['qr_code'] }) : null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const passo = async () => {
    if (!ativo) return;
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        if (detector) {
          const r = await detector.detect(video);
          if (r[0]?.rawValue) return aoLer(r[0].rawValue);
        } else {
          const escala = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const r = jsQR(dados.data, dados.width, dados.height, { inversionAttempts: 'dontInvert' });
          if (r?.data) return aoLer(r.data);
        }
      } catch {
        /* quadro ruim: tenta o próximo */
      }
    }
    setTimeout(() => void passo(), 200);
  };
  void passo();
  return () => {
    ativo = false;
  };
}

/** Lê QR de uma foto (alternativa quando a câmera ao vivo não abre). */
export async function lerQrDeImagem(arquivo: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(d.data, d.width, d.height)?.data ?? null;
}
