/** Conflitos e recusas da sincronização, para a pessoa decidir. */
import { useLiveQuery } from 'dexie-react-hooks';
import type { ConflitoCampo, Operacao } from '@crads/dominio';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';
import type { Aviso } from '../dados/db';
import { useMarcarVisto } from '../dados/usePendencias';

const mostrar = (v: unknown) => (v === null || v === undefined || v === '' ? '(vazio)' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function Avisos() {
  const { db, repo } = useApp();
  // abrir esta tela tira a pendência do número vermelho
  useMarcarVisto('aviso:');
  const avisos = useLiveQuery(() => db._avisos.filter((a) => !a.resolvido).toArray(), [db]) ?? [];

  const resolver = (a: Aviso) => db._avisos.update(a.id, { resolvido: true });

  async function usarOMeu(a: Aviso) {
    const { conflitos } = a.detalhes as { conflitos: ConflitoCampo[] };
    const dados: Record<string, unknown> = {};
    for (const c of conflitos) if (c.campo !== '(exclusão)') dados[c.campo] = c.valor_aparelho;
    await repo.salvar(a.colecao, dados, a.registro_id);
    await resolver(a);
  }

  async function descartar(a: Aviso) {
    const { operacao } = a.detalhes as { operacao: Operacao };
    if (operacao.tipo === 'criar') await db.colecao(a.colecao).delete(a.registro_id);
    await resolver(a);
  }

  return (
    <Tela titulo="Problemas no envio">
      {!avisos.length && (
        <div className="vazio">
          <Icone nome="certo" tamanho={72} />
          <p>Nenhum aviso.</p>
        </div>
      )}
      <ul className="lista">
        {avisos.map((a) => (
          <li key={a.id} className={`cartao aviso-${a.tipo}`}>
            <p>
              <Icone nome="aviso" tamanho={22} /> {a.mensagem}
            </p>
            {a.tipo === 'conflito' &&
              (a.detalhes as { conflitos: ConflitoCampo[] }).conflitos.map((c) => (
                <dl key={c.campo} className="comparacao">
                  <dt>{c.campo.replace(/_/g, ' ')}</dt>
                  <dd>
                    Ficou: <strong>{mostrar(c.valor_servidor)}</strong>
                  </dd>
                  <dd>
                    Você tinha posto: <strong>{mostrar(c.valor_aparelho)}</strong>
                  </dd>
                </dl>
              ))}
            <div className="acoes">
              {a.tipo === 'conflito' && (
                <button className="botao-secundario" onClick={() => void usarOMeu(a)}>
                  Usar o meu
                </button>
              )}
              {a.tipo === 'rejeitada' && (
                <button className="botao-secundario" onClick={() => void descartar(a)}>
                  Descartar
                </button>
              )}
              <button className="botao-principal" onClick={() => void resolver(a)}>
                {a.tipo === 'conflito' ? 'Deixar como ficou' : 'Entendi'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Tela>
  );
}
