/** Rastreio completo (interno): de qualquer código, da matriz ao plantio. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { rastrearCadeia } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { carregarDadosRelatorio, nomesDe } from './dados';

export function RastreioInterno() {
  const { db } = useApp();
  const [params, setParams] = useSearchParams();
  const codigo = params.get('codigo') ?? '';
  const [texto, setTexto] = useState(codigo);
  const dados = useLiveQuery(() => carregarDadosRelatorio(db), [db]);
  const cadeia = dados && codigo ? rastrearCadeia(codigo, dados) : null;
  const nomes = dados ? nomesDe(dados) : new Map<string, string>();

  function buscar(e: FormEvent) {
    e.preventDefault();
    setParams(texto.trim() ? { codigo: texto.trim().toUpperCase() } : {});
  }

  const etapas = cadeia
    ? [
        { titulo: 'Matrizes', icone: 'arvore', itens: cadeia.matrizes.map((m) => ({ id: m.id, texto: String(m.codigo), detalhe: nomes.get(String(m.especie_id)), link: `/matrizes/${m.id}` })) },
        { titulo: 'Coletas', icone: 'semente', itens: cadeia.coletas.map((c) => ({ id: c.id, texto: String(c.data ?? '').slice(0, 10).split('-').reverse().join('/'), detalhe: c.quantidade ? `${mostrarNumero(c.quantidade)} ${c.unidade ?? ''}` : '', link: '' })) },
        { titulo: 'Lotes de sementes', icone: 'semente', itens: cadeia.lotesSementes.map((l) => ({ id: l.id, texto: String(l.codigo), detalhe: nomes.get(String(l.especie_id)), link: `/coleta/lotes/${l.id}` })) },
        { titulo: 'Lotes de mudas', icone: 'muda', itens: cadeia.lotesMudas.map((l) => ({ id: l.id, texto: String(l.codigo), detalhe: nomes.get(String(l.especie_id)), link: `/viveiro/lotes/${l.id}` })) },
        { titulo: 'Doações', icone: 'doacao', itens: cadeia.doacoes.map((d) => ({ id: d.id, texto: String(d.codigo), detalhe: String(d.situacao ?? ''), link: `/doacao/${d.id}` })) },
        { titulo: 'Plantios', icone: 'plantio', itens: cadeia.plantios.map((p) => ({ id: p.id, texto: String(p.data ?? '').slice(0, 10).split('-').reverse().join('/'), detalhe: String(cadeia.doacoes.find((d) => d.id === p.doacao_id)?.codigo ?? ''), link: `/pos-plantio/${p.id}` })) },
      ]
    : [];

  return (
    <Tela titulo="Rastrear código">
      <p className="dica">Digite o código de uma matriz (MT), lote de sementes (LS), lote de mudas (LM) ou doação (DO).</p>
      <form className="linha-form" onSubmit={buscar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: LM-2026-045-A" aria-label="Código" autoCapitalize="characters" />
        <button className="botao-secundario">Rastrear</button>
      </form>
      {codigo && dados && !cadeia && <p className="erro">Código {codigo} não encontrado neste aparelho.</p>}
      {cadeia && (
        <ol className="cadeia" data-testid="cadeia">
          {etapas.map((e) => (
            <li key={e.titulo}>
              <Icone nome={e.icone} />
              <div>
                <strong>{e.titulo}</strong>
                {!e.itens.length && <small> — nenhum</small>}
                <ul className="lista-simples">
                  {e.itens.map((i) => (
                    <li key={i.id}>
                      {i.link ? <Link to={i.link}>{i.texto}</Link> : i.texto} {i.detalhe && <small>{i.detalhe}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Tela>
  );
}
