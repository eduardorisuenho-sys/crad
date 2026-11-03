/**
 * Tela inicial: pede para ligar os avisos com som (mesmo com o app fechado e a
 * tela apagada). O navegador só deixa pedir a permissão depois de um toque, e
 * sem ela o aparelho nunca fica inscrito para os avisos do servidor.
 */
import { useState } from 'react';
import { useApp } from '../contexto';
import { inscreverAvisosComAppFechado, pedirPermissaoNotificacao, permissaoNotificacao } from '../plataforma/notificar';
import { Icone } from './Icone';

const CHAVE_DEPOIS = 'crads_avisos_depois';

function adiadoAgora(): boolean {
  try {
    return Number(localStorage.getItem(CHAVE_DEPOIS) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function LigarAvisos() {
  const { sessao } = useApp();
  const [permissao, setPermissao] = useState(permissaoNotificacao());
  const [adiado, setAdiado] = useState(adiadoAgora());
  if (!sessao || permissao !== 'default' || adiado) return null;
  return (
    <section className="cartao ligar-avisos" data-testid="ligar-avisos">
      <h2>
        <Icone nome="aviso" tamanho={22} /> Ligue os avisos com som
      </h2>
      <p className="dica">Pedido de mudas, aprovação, retirada: o celular toca mesmo com o app fechado e a tela apagada.</p>
      <button
        className="botao-principal"
        onClick={async () => {
          const p = await pedirPermissaoNotificacao();
          setPermissao(p);
          if (p === 'granted') void inscreverAvisosComAppFechado(sessao.servidor, sessao.token);
        }}
      >
        Ligar os avisos
      </button>
      <button
        className="botao-secundario"
        onClick={() => {
          // pergunta de novo daqui a 7 dias
          try {
            localStorage.setItem(CHAVE_DEPOIS, String(Date.now() + 7 * 24 * 3600 * 1000));
          } catch {
            /* sem armazenamento: só esconde agora */
          }
          setAdiado(true);
        }}
      >
        Agora não
      </button>
    </section>
  );
}
