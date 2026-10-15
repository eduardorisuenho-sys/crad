/** Ajuste dos avisos: som ligado/desligado e permissão de notificação do aparelho. */
import { useEffect, useState } from 'react';
import { useApp } from '../contexto';
import { inscreverAvisosComAppFechado, ligarSom, pedirPermissaoNotificacao, permissaoNotificacao, somLigado, tocarSom, type ResultadoInscricao } from '../plataforma/notificar';
import { Icone } from './Icone';

export function AjusteAvisos() {
  const [som, setSom] = useState(somLigado());
  const { sessao } = useApp();
  const [permissao, setPermissao] = useState(permissaoNotificacao());
  const [fechado, setFechado] = useState<ResultadoInscricao | null>(null);

  // Já permitido: confere (e refaz, se preciso) a inscrição para avisos com o app fechado.
  useEffect(() => {
    if (permissao === 'granted' && sessao) void inscreverAvisosComAppFechado(sessao.servidor, sessao.token).then(setFechado);
  }, [permissao, sessao]);

  async function permitir() {
    const p = await pedirPermissaoNotificacao();
    setPermissao(p);
    if (p === 'granted' && sessao) setFechado(await inscreverAvisosComAppFechado(sessao.servidor, sessao.token));
  }
  return (
    <section className="cartao" data-testid="ajuste-avisos">
      <h2>Avisos com som</h2>
      <p className="dica">
        O app avisa com som quando chega um pedido de mudas, uma aprovação, uma retirada combinada ou um pedido de acesso. Com as notificações permitidas, o aviso
        chega <b>mesmo com o app fechado</b>, com o som de notificação do celular.
      </p>
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
      {permissao === 'granted' && (
        <p className="dica" data-testid="avisos-fechado">
          <Icone nome="certo" tamanho={18} /> Notificações do aparelho ligadas
          {fechado === 'ok' ? ': os avisos chegam mesmo com o app fechado.' : '.'}
        </p>
      )}
      {permissao === 'granted' && fechado === 'sem-suporte' && (
        <p className="dica">Este navegador não recebe avisos com o app fechado. No iPhone, instale o app na tela inicial (Compartilhar → Adicionar à Tela de Início).</p>
      )}
      {permissao === 'granted' && fechado === 'sem-servidor' && (
        <p className="dica">Não deu para ligar os avisos com o app fechado agora (sem internet). O app tenta de novo ao abrir.</p>
      )}
      {permissao === 'denied' && <p className="dica">As notificações estão bloqueadas. Libere nas configurações do navegador, em “Notificações”.</p>}
      {permissao === 'default' && (
        <button className="botao-principal" onClick={() => void permitir()}>
          Permitir notificações no aparelho
        </button>
      )}
    </section>
  );
}
