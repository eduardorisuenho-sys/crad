/** Endereço público do rastreio de um lote (gravado no QR das etiquetas das mudas). */
export function linkRastreio(codigo: string, origem = typeof location !== 'undefined' ? location.origin : ''): string {
  return `${origem}/rastreio/${encodeURIComponent(codigo)}`;
}

/** Tira o código de um QR: aceita só o código (MT-0123) ou o endereço do rastreio. */
export function codigoDoQr(texto: string): string {
  const t = texto.trim();
  const m = /\/rastreio\/([^/?#\s]+)/i.exec(t);
  return (m ? decodeURIComponent(m[1]) : t).toUpperCase();
}
