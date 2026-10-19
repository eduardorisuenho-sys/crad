/** Fotos das mudas de um lote: aparecem no catálogo (a mais recente, se a espécie não tiver foto própria). */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { useApp } from '../../contexto';
import { gravarFoto, prepararFoto } from '../matrizes/fotos';

export function FotosLote({ loteId, viveiroId }: { loteId: string; viveiroId?: string }) {
  const { db, repo } = useApp();
  const [salvando, setSalvando] = useState(false);
  const fotos = useLiveQuery(async () => (await db.colecao('foto').where('registro_id').equals(loteId).toArray()).filter((f) => !f.excluido && f.entidade === 'lote_mudas'), [loteId]) ?? [];

  async function tirar(arquivo: File) {
    setSalvando(true);
    try {
      await gravarFoto(db, repo, 'lote_mudas', loteId, viveiroId, await prepararFoto(arquivo, 'muda', null));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="cartao" data-testid="fotos-lote">
      <h2>Fotos das mudas</h2>
      {fotos.length ? (
        <div className="galeria">
          {fotos.map((f) => (
            <Miniatura key={f.id} fotoId={f.id} alt="Foto das mudas" data={f} />
          ))}
        </div>
      ) : (
        <p className="dica">Tire uma foto das mudas: ela aparece no catálogo para quem pede mudas.</p>
      )}
      <BotaoFoto aoEscolher={(f) => void tirar(f)} className="botao-secundario">
        <Icone nome="camera" /> {salvando ? 'Guardando…' : 'Tirar foto das mudas'}
      </BotaoFoto>
    </section>
  );
}
