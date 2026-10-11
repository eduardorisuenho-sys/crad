/** Assistente avulso (para estudar ou conferir uma árvore sem cadastrar matriz). */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { Assistente, type ResultadoIdentificacao } from './Assistente';

const GRAU: Record<string, string> = { certo: 'certo', provavel: 'provável', a_identificar: 'a identificar' };

export function TelaIdentificar() {
  const { db } = useApp();
  const [resultado, setResultado] = useState<ResultadoIdentificacao | null>(null);
  const [rodada, setRodada] = useState(0);
  const especie = useLiveQuery(() => (resultado?.especie_id ? db.colecao('especie').get(resultado.especie_id) : undefined), [resultado?.especie_id]);

  return (
    <Tela titulo="Identificar árvore">
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
