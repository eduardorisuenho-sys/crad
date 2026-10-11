/** Catálogo público: espécies com mudas prontas para doação, sem login. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizarBusca, type ItemCatalogo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { lerCatalogo, servidorPublico, urlFoto } from './api';
import { Pagina } from './Pagina';

export function Catalogo() {
  const { sessao } = useApp();
  const servidor = servidorPublico(sessao?.servidor);
  const navegar = useNavigate();
  const [itens, setItens] = useState<ItemCatalogo[] | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [viveiro, setViveiro] = useState('');
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    lerCatalogo(servidor)
      .then((r) => {
        setItens(r.dados.itens);
        setGuardado(r.guardado ? r.em : null);
      })
      .catch((e) => setErro((e as Error).message));
  }, [servidor]);

  const viveiros = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itens ?? []) for (const v of i.por_viveiro) m.set(v.viveiro_id, v.viveiro);
    return [...m.entries()];
  }, [itens]);
  const lista = (itens ?? []).filter((i) => {
    if (viveiro && !i.por_viveiro.some((v) => v.viveiro_id === viveiro)) return false;
    if (!busca) return true;
    return normalizarBusca(`${i.nomes_populares.join(' ')} ${i.nome_cientifico}`).includes(normalizarBusca(busca));
  });

  function rastrear(e: FormEvent) {
    e.preventDefault();
    if (codigo.trim()) navegar(`/rastreio/${encodeURIComponent(codigo.trim().toUpperCase())}`);
  }

  return (
    <Pagina titulo="Catálogo de mudas">
      <p className="dica">Mudas nativas prontas para doação. A quantidade já desconta as mudas reservadas para pedidos aprovados.</p>
      {guardado && (
        <p className="mensagem alerta">
          <Icone nome="semSinal" tamanho={20} /> Sem internet: mostrando o catálogo de {new Date(guardado).toLocaleString('pt-BR')}.
        </p>
      )}
      {erro && <p className="erro">{erro}</p>}
      <input className="campo-busca" type="search" placeholder="Buscar pelo nome da árvore" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no catálogo" />
      {viveiros.length > 1 && (
        <div className="filtros" role="group" aria-label="Viveiro">
          <button className={`chip ${!viveiro ? 'ativo' : ''}`} onClick={() => setViveiro('')}>
            Todos os viveiros
          </button>
          {viveiros.map(([id, nome]) => (
            <button key={id} className={`chip ${viveiro === id ? 'ativo' : ''}`} onClick={() => setViveiro(id)}>
              {nome}
            </button>
          ))}
        </div>
      )}
      {itens === null && !erro && <p className="vazio">Carregando…</p>}
      <ul className="grade-catalogo">
        {lista.map((i) => {
          const qtd = viveiro ? i.por_viveiro.find((v) => v.viveiro_id === viveiro)?.disponivel ?? 0 : i.total;
          return (
            <li key={i.especie_id}>
              <Link to={`/catalogo/${i.especie_id}`} className="cartao-especie">
                {i.foto ? <img src={urlFoto(servidor, i.foto)} alt="" loading="lazy" /> : <span className="sem-foto"><Icone nome="muda" tamanho={48} /></span>}
                <strong>{i.nomes_populares[0] ?? i.nome_cientifico}</strong>
                <small>
                  <i>{i.nome_cientifico}</i>
                </small>
                <span className="selo ok">{qtd} mudas</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {itens && !lista.length && <p className="vazio">Nenhuma muda pronta {busca ? 'com esse nome' : 'no momento'}.</p>}
      <form className="cartao formulario" onSubmit={rastrear}>
        <h2>Rastrear um lote</h2>
        <label>
          Código do lote de mudas
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="LM-2026-045-A" />
        </label>
        <button className="botao-secundario">Ver de onde vieram as sementes</button>
      </form>
      <Link to="/transparencia" className="botao-grande">
        <Icone nome="relatorio" /> Resultados das doações (transparência)
      </Link>
    </Pagina>
  );
}
