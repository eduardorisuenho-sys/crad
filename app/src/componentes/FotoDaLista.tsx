/**
 * Foto pequena no começo de um item de lista, no lugar do desenho: o tronco da matriz,
 * a semente da coleta. Procura nos registros dados (em ordem) a parte preferida; sem
 * foto, fica o desenho. As fotos já estão no aparelho (funciona sem internet).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import type { Registro } from '@crads/dominio';
import { useApp } from '../contexto';
import { Icone } from './Icone';
import { Miniatura } from './Miniatura';

/** Partes preferidas para cada lista (a primeira que tiver foto vale). */
export const PARTES_MATRIZ = ['tronco', 'casca', 'arvore'];
export const PARTES_COLETA = ['semente', 'fruto'];

/** Todas as fotos ativas dos registros, por registro. */
export function useFotosDe(ids: string[]): Map<string, Registro[]> | undefined {
  const { db } = useApp();
  const chave = ids.join(',');
  return useLiveQuery(async () => {
    const fotos = (await db.colecao('foto').where('registro_id').anyOf(ids).toArray()).filter((f) => !f.excluido);
    const m = new Map<string, Registro[]>();
    for (const f of fotos) m.set(String(f.registro_id), [...(m.get(String(f.registro_id)) ?? []), f]);
    return m;
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A melhor foto: percorre os registros em ordem e, em cada um, as partes preferidas. */
export function escolherFoto(fotos: Map<string, Registro[]> | undefined, registros: unknown[], partes: string[]): Registro | undefined {
  for (const id of registros) {
    const doRegistro = fotos?.get(String(id ?? '')) ?? [];
    for (const p of partes) {
      const f = doRegistro.find((x) => x.parte === p);
      if (f) return f;
    }
  }
  return undefined;
}

export function FotoDaLista({ foto, icone, alt }: { foto: Registro | undefined; icone: string; alt: string }) {
  if (!foto) return <Icone nome={icone} />;
  return (
    <span className="foto-lista">
      <Miniatura fotoId={foto.id} alt={alt} tamanho={56} data={foto} />
    </span>
  );
}
