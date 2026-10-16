/**
 * Avisos que chegam com som (pedido de mudas, aprovação…): tocar abre a tela;
 * o × fecha. Mostra um aviso por vez (o mais novo) para não cobrir a tela; os
 * outros ficam em "Ver mais avisos".
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexto';
import { Icone } from './Icone';

export function Notificacoes() {
  const { notificacoes, fecharNotificacao } = useApp();
  const navegar = useNavigate();
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    if (notificacoes.length <= 1) setTodas(false);
  }, [notificacoes.length]);

  if (!notificacoes.length) return null;
  const visiveis = todas ? [...notificacoes].reverse() : notificacoes.slice(-1);
  const outras = notificacoes.length - 1;
  return (
    <div className="notificacoes" role="status" aria-live="polite" data-testid="notificacoes">
      {visiveis.map((n) => (
        <div key={n.id} className="notificacao">
          <button
            className="notificacao-corpo"
            onClick={() => {
              fecharNotificacao(n.id);
              navegar(n.rota);
            }}
          >
            <Icone nome="aviso" tamanho={22} />
            <span>
              <strong>{n.titulo}</strong>
              <small>{n.texto}</small>
            </span>
          </button>
          <button className="notificacao-fechar" aria-label="Fechar aviso" onClick={() => fecharNotificacao(n.id)}>
            ×
          </button>
        </div>
      ))}
      {outras > 0 && (
        <div className="notificacoes-mais">
          {!todas && (
            <button className="chip" onClick={() => setTodas(true)}>
              Ver mais {outras} {outras === 1 ? 'aviso' : 'avisos'}
            </button>
          )}
          <button className="chip" onClick={() => notificacoes.forEach((n) => fecharNotificacao(n.id))}>
            Fechar todos
          </button>
        </div>
      )}
    </div>
  );
}
