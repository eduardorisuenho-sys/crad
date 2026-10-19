/**
 * Depois de registrar o pedido (e enquanto aguarda análise): quem pede envia
 * o ofício à SEMARH com a solicitação gerada pelo app em anexo. O gestor
 * analisa e autoriza (ou não) pelo app.
 */
import type { ReactNode } from 'react';

export const EMAIL_PROTOCOLO = 'protocolo@semarh.to.gov.br';

export function AvisoOficio({ codigo, children }: { codigo: string; children?: ReactNode }) {
  const assunto = encodeURIComponent(`Solicitação de mudas – Pedido ${codigo}`);
  return (
    <div className="aviso-oficio" data-testid="aviso-oficio">
      <h2>Próximo passo: envie o ofício à SEMARH</h2>
      <p>
        Para que o pedido seja analisado, envie um ofício de solicitação de mudas ao Secretário do Meio Ambiente e Recursos Hídricos para o e-mail{' '}
        <a href={`mailto:${EMAIL_PROTOCOLO}?subject=${assunto}`}>
          <strong>{EMAIL_PROTOCOLO}</strong>
        </a>
        .
      </p>
      <p>Anexe ao e-mail a solicitação gerada pelo aplicativo (botão “Baixar a solicitação em PDF”, logo abaixo).</p>
      <p>O gestor da Secretaria analisará o ofício e a solicitação e registrará pelo aplicativo se o pedido foi autorizado ou não. Você será avisado pelo aplicativo.</p>
      {children}
    </div>
  );
}
