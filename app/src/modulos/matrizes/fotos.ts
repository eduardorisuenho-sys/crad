/** Grava fotos: registro + arquivo comprimido na fila + miniatura no aparelho. */
import type { BancoCrads } from '../../dados/db';
import type { Repositorio } from '../../dados/repositorio';
import type { PosicaoGps } from '../../plataforma/gps';
import { comprimirFoto } from '../../plataforma/imagem';

export interface FotoPendente {
  parte: string;
  foto: Blob;
  miniatura: Blob;
  gps: PosicaoGps | null;
  tirada_em: string;
}

export async function prepararFoto(arquivo: File, parte: string, gps: PosicaoGps | null): Promise<FotoPendente> {
  const c = await comprimirFoto(arquivo);
  return { parte, foto: c.foto, miniatura: c.miniatura, gps, tirada_em: new Date().toISOString() };
}

export async function gravarFoto(db: BancoCrads, repo: Repositorio, entidade: string, registroId: string, viveiroId: string | undefined, f: FotoPendente) {
  const reg = await repo.salvar('foto', {
    entidade,
    registro_id: registroId,
    parte: f.parte,
    lat: f.gps?.lat ?? null,
    lon: f.gps?.lon ?? null,
    tirada_em: f.tirada_em,
    ...(viveiroId ? { viveiro_id: viveiroId } : {}),
  });
  await db._miniaturas.put({ id: reg.id, blob: f.miniatura });
  await repo.anexarArquivo('foto', reg.id, 'arquivo', f.foto, `${entidade}-${f.parte}.jpg`);
  await repo.anexarArquivo('foto', reg.id, 'miniatura', f.miniatura, `${entidade}-${f.parte}-mini.jpg`);
  return reg;
}
