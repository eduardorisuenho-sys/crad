/**
 * Compressão de fotos no próprio aparelho, para caber em celulares simples e
 * gastar pouco dado ao sincronizar: lado maior de 1280 px (foto) e 320 px
 * (miniatura), JPEG.
 */
export interface FotoComprimida {
  foto: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
}

async function carregar(arquivo: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; liberar: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { img: bmp, w: bmp.width, h: bmp.height, liberar: () => bmp.close() };
    } catch {
      /* navegador antigo: usa <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { img, w: img.naturalWidth, h: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
}

function reduzir(img: CanvasImageSource, w: number, h: number, lado: number, qualidade: number): Promise<{ blob: Blob; w: number; h: number }> {
  const escala = Math.min(1, lado / Math.max(w, h));
  const cw = Math.round(w * escala);
  const ch = Math.round(h * escala);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok({ blob: b, w: cw, h: ch }) : falha(new Error('Não foi possível comprimir a foto.'))), 'image/jpeg', qualidade),
  );
}

export async function comprimirFoto(arquivo: Blob, lado = 1280, qualidade = 0.72): Promise<FotoComprimida> {
  const { img, w, h, liberar } = await carregar(arquivo);
  try {
    const foto = await reduzir(img, w, h, lado, qualidade);
    const mini = await reduzir(img, w, h, 320, 0.6);
    return { foto: foto.blob, miniatura: mini.blob, largura: foto.w, altura: foto.h };
  } finally {
    liberar();
  }
}
