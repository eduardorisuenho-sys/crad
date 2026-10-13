/** Assistente avulso (para estudar ou conferir uma árvore sem cadastrar matriz). */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { Assistente, type ResultadoIdentificacao } from './Assistente';
import { BotaoLens } from '../../componentes/BotaoLens';
import { comprimirFoto } from '../../plataforma/imagem';
import { ROTULO_CERTEZA as GRAU } from '../matrizes/ListaMatrizes';


export function TelaIdentificar() {
  const { db } = useApp();
  const [resultado, setResultado] = useState<ResultadoIdentificacao | null>(null);
  const [rodada, setRodada] = useState(0);
  const especie = useLiveQuery(() => (resultado?.especie_id ? db.colecao('especie').get(resultado.especie_id) : undefined), [resultado?.especie_id]);

  const [foto, setFoto] = useState<Blob | null>(null);
  return (
    <Tela titulo="Identificar árvore">
      <details className="cartao" data-testid="por-foto">
        <summary>Pesquisar por foto (Google Lens)</summary>
        <label className="botao-secundario botao-arquivo">
          Tirar foto da árvore
          <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => e.target.files?.[0] && setFoto((await comprimirFoto(e.target.files[0])).foto)} />
        </label>
        {foto && <BotaoLens obterFoto={async () => foto} />}
      </details>
      {resultado ? (
        <div className="vazio">
          <p data-testid="resultado">
            {especie ? <i>{String(especie.nome_cientifico)}</i> : 'Espécie a identificar'} · {GRAU[resultado.grau_certeza]}
          </p>
          {especie && (
            <Link className="botao-secundario" to={`/especies/${especie.id}`}>
              Ver ficha
            </Link>
          )}
          <button
            className="botao-principal"
            onClick={() => {
              setResultado(null);
              setRodada(rodada + 1);
            }}
          >
            Identificar outra
          </button>
        </div>
      ) : (
        <Assistente key={rodada} contexto={{ mes: new Date().getMonth() + 1 }} onEscolher={setResultado} />
      )}
    </Tela>
  );
}
