/** Fotos das mudas de um lote: aparecem no catálogo (a mais recente, se a espécie não tiver foto própria). */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { useApp } from '../../contexto';
import { gravarFoto, prepararFoto } from '../matrizes/fotos';

/** `editando`: dentro do "Editar o lote de mudas", com o botão de apagar cada foto (vai para a lixeira). */
export function FotosLote({ loteId, viveiroId, editando = false }: { loteId: string; viveiroId?: string; editando?: boolean }) {
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

  async function apagar(fotoId: string) {
    if (!confirm('Apagar esta foto? Ela sai do lote e do catálogo (fica na lixeira).')) return;
    await repo.excluir('foto', fotoId);
  }

  const Caixa = editando ? 'div' : 'section';
  return (
    <Caixa className={editando ? 'fotos-edicao' : 'cartao'} data-testid={editando ? 'fotos-lote-edicao' : 'fotos-lote'}>
      {editando ? <strong>Fotos das mudas</strong> : <h2>Fotos das mudas</h2>}
      {fotos.length ? (
        <div className="galeria">
          {fotos.map((f) =>
            editando ? (
              <figure key={f.id}>
                <Miniatura fotoId={f.id} alt="Foto das mudas" data={f} />
                <button type="button" className="link apagar-foto" onClick={() => void apagar(f.id)}>
                  <Icone nome="lixo" tamanho={16} /> Apagar
                </button>
              </figure>
            ) : (
              <Miniatura key={f.id} fotoId={f.id} alt="Foto das mudas" data={f} />
            ),
          )}
        </div>
      ) : (
        <p className="dica">Tire uma foto das mudas: ela aparece no catálogo para quem pede mudas.</p>
      )}
      <BotaoFoto aoEscolher={(f) => void tirar(f)} className="botao-secundario">
        <Icone nome="camera" /> {salvando ? 'Guardando…' : editando ? 'Inserir foto das mudas' : 'Tirar foto das mudas'}
      </BotaoFoto>
    </Caixa>
  );
}
