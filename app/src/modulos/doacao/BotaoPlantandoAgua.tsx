/** Botão "Plantando Água": marca a doação no programa (com histórico de quem marcou e desmarcou). */
import { useLiveQuery } from 'dexie-react-hooks';
import { bloqueioDesmarcar, marcadaNoPrograma, type Registro } from '@crads/dominio';
import { useApp } from '../../contexto';
import { marcarPrograma, PROGRAMA_PLANTANDO_AGUA } from './dados';

export function IconeAgua({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C12 2 5 10 5 14.5A7 7 0 0 0 19 14.5C19 10 12 2 12 2Z" fill="currentColor" />
      <path d="M7 17c2-1.2 3.5 1.2 5.5 0s3.5-1 4.5-.2" stroke="var(--branco)" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

export function BotaoPlantandoAgua({ doacao, editavel }: { doacao: Registro; editavel: boolean }) {
  const { db, repo, sessao } = useApp();
  const programa = useLiveQuery(() => db.colecao('programa').get(PROGRAMA_PLANTANDO_AGUA), [db]);
  const historico = useLiveQuery(async () => (await db.colecao('doacao_programa_historico').where('doacao_id').equals(doacao.id).toArray()).filter((h) => !h.excluido), [doacao.id]) ?? [];
  const marcada = marcadaNoPrograma(historico as never, doacao.id, PROGRAMA_PLANTANDO_AGUA);

  async function alternar() {
    let motivo = '';
    if (marcada && doacao.situacao === 'retirada') motivo = prompt('A doação já foi retirada. Por que tirar do Plantando Água?') ?? '';
    const b = marcada ? bloqueioDesmarcar({ situacao: doacao.situacao }, motivo) : null;
    if (b) return alert(b);
    await marcarPrograma(db, repo, doacao, !marcada, sessao?.nome ?? '', motivo);
  }

  if (!programa) return null;
  return (
    <section className="cartao programa">
      <button type="button" className={`botao-programa ${marcada ? 'ativo' : ''}`} disabled={!editavel} aria-pressed={marcada} onClick={() => void alternar()} data-testid="plantando-agua">
        <IconeAgua tamanho={32} />
        <span>
          <strong>Plantando Água</strong>
          <small>{marcada ? 'Doação do programa' : editavel ? 'Toque se as mudas vão para o programa' : 'Fora do programa'}</small>
        </span>
      </button>
      {historico.length > 0 && (
        <details>
          <summary>Histórico ({historico.length})</summary>
          <ul className="historico">
            {[...historico]
              .sort((a, b) => String(a.criado_no_aparelho_em).localeCompare(String(b.criado_no_aparelho_em)))
              .map((h) => (
                <li key={h.id}>
                  {new Date(String(h.criado_no_aparelho_em)).toLocaleString('pt-BR')}: {String(h.usuario_nome || 'alguém')} {h.acao === 'marcou' ? 'marcou' : 'desmarcou'}
                  {h.motivo ? ` · ${String(h.motivo)}` : ''}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
