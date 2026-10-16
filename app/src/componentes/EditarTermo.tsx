/**
 * Administrador: texto do termo de compromisso e declaração que quem pede
 * mudas aceita. Os marcadores entre colchetes são preenchidos com os dados
 * do pedido. Vale para os próximos pedidos (os já feitos guardam o texto aceito).
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TERMO_COMPROMISSO_PADRAO } from '@crads/dominio';
import { useApp } from '../contexto';
import { Icone } from './Icone';

export function EditarTermo() {
  const { db, repo } = useApp();
  const atual = useLiveQuery(async () => (await db.colecao('parametro').toArray()).find((p) => p.chave === 'termo_compromisso' && !p.viveiro_id && !p.excluido), [db]);
  const [texto, setTexto] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (texto === null && atual !== undefined) setTexto(String(atual?.valor ?? TERMO_COMPROMISSO_PADRAO));
  }, [atual, texto]);
  // ainda carregando do aparelho
  const valor = texto ?? String(atual?.valor ?? TERMO_COMPROMISSO_PADRAO);

  async function salvar(novo: string) {
    setMsg('');
    if (!novo.trim()) return setMsg('O termo não pode ficar vazio.');
    await repo.salvar('parametro', { chave: 'termo_compromisso', valor: novo, descricao: 'Termo de compromisso e declaração' }, atual?.id);
    setTexto(novo);
    setMsg('Termo salvo. Vale para os próximos pedidos.');
  }

  return (
    <details className="cartao" data-testid="editar-termo">
      <summary>Termo de compromisso dos pedidos</summary>
      <p className="dica">
        Quem pede mudas lê e aceita este termo antes de enviar o pedido. O app preenche sozinho: [NOME], [ESPÉCIES E QUANTITATIVO], [COORDENADAS UTM/DECIMAIS], [ÁREA TOTAL] e [DATA]. Os pedidos já feitos guardam o texto que foi aceito.
      </p>
      <label className="formulario">
        Texto do termo
        <textarea rows={16} value={valor} onChange={(e) => setTexto(e.target.value)} aria-label="Texto do termo" />
      </label>
      {msg && <p className="mensagem">{msg}</p>}
      <div className="acoes">
        <button type="button" className="botao-principal" onClick={() => void salvar(valor)}>
          <Icone nome="certo" /> Salvar termo
        </button>
        <button type="button" className="botao-secundario" onClick={() => void salvar(TERMO_COMPROMISSO_PADRAO)}>
          Voltar ao texto original
        </button>
      </div>
    </details>
  );
}
