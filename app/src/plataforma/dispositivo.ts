/** É iPhone/iPad? (o iPad novo se apresenta como Mac com toque) */
export function ehIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** O app está aberto como app instalado (tela de início), e não dentro do navegador? */
export function estaInstalado(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
