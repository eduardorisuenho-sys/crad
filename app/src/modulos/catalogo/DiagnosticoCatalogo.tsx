/**
 * Para a equipe: mudas deste aparelho que não aparecem no catálogo e o motivo
 * de cada uma (com o que fazer). Só aparece quando há algo fora.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { diagnosticoCatalogo, type MotivoForaDoCatalogo, type Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';

export const TEXTO_MOTIVO: Record<MotivoForaDoCatalogo, string> = {
  em_formacao: 'Em formação: abra o lote e toque em “Ficou pronta para doação”.',
  reservadas: 'Todas as mudas já estão reservadas para pedidos aprovados.',
  ficticia: 'Espécie fictícia (de teste): nunca aparece no catálogo.',
  nao_enviado: 'Ainda não foi enviado ao servidor: abra o app com internet e espere “Tudo enviado”.',
  servidor_desatualizado: 'O servidor está desatualizado: rode a atualização do servidor (comando de instalação).',
  servidor: 'O servidor ainda não mostrou este lote: toque em Enviar (barra do alto) e abra o catálogo de novo.',
};

export function DiagnosticoCatalogo({ noCatalogo, regras }: { noCatalogo: Set<string>; regras: number | undefined }) {
  const { db } = useApp();
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const fora = useLiveQuery(async () => {
    const todos = async (n: string) => (await db.colecao(n).toArray()) as Registro[];
    return diagnosticoCatalogo(
      { lotesMudas: await todos('lote_mudas'), movimentos: await todos('movimento_estoque_mudas'), reservas: await todos('reserva'), especies: await todos('especie') },
      noCatalogo,
      regras,
    );
  }, [db, noCatalogo, regras]);
  if (!fora?.length) return null;
  const desatualizado = fora.some((f) => f.motivo === 'servidor_desatualizado');
  return (
    <section className="cartao" data-testid="diagnostico-catalogo">
      <h2>
        <Icone nome="aviso" tamanho={22} /> {fora.reduce((s, f) => s + f.saldo, 0)} mudas deste aparelho não aparecem no catálogo
      </h2>
      {desatualizado && <p className="mensagem alerta">O servidor ainda roda a versão antiga do catálogo. Atualize o servidor e as mudas aparecem sozinhas.</p>}
      <ul className="lista">
        {fora.map((f) => (
          <li key={f.lote_id}>
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
