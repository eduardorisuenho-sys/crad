/** Mostra a miniatura guardada no aparelho (funciona sem internet). */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { fotoGuardadaOuBaixada } from '../dados/arquivos';

export function MiniaturaBlob({ blob, alt, tamanho = 96 }: { blob?: Blob; alt: string; tamanho?: number }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return <div className="miniatura vazia" style={{ width: tamanho, height: tamanho }} />;
  return <img className="miniatura" src={url} alt={alt} width={tamanho} height={tamanho} />;
}

export function Miniatura({ fotoId, alt, tamanho }: { fotoId: string; alt: string; tamanho?: number }) {
  const { db, sessao } = useApp();
  const m = useLiveQuery(() => db._miniaturas.get(fotoId), [fotoId]);
  // Foto tirada em outro aparelho: baixa do servidor quando houver internet.
  useEffect(() => {
    if (m === undefined) void fotoGuardadaOuBaixada(db, sessao, fotoId);
  }, [m, db, sessao, fotoId]);
  return <MiniaturaBlob blob={m?.blob} alt={alt} tamanho={tamanho} />;
}
