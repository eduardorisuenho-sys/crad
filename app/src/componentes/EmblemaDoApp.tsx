/** Mantém o total de pendências não vistas no ícone do app e no título da aba, em qualquer tela. */
import { useEffect } from 'react';
import { usePendencias } from '../dados/usePendencias';
import { mostrarNoIconeDoApp } from '../plataforma/emblemaApp';

export function EmblemaDoApp() {
  const { porModulo, avisos } = usePendencias();
  const total = Object.values(porModulo).reduce((s, n) => s + (n ?? 0), 0) + avisos;
  useEffect(() => mostrarNoIconeDoApp(total), [total]);
  return null;
}
