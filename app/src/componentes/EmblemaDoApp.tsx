/** Mantém o total de pendências no ícone do app e no título da aba, em qualquer tela. */
import { useEffect } from 'react';
import { useApp } from '../contexto';
import { usePendencias } from '../dados/usePendencias';
import { mostrarNoIconeDoApp } from '../plataforma/emblemaApp';

export function EmblemaDoApp() {
  const { avisosAbertos } = useApp();
  const pendentes = usePendencias();
  const total = Object.values(pendentes).reduce((s, n) => s + (n ?? 0), 0) + avisosAbertos;
  useEffect(() => mostrarNoIconeDoApp(total), [total]);
  return null;
}
