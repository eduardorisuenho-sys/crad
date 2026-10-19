/** Botão "Plantando Água": marca a doação no programa (com histórico de quem marcou e desmarcou). */
import { useLiveQuery } from 'dexie-react-hooks';
import { bloqueioDesmarcar, marcadaNoPrograma, type Registro } from '@crads/dominio';
import { useApp } from '../../contexto';
import { marcarPrograma, PROGRAMA_PLANTANDO_AGUA } from './dados';

export function IconeAgua({ tamanho = 28 }: { tamanho?: number }) {
  // símbolo do Projeto Plantando Água: a gota entre duas folhas (cores do próprio projeto)
  return (
    <svg className="logo-plantando-agua" width={tamanho * 1.14} height={tamanho} viewBox="0 0 114 100" aria-hidden="true">
      <defs>
        <linearGradient id="pa-gota" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22a0dc" />
          <stop offset="1" stopColor="#0b5ea8" />
        </linearGradient>
        <linearGradient id="pa-folha" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#a8d92c" />
          <stop offset="0.55" stopColor="#3f8a12" />
          <stop offset="1" stopColor="#15600a" />
        </linearGradient>
      </defs>
      <path d="M57 0C47 11 34 27 28 40C42 45 52 53 57 71C62 53 72 45 86 40C80 27 67 11 57 0Z" fill="url(#pa-gota)" />
      <path d="M4 23C-2 40-2 62 10 78C22 92 40 96 55 99C55 80 53 66 45 56C36 46 16 42 8 34C6 31 5 27 4 23Z" fill="url(#pa-folha)" />
      <path d="M110 23C116 40 116 62 104 78C92 92 74 96 59 99C59 80 61 66 69 56C78 46 98 42 106 34C108 31 109 27 110 23Z" fill="url(#pa-folha)" />
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
