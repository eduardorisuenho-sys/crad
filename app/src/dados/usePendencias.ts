/**
 * Pendências da pessoa (número vermelho nos botões da tela inicial e no ícone
 * do app). Funciona sem internet. Cada pendência some do número depois que a
 * pessoa abre o item (useMarcarVisto); volta a contar se o motivo mudar.
 * O "visto" fica guardado neste aparelho, para cada pessoa.
 */
import { useEffect, useSyncExternalStore } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { itensPendentes, pedidosQueEsperam, type Pendencias, type Rota } from '@crads/dominio';
import { useApp } from '../contexto';
import type { BancoCrads } from './db';

const chaveVistas = (usuarioId: string) => `pendencias_vistas:${usuarioId}`;

// chaves das pendências de agora (inclui os avisos da sincronização: "aviso:<id>")
let atuais: string[] = [];
let versao = 0;
const ouvintes = new Set<() => void>();
function publicar(chaves: string[]) {
  if (chaves.length === atuais.length && chaves.every((c, i) => c === atuais[i])) return;
  atuais = chaves;
  versao++;
  // avisa fora da leitura do banco (a leitura do contador é só-leitura)
  setTimeout(() => ouvintes.forEach((f) => f()), 0);
}
const assinar = (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f));

export interface EstadoPendencias {
  /** pendências ainda não vistas, por módulo */
  porModulo: Pendencias;
  /** avisos da sincronização ainda não vistos */
  avisos: number;
}

export function usePendencias(): EstadoPendencias {
  const { db, sessao, pode, matriz, viveiroId } = useApp();
  return (
    useLiveQuery(async () => {
      if (!sessao) return { porModulo: {}, avisos: 0 };
      const ler = (c: string) => db.colecao(c).toArray();
      const [doacoes, itens, baixas, plantios, matrizes, especies, pedidosAcesso, lotesSementes, movimentosSementes, lotesMudas, movimentosMudas, inventarios, monitoramentos] = await Promise.all(
        ['doacao', 'doacao_item', 'doacao_item_lote', 'plantio', 'matriz', 'especie', 'pedido_acesso', 'lote_sementes', 'movimento_sementes', 'lote_mudas', 'movimento_estoque_mudas', 'inventario', 'monitoramento'].map(ler),
      );
      const itensPorModulo = itensPendentes(
        { doacoes, itens, baixas, plantios, matrizes, especies, pedidosAcesso, lotesSementes, movimentosSementes, lotesMudas, movimentosMudas, inventarios, monitoramentos, hoje: new Date().toISOString().slice(0, 10) },
        { usuarioId: sessao.id, pode, viveiroId: viveiroId ?? undefined },
      );
      const avisos = (await db._avisos.filter((a) => !a.resolvido).toArray()).map((a) => `aviso:${String(a.id)}`);
      publicar([...Object.values(itensPorModulo).flat(), ...avisos]);
      const vistas = new Set(await db.lerMeta<string[]>(chaveVistas(sessao.id), []));
      const porModulo: Pendencias = {};
      for (const [rota, chaves] of Object.entries(itensPorModulo) as [Rota, string[]][]) {
        const n = chaves.filter((c) => !vistas.has(c)).length;
        if (n) porModulo[rota] = n;
      }
      return { porModulo, avisos: avisos.filter((c) => !vistas.has(c)).length };
      // `pode` muda a cada render; o que ele usa é a sessão, a tabela de permissões e o viveiro
    }, [db, sessao, matriz, viveiroId]) ?? { porModulo: {}, avisos: 0 }
  );
}

/** Marca como vistas as pendências de agora que começam com um destes prefixos (ex.: "doacao:<id>:"). */
export function marcarVisto(db: BancoCrads, usuarioId: string, prefixos: string[]) {
  // grava fora de qualquer leitura em andamento (liveQuery é só-leitura)
  return Dexie.ignoreTransaction(() => gravarVistos(db, usuarioId, prefixos));
}

async function gravarVistos(db: BancoCrads, usuarioId: string, prefixos: string[]) {
  const novas = atuais.filter((c) => prefixos.some((p) => c.startsWith(p)));
  if (!novas.length) return;
  const vistas = await db.lerMeta<string[]>(chaveVistas(usuarioId), []);
  if (novas.every((c) => vistas.includes(c))) return;
  // guarda só o que ainda é pendência: a lista não cresce para sempre
  const ainda = new Set(atuais);
  await db.gravarMeta(chaveVistas(usuarioId), [...new Set([...vistas.filter((c) => ainda.has(c)), ...novas])]);
}

/** Ao abrir a tela do item, a pendência dele deixa de contar no número vermelho. */
export function useMarcarVisto(...prefixos: (string | false | undefined)[]) {
  const { db, sessao } = useApp();
  const v = useSyncExternalStore(assinar, () => versao);
  const lista = prefixos.filter((p): p is string => !!p);
  const chave = lista.join('|');
  useEffect(() => {
    if (sessao && chave) void marcarVisto(db, sessao.id, chave.split('|'));
  }, [db, sessao, chave, v]);
}

/** Pedidos de mudas que esperam ação desta pessoa: marcados na lista com "Precisa de você". */
export function usePedidosQueEsperam(): Set<string> {
  const { db, sessao, pode, matriz, viveiroId } = useApp();
  return (
    useLiveQuery(async () => {
      if (!sessao) return new Set<string>();
      const [doacoes, itens, baixas] = await Promise.all(['doacao', 'doacao_item', 'doacao_item_lote'].map((c) => db.colecao(c).toArray()));
      return pedidosQueEsperam({ doacoes, itens, baixas }, { usuarioId: sessao.id, pode, viveiroId: viveiroId ?? undefined });
    }, [db, sessao, matriz, viveiroId]) ?? new Set<string>()
  );
}
