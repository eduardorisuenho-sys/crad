/**
 * Depois da aprovação: o viveiro e quem pediu se falam para combinar o dia da
 * retirada. O viveiro vê o telefone de quem pediu (com internet, fica
 * registrado); quem pediu vê o telefone e o endereço do viveiro.
 */
import { useState } from 'react';
import type { Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';

const data = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') : '');

/** Só os números, com o 55 do Brasil, para o link do WhatsApp. */
export function numeroWhatsApp(telefone: string): string {
  const n = telefone.replace(/\D/g, '');
  if (!n) return '';
  return n.startsWith('55') && n.length > 11 ? n : `55${n}`;
}

function Contato({ nome, telefone }: { nome: string; telefone: string }) {
  if (!telefone) return <p className="dica">{nome}: sem telefone cadastrado.</p>;
  return (
    <div className="contato" data-testid="contato">
      <p>
        <strong>{nome}</strong>
        <br />
        {telefone}
      </p>
      <div className="acoes">
        <a className="botao-secundario" href={`tel:${telefone.replace(/[^\d+]/g, '')}`}>
          Ligar
        </a>
        <a className="botao-principal" href={`https://wa.me/${numeroWhatsApp(telefone)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  );
}

export function CombinarRetirada({ doacao, viveiro }: { doacao: Registro; viveiro?: Registro }) {
  const { repo, pode, sessao } = useApp();
  const doViveiro = pode('retirada', doacao.viveiro_id);
  const [contato, setContato] = useState<{ nome: string; telefone: string } | null>(null);
  const [erro, setErro] = useState('');
  const [dia, setDia] = useState(String(doacao.retirada_combinada ?? '').slice(0, 10));
  const [obs, setObs] = useState(String(doacao.retirada_obs ?? ''));
  const [salvo, setSalvo] = useState(false);

  async function verContato() {
    setErro('');
    const r = await fetch(`${sessao!.servidor}/api/crads/doacao/${doacao.id}/contato`, { headers: { authorization: sessao!.token } }).catch(() => null);
    if (!r) return setErro('Sem internet. O telefone de quem pediu só aparece com conexão.');
    const j = await r.json();
    if (!r.ok) return setErro(j.message ?? 'Não foi possível ver o contato.');
    setContato(j);
  }

  async function salvar() {
    await repo.salvar('doacao', { retirada_combinada: dia || null, retirada_obs: obs.trim() || null }, doacao.id);
    setSalvo(true);
  }

  return (
    <section className="cartao" data-testid="combinar-retirada">
      <h2>
        <Icone nome="doacao" tamanho={22} /> Combinar a retirada
      </h2>
      {doacao.retirada_combinada ? (
        <p className="mensagem" data-testid="dia-combinado">
          Retirada combinada para {data(doacao.retirada_combinada)}
          {doacao.retirada_obs ? ` · ${String(doacao.retirada_obs)}` : ''}
        </p>
      ) : (
        <p className="dica">{doViveiro ? 'Fale com quem pediu e marque o dia da retirada.' : 'Fale com o viveiro para marcar o dia de buscar as mudas.'}</p>
      )}

      {doViveiro ? (
        <>
          {contato ? (
            <Contato nome={contato.nome || 'Quem pediu'} telefone={contato.telefone} />
          ) : (
            <button className="botao-principal botao-telefone" onClick={() => void verContato()}>
              <Icone nome="telefone" /> Ver telefone de quem pediu
            </button>
          )}
          {erro && <p className="erro">{erro}</p>}
          <div className="formulario combinar-campos">
            <label>
              Dia combinado
              <input type="date" value={dia} onChange={(e) => (setDia(e.target.value), setSalvo(false))} />
            </label>
            <label>
              Observação (horário, quem vem buscar…)
              <input value={obs} onChange={(e) => (setObs(e.target.value), setSalvo(false))} />
            </label>
            <button className="botao-secundario" onClick={() => void salvar()}>
              <Icone nome="certo" /> {salvo ? 'Salvo' : 'Salvar dia combinado'}
            </button>
          </div>
        </>
      ) : (
        <>
          <Contato nome={String(viveiro?.nome ?? 'Viveiro')} telefone={String(viveiro?.telefone ?? '')} />
          {viveiro?.endereco ? <p className="dica">Endereço: {String(viveiro.endereco)}</p> : null}
        </>
      )}
    </section>
  );
}
