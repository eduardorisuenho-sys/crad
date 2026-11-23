/**
 * Ao registrar mudas: já estão prontas para doação, ou ainda não? Se ainda não,
 * quem registra diz quando ficam prontas; nesse dia o lote entra para doação sozinho.
 */
import { somarMeses } from '@crads/dominio';

export interface EscolhaPronta {
  agora: boolean;
  /** meses a partir de hoje (quando escolheu um dos botões) */
  meses: number | null;
  /** data escolhida no calendário (AAAA-MM-DD) */
  data: string;
}

export const PRONTA_AGORA: EscolhaPronta = { agora: true, meses: null, data: '' };
const OPCOES_MESES = [1, 2, 3, 6, 12];

const hoje = () => new Date().toISOString().slice(0, 10);
const dataBr = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('pt-BR');

/** Fase e data para gravar no lote. */
export function faseEscolhida(e: EscolhaPronta): { fase: string; pronta_em?: string } {
  if (e.agora) return { fase: 'pronta' };
  const pronta_em = e.meses ? somarMeses(hoje(), e.meses) : e.data || undefined;
  return { fase: 'crescimento', pronta_em };
}

export function QuandoPronta({ valor, aoMudar }: { valor: EscolhaPronta; aoMudar: (e: EscolhaPronta) => void }) {
  const { pronta_em } = faseEscolhida(valor);
  return (
    <fieldset className="quando-pronta" data-testid="quando-pronta">
      <legend>Estão prontas para doação?</legend>
      <div className="filtros" role="group" aria-label="Prontas para doação?">
        <button type="button" className={`chip ${valor.agora ? 'ativo' : ''}`} aria-pressed={valor.agora} onClick={() => aoMudar(PRONTA_AGORA)}>
          Já estão prontas
        </button>
        <button type="button" className={`chip ${!valor.agora ? 'ativo' : ''}`} aria-pressed={!valor.agora} onClick={() => aoMudar({ agora: false, meses: 3, data: '' })}>
          Ainda não estão prontas
        </button>
      </div>
      {!valor.agora && (
        <>
          <p className="rotulo-campo">Quando ficarão prontas?</p>
          <div className="filtros" role="group" aria-label="Quando ficarão prontas?">
            {OPCOES_MESES.map((m) => (
              <button key={m} type="button" className={`chip ${valor.meses === m ? 'ativo' : ''}`} aria-pressed={valor.meses === m} onClick={() => aoMudar({ agora: false, meses: m, data: '' })}>
                {m === 1 ? '1 mês' : m === 12 ? '1 ano' : `${m} meses`}
              </button>
            ))}
          </div>
          <label>
            Ou escolha o dia
            <input type="date" min={somarMeses(hoje(), 0)} value={valor.meses ? '' : valor.data} onChange={(e) => aoMudar({ agora: false, meses: null, data: e.target.value })} />
          </label>
          <p className="dica" data-testid="aviso-pronta">
            {pronta_em
              ? `Até lá o lote fica “em formação” e não aparece para doação. Em ${dataBr(pronta_em)} ele entra para doação sozinho.`
              : 'Escolha quando as mudas ficarão prontas.'}
          </p>
        </>
      )}
    </fieldset>
  );
}
