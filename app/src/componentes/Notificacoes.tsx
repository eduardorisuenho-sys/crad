/** Avisos que chegam com som (pedido de mudas, aprovação…): tocar abre a tela; o × fecha. */
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexto';
import { Icone } from './Icone';

export function Notificacoes() {
  const { notificacoes, fecharNotificacao } = useApp();
  const navegar = useNavigate();
  if (!notificacoes.length) return null;
  return (
    <div className="notificacoes" role="status" aria-live="polite" data-testid="notificacoes">
      {notificacoes.map((n) => (
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
    </div>
  );
}
