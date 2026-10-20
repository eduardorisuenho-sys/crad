/**
 * Número de pendências no ícone do app instalado (Badging API:
 * navigator.setAppBadge). Funciona no iPhone/iPad (app na tela de início, com
 * notificações permitidas) e no Windows/macOS. No Android o próprio sistema
 * mostra a bolinha quando há notificação. Também vai no título da aba: "(3) CRAD".
 */
const TITULO = 'CRAD';

export function mostrarNoIconeDoApp(total: number) {
  document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${TITULO}` : TITULO;
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (total > 0) void nav.setAppBadge?.(total).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  } catch {
    // navegador sem a API: só o título
  }
}
