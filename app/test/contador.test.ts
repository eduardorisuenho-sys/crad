import { describe, expect, it } from 'vitest';
import { rotuloComPendencias, textoContador } from '../src/componentes/Contador';

describe('número vermelho de pendências', () => {
  it('mostra até 99 e depois 99+', () => {
    expect(textoContador(1)).toBe('1');
    expect(textoContador(99)).toBe('99');
    expect(textoContador(100)).toBe('99+');
  });
  it('o leitor de tela ouve o número no nome do botão', () => {
    expect(rotuloComPendencias('Doação de mudas', 0)).toBe('Doação de mudas');
    expect(rotuloComPendencias('Doação de mudas', 1)).toBe('Doação de mudas, 1 pendência');
    expect(rotuloComPendencias('Doação de mudas', 3)).toBe('Doação de mudas, 3 pendências');
    expect(rotuloComPendencias('Ajustes', 2, 'aviso')).toBe('Ajustes, 2 avisos');
  });
});
