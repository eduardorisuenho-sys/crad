/** Mostra a miniatura guardada no aparelho (funciona sem internet). */
import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { fotoGuardadaOuBaixada } from '../dados/arquivos';
import { dataDaFoto } from '@crads/dominio';

/** Data da foto para o carimbo (dd/mm/aaaa). */
export function dataCarimbo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return '';
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

/** Toda foto mostra a data em que foi tirada, por cima da imagem. */
function ComData({ data, children }: { data?: unknown; children: ReactNode }) {
  const texto = dataCarimbo(data);
  if (!texto) return <>{children}</>;
  return (
    <span className="foto-datada">
      {children}
      <span className="carimbo-data" data-testid="data-foto">
        {texto}
      </span>
    </span>
  );
}

export function MiniaturaBlob({ blob, alt, tamanho = 96, data }: { blob?: Blob; alt: string; tamanho?: number; data?: unknown }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return <div className="miniatura vazia" style={{ width: tamanho, height: tamanho }} />;
  return (
    <ComData data={data}>
      <img className="miniatura" src={url} alt={alt} width={tamanho} height={tamanho} />
    </ComData>
  );
}

/** `data`: o registro da foto (usa tirada_em, ou a data do cadastro) ou a própria data. */
export function Miniatura({ fotoId, alt, tamanho, data }: { fotoId: string; alt: string; tamanho?: number; data: Record<string, unknown> | string | undefined }) {
  const { db, sessao } = useApp();
  const m = useLiveQuery(() => db._miniaturas.get(fotoId), [fotoId]);
  // Foto tirada em outro aparelho: baixa do servidor quando houver internet.
  useEffect(() => {
    if (m === undefined) void fotoGuardadaOuBaixada(db, sessao, fotoId);
  }, [m, db, sessao, fotoId]);
  return <MiniaturaBlob blob={m?.blob} alt={alt} tamanho={tamanho} data={typeof data === 'object' && data ? dataDaFoto(data) : data} />;
}
