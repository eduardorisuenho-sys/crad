/** Inventário: conta cada lote; as diferenças viram ajustes no estoque. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ajustesInventario } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { lotesDeMudas, ROTULO_FASE } from './dados';
import { useMarcarVisto } from '../../dados/usePendencias';

export function Inventario() {
  const { repo, db, sessao } = useApp();
  // abrir esta tela tira a pendência do número vermelho
  useMarcarVisto('inventario:');
  // lote zerado não entra no inventário (só no histórico); o recusado pelo servidor entra para recontar
  const lotes = useLiveQuery(async () => (await lotesDeMudas(repo)).filter((l) => l.lote.situacao !== 'encerrado' && (l.saldo > 0 || l.recusado)), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [contagem, setContagem] = useState<Record<string, string>>({});
  const [feito, setFeito] = useState('');

  const itens = lotes.map((l) => ({ lote_mudas_id: l.lote.id, saldo_sistema: l.saldo, contado: contagem[l.lote.id] === undefined || contagem[l.lote.id] === '' ? null : Number(contagem[l.lote.id]) }));
  const ajustes = ajustesInventario(itens);
  const contados = itens.filter((i) => i.contado !== null).length;

  async function fechar() {
    const hoje = new Date().toISOString().slice(0, 10);
    const inv = await repo.salvar('inventario', { data: hoje, responsavel_id: sessao?.id ?? null, situacao: 'fechado' });
    for (const i of itens) if (i.contado !== null) await repo.salvar('inventario_item', { inventario_id: inv.id, lote_mudas_id: i.lote_mudas_id, contado: i.contado, saldo_sistema: i.saldo_sistema });
    for (const a of ajustes) await repo.salvar('movimento_estoque_mudas', { lote_mudas_id: a.lote_mudas_id, tipo: 'ajuste_inventario', quantidade: a.diferenca, data: hoje, referencia: `inventário ${hoje}` });
    setContagem({});
    setFeito(`Inventário fechado: ${contados} lote(s) contado(s), ${ajustes.length} ajuste(s).`);
  }

  return (
    <Tela titulo="Inventário">
      {feito && <p className="mensagem">{feito}</p>}
      <p className="dica">Conte as mudas de cada lote e anote. Deixe em branco o que não contou.</p>
      <ul className="lista">
        {lotes.map((l) => {
          const c = contagem[l.lote.id];
          const dif = c !== undefined && c !== '' ? Number(c) - l.saldo : 0;
          return (
            <li key={l.lote.id} className="item-lista">
              <div>
                <strong>
                  {String(l.lote.codigo)} · {nomes?.get(String(l.lote.especie_id)) ?? ''}
                </strong>
                <small>
                  {ROTULO_FASE[String(l.lote.fase_atual ?? 'semeadura')]} · no sistema: {l.saldo}
                  {l.lote.canteiro ? ` · canteiro ${String(l.lote.canteiro)}` : ''}
                </small>
                {dif !== 0 && <small className="alerta-texto">diferença: {dif > 0 ? `+${dif}` : dif}</small>}
              </div>
              <input
                className="campo-contagem"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                aria-label={`Contado em ${String(l.lote.codigo)}`}
                value={c ?? ''}
                onChange={(e) => setContagem({ ...contagem, [l.lote.id]: e.target.value })}
              />
            </li>
          );
        })}
        {!lotes.length && <li className="vazio">Nenhum lote de mudas para contar.</li>}
      </ul>
      <button className="botao-principal" disabled={!contados} onClick={() => void fechar()}>
        <Icone nome="certo" /> Fechar inventário ({ajustes.length} ajuste(s))
      </button>
    </Tela>
  );
}
