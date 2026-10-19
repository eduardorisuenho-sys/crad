/**
 * Para a equipe: mudas deste aparelho que não aparecem no catálogo e o motivo
 * de cada uma (com o que fazer). Só aparece quando há algo fora.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { diagnosticoCatalogo, type MotivoForaDoCatalogo, type Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';

export const TEXTO_MOTIVO: Record<MotivoForaDoCatalogo, string> = {
  recusado: 'O servidor recusou este cadastro: abra Avisos (barra do alto) para ver o motivo e corrija.',
  em_formacao: 'Em formação: abra o lote e toque em “Marcar como pronta”.',
  reservadas: 'Todas as mudas já estão reservadas para pedidos aprovados.',
  nao_enviado: 'Ainda não foi enviado ao servidor: abra o app com internet e espere “Tudo enviado”.',
  servidor_desatualizado: 'O servidor está desatualizado: rode a atualização do servidor (comando de instalação).',
  sem_entrada_no_servidor: 'O lote chegou ao servidor, mas a quantidade de mudas não chegou. Abra o lote e registre a quantidade de novo (Inventário).',
  especie_apagada: 'A espécie deste lote foi apagada no servidor: restaure a espécie na Lixeira ou apague o lote.',
  esgotado_no_servidor: 'No servidor, as mudas deste lote já saíram (doação ou perda). Confira o lote.',
  nao_esta_no_servidor: 'O servidor não tem este lote (ele se perdeu no envio). Toque em “Reenviar ao servidor”.',
  outra_especie: 'No servidor este lote está ligado a outra espécie (cadastro repetido da espécie?). Confira a espécie do lote e junte as espécies repetidas.',
  servidor: 'O servidor ainda não mostrou este lote: toque em Enviar (barra do alto) e abra o catálogo de novo.',
};

export function DiagnosticoCatalogo({ noCatalogo, regras, noServidor }: { noCatalogo: Set<string>; regras: number | undefined; noServidor: Map<string, string | { situacao: string; especie_id?: string }> }) {
  const { db, repo, sincronizar } = useApp();
  const [reenviados, setReenviados] = useState('');
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const fora = useLiveQuery(async () => {
    const todos = async (n: string) => (await db.colecao(n).toArray()) as Registro[];
    return diagnosticoCatalogo(
      { lotesMudas: await todos('lote_mudas'), movimentos: await todos('movimento_estoque_mudas'), reservas: await todos('reserva'), especies: await todos('especie') },
      noCatalogo,
      regras,
      noServidor,
    );
  }, [db, noCatalogo, regras, noServidor]);
  if (!fora?.length) return null;
  const desatualizado = fora.some((f) => f.motivo === 'servidor_desatualizado');
  return (
    <section className="cartao" data-testid="diagnostico-catalogo">
      <h2>
        <Icone nome="aviso" tamanho={22} /> {fora.reduce((s, f) => s + f.saldo, 0)} mudas deste aparelho não aparecem no catálogo
      </h2>
      {reenviados && <p className="mensagem">{reenviados}</p>}
      {desatualizado && <p className="mensagem alerta">O servidor ainda roda a versão antiga do catálogo. Atualize o servidor e as mudas aparecem sozinhas.</p>}
      <ul className="lista">
        {fora.map((f) => (
          <li key={f.lote_id}>
            {f.motivo === 'nao_esta_no_servidor' && (
              <button
                type="button"
                className="botao-secundario"
                onClick={async () => {
                  // o lote e as movimentações dele vão de novo
                  let n = Number(await repo.reenviar('lote_mudas', f.lote_id));
                  for (const m of await db.colecao('movimento_estoque_mudas').where('lote_mudas_id').equals(f.lote_id).toArray()) if (!m.excluido) n += Number(await repo.reenviar('movimento_estoque_mudas', m.id));
                  setReenviados(`${f.codigo}: ${n} registro(s) reenviados. Abra o catálogo de novo em instantes.`);
                  void sincronizar();
                }}
              >
                Reenviar {f.codigo} ao servidor
              </button>
            )}
            <Link to={`/viveiro/lotes/${f.lote_id}`} className="item-lista">
              <Icone nome="muda" />
              <div>
                <strong>
                  {f.codigo} · {nomes?.get(f.especie_id) ?? ''} · {f.saldo} mudas
                </strong>
                <small data-motivo={f.motivo}>{TEXTO_MOTIVO[f.motivo]}</small>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
