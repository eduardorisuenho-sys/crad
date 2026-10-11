/** Escolhe em qual viveiro a pessoa está trabalhando (separa coleta, estoque e produção). */
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';

export function useViveirosDoUsuario() {
  const { db, sessao } = useApp();
  return useLiveQuery(async () => {
    const todos = (await db.colecao('viveiro').toArray()).filter((v) => !v.excluido && v.ativo !== false);
    if (!sessao) return [];
    if (sessao.gestorGeral) return todos;
    return todos.filter((v) => v.id in sessao.perfisPorViveiro);
  }, [sessao?.id]);
}

export function EscolherViveiro() {
  const { escolherViveiro, viveiroId } = useApp();
  const viveiros = useViveirosDoUsuario() ?? [];
  const navegar = useNavigate();
  return (
    <Tela titulo="Em qual viveiro?" voltar={!!viveiroId}>
      <div className="lista-grande">
        {viveiros.map((v) => (
          <button
            key={v.id}
            className={`botao-grande ${v.id === viveiroId ? 'ativo' : ''}`}
            onClick={async () => {
              await escolherViveiro(v.id);
              navegar('/');
            }}
          >
            <Icone nome="viveiro" tamanho={40} />
            <span>{String(v.nome)}</span>
          </button>
        ))}
        {!viveiros.length && <p className="vazio">Aguardando a lista de viveiros. Conecte-se à internet uma vez.</p>}
      </div>
    </Tela>
  );
}
