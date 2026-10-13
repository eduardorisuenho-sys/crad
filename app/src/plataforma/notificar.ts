/**
 * Avisos com som: toca um "plim" (gerado no aparelho, sem arquivo) e, se a
 * pessoa permitiu, mostra a notificação do celular/computador.
 */
const CHAVE_SOM = 'crads_som';

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== '0';
  } catch {
    return true;
  }
}

export function ligarSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? '1' : '0');
  } catch {
    /* sem armazenamento: fica o padrão (ligado) */
  }
}

let contexto: AudioContext | null = null;

/** Duas notas curtas e agradáveis. */
export function tocarSom() {
  if (!somLigado()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexto ??= new Ctx();
    void contexto.resume();
    const t = contexto.currentTime;
    for (const [freq, inicio] of [
      [880, 0],
      [1320, 0.18],
    ] as const) {
      const osc = contexto.createOscillator();
      const vol = contexto.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t + inicio);
      vol.gain.exponentialRampToValueAtTime(0.35, t + inicio + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + inicio + 0.35);
      osc.connect(vol).connect(contexto.destination);
      osc.start(t + inicio);
      osc.stop(t + inicio + 0.4);
    }
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* sem som neste aparelho */
  }
}

export function permissaoNotificacao(): NotificationPermission | 'indisponivel' {
  return typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission;
}

export async function pedirPermissaoNotificacao(): Promise<NotificationPermission | 'indisponivel'> {
  if (typeof Notification === 'undefined') return 'indisponivel';
  return Notification.requestPermission();
}

/** Notificação do sistema (aparece mesmo com o app em segundo plano, enquanto ele estiver aberto). */
export async function notificarNoAparelho(titulo: string, texto: string) {
  if (permissaoNotificacao() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titulo, { body: texto, icon: '/icones/icone-192.png', badge: '/icones/icone-192.png', tag: titulo });
    else new Notification(titulo, { body: texto });
  } catch {
    /* sem notificação do sistema: fica o aviso na tela */
  }
}
