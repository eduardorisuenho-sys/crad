/**
 * "Baixar o app": o navegador avisa uma única vez, logo ao abrir, que dá para
 * instalar (Android e computador). O aviso é guardado aqui para o botão usar
 * depois. No iPhone não existe esse aviso: o botão leva ao passo a passo.
 */
import { useEffect, useState } from 'react';
import { ehIOS, estaInstalado } from './dispositivo';

interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evento: EventoInstalar | null = null;
let instalou = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    instalou = true;
    avisar();
  });
}

export function useInstalacao() {
  const [, setVersao] = useState(0);
  useEffect(() => {
    const f = () => setVersao((v) => v + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  return {
    instalado: instalou || (typeof window !== 'undefined' && estaInstalado()),
    /** o navegador permite instalar com um toque */
    direto: !!evento,
    iphone: typeof navigator !== 'undefined' && ehIOS(),
    async instalar(): Promise<boolean> {
      if (!evento) return false;
      const e = evento;
      await e.prompt();
      const r = await e.userChoice?.catch(() => undefined);
      if (r?.outcome === 'accepted') {
        evento = null;
        instalou = true;
        avisar();
      }
      return true;
    },
  };
}
