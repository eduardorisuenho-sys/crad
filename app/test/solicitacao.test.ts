import { describe, expect, it } from 'vitest';
import { textoSolicitacao } from '../src/modulos/doacao/pdf';

describe('solicitação de mudas (substitui o ofício)', () => {
  it('monta o pedido formal com quem pede, para quê e onde', () => {
    const t = textoSolicitacao({ solicitante: 'Maria Teste', instituicao: 'Escola Teste', finalidade: 'Beira de rio ou nascente', municipio: 'Palmas', local: 'Sítio Boa Vista', viveiro: 'Viveiro Teste' });
    expect(t).toMatch(/^Eu, Maria Teste, representando Escola Teste, solicito ao Centro de Recuperação de Áreas Degradadas \(CRAD\), Viveiro Teste,/);
    expect(t).toContain('para beira de rio ou nascente');
    expect(t).toContain('no local: Sítio Boa Vista, Palmas');
    expect(t).toContain('Comprometo-me a plantar');
  });
  it('sem instituição nem local, o texto continua correto', () => {
    expect(textoSolicitacao({ solicitante: 'João', viveiro: '' })).toMatch(/^Eu, João solicito ao Centro de Recuperação de Áreas Degradadas \(CRAD\) a doação/);
  });
});
