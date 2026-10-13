/** Ajuste dos avisos: som ligado/desligado e permissão de notificação do aparelho. */
import { useState } from 'react';
import { ligarSom, pedirPermissaoNotificacao, permissaoNotificacao, somLigado, tocarSom } from '../plataforma/notificar';
import { Icone } from './Icone';

export function AjusteAvisos() {
  const [som, setSom] = useState(somLigado());
  const [permissao, setPermissao] = useState(permissaoNotificacao());
  return (
    <section className="cartao" data-testid="ajuste-avisos">
      <h2>Avisos com som</h2>
      <p className="dica">O app toca um som e mostra um aviso quando chega um pedido de mudas, uma aprovação, uma retirada combinada ou uma matriz para validar.</p>
      <label className="linha-check">
        <input
          type="checkbox"
          checked={som}
          onChange={(e) => {
            ligarSom(e.target.checked);
            setSom(e.target.checked);
            if (e.target.checked) tocarSom();
          }}
        />{' '}
        Tocar som nos avisos
      </label>
      <button className="botao-secundario" onClick={tocarSom}>
        Ouvir o som
      </button>
      {permissao === 'granted' ? (
        <p className="dica">
          <Icone nome="certo" tamanho={18} /> Notificações do aparelho ligadas.
        </p>
      ) : permissao === 'denied' ? (
        <p className="dica">As notificações estão bloqueadas. Libere nas configurações do navegador, em “Notificações”.</p>
      ) : permissao === 'indisponivel' ? null : (
        <button className="botao-principal" onClick={async () => setPermissao(await pedirPermissaoNotificacao())}>
          Permitir notificações no aparelho
        </button>
      )}
    </section>
  );
}
