/**
 * Número vermelho de pendências no canto do botão (padrão dos "badges" do
 * Material Design): até "99+", some quando zera e aparece com uma animação
 * curta (sem animação para quem pediu menos movimento). É só visual: o número
 * vai no nome do botão para o leitor de tela (ver rotuloComPendencias).
 */
import { useEffect, useRef, useState } from 'react';

export const textoContador = (n: number) => (n > 99 ? '99+' : String(n));

/** Nome do botão para o leitor de tela: "Doação de mudas, 3 pendências". */
export function rotuloComPendencias(rotulo: string, n: number, palavra = 'pendência'): string {
  return n > 0 ? `${rotulo}, ${n} ${n === 1 ? palavra : `${palavra}s`}` : rotulo;
}

export function Contador({ valor, testId }: { valor: number; testId?: string }) {
  // pulsa quando o número aumenta (chegou algo novo)
  const anterior = useRef(valor);
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    if (valor > anterior.current) setPulso((p) => p + 1);
    anterior.current = valor;
  }, [valor]);
  if (valor <= 0) return null;
  return (
    <span key={pulso} className="contador-pendencias" data-testid={testId} aria-hidden="true">
      {textoContador(valor)}
    </span>
  );
}
