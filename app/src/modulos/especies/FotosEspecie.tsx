/** Fotos da espécie por parte da planta (aparecem no catálogo e no assistente). */
import { useLiveQuery } from 'dexie-react-hooks';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { useApp } from '../../contexto';
import { comprimirFoto } from '../../plataforma/imagem';
import { rotuloParte } from './rotulos';

const PARTES = [
  { parte: 'muda', rotulo: 'Muda' },
  { parte: 'arvore', rotulo: 'Árvore' },
  { parte: 'folha', rotulo: 'Folha' },
  { parte: 'casca', rotulo: 'Casca' },
  { parte: 'flor', rotulo: 'Flor' },
  { parte: 'fruto', rotulo: 'Fruto' },
  { parte: 'semente', rotulo: 'Semente' },
];

export function FotosEspecie({ especieId, editavel }: { especieId: string; editavel: boolean }) {
  const { db, repo } = useApp();
  const fotos = useLiveQuery(async () => (await db.colecao('especie_foto').where('especie_id').equals(especieId).toArray()).filter((f) => !f.excluido), [especieId]) ?? [];

  async function adicionar(arquivo: File, parte: string) {
    const c = await comprimirFoto(arquivo);
    const reg = await repo.salvar('especie_foto', { especie_id: especieId, parte, tirada_em: new Date().toISOString() });
    await db._miniaturas.put({ id: reg.id, blob: c.miniatura });
    await repo.anexarArquivo('especie_foto', reg.id, 'arquivo', c.foto, `${parte}.jpg`);
    await repo.anexarArquivo('especie_foto', reg.id, 'miniatura', c.miniatura, `${parte}-mini.jpg`);
  }

  return (
    <section className="cartao">
      <h2>Fotos</h2>
      {fotos.length > 0 && (
        <div className="galeria">
          {fotos.map((f) => (
            <figure key={f.id}>
              <Miniatura fotoId={f.id} alt={rotuloParte(f.parte)} data={f} />
              <figcaption>
                {rotuloParte(f.parte)}
                {editavel && (
                  <button type="button" className="link" onClick={() => void repo.excluir('especie_foto', f.id)}>
                    {' '}
                    remover
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {editavel && (
        <div className="meses" style={{ marginTop: 10 }}>
          {PARTES.map((p) => (
            <BotaoFoto key={p.parte} className="chip" aoEscolher={(f) => void adicionar(f, p.parte)}>
              <Icone nome="mais" tamanho={18} /> {p.rotulo}
            </BotaoFoto>
          ))}
        </div>
      )}
    </section>
  );
}
