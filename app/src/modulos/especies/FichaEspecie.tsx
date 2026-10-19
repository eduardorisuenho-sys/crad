/** Ficha da espécie: o gestor edita; os outros perfis só consultam. */
import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { colecao, normalizarBusca, type Campo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CaracteresAssistente } from './CaracteresAssistente';
import { FotosEspecie } from './FotosEspecie';
import { adicionarNomePopular, nomesPopularesDe } from './dados';
import { completarEspeciesPelaWikipedia } from './completarWikipedia';
import { GRUPOS_FICHA, NOMES_MESES, rotulo } from './rotulos';

/** Junta os nomes já escolhidos com os digitados (separados por vírgula ou ;), sem repetir. */
export function juntarNomes(atuais: string[], digitado: string): string[] {
  const out = [...atuais];
  const vistos = new Set(atuais.map((n) => normalizarBusca(n)));
  for (const n of digitado.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    if (vistos.has(normalizarBusca(n))) continue;
    vistos.add(normalizarBusca(n));
    out.push(n);
  }
  return out;
}

const CAMPOS = new Map<string, Campo>(colecao('especie').campos.map((c) => [c.nome, c]));

export function FichaEspecie() {
  const { id } = useParams();
  const nova = id === 'nova';
  const { db, repo, pode } = useApp();
  const navegar = useNavigate();
  const gestor = pode('especies');
  const especie = useLiveQuery(() => (nova || !id ? undefined : db.colecao('especie').get(id)), [id]);
  const populares = useLiveQuery(() => (nova || !id ? [] : nomesPopularesDe(db, id)), [id]) ?? [];
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [novoNome, setNovoNome] = useState('');
  // nomes populares de uma espécie nova: gravados junto com ela
  const [nomesNovos, setNomesNovos] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (especie) setForm(especie);
  }, [especie?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // O que a busca na Wikipédia completou chega sem apagar o que a pessoa está digitando.
  useEffect(() => {
    if (!especie) return;
    setForm((f) => ({
      ...f,
      ...(String(f.nome_cientifico ?? '').trim() ? {} : { nome_cientifico: especie.nome_cientifico }),
      ...(String(f.familia ?? '').trim() ? {} : { familia: especie.familia }),
      revisar: especie.revisar,
      nota_revisao: especie.nota_revisao,
    }));
  }, [especie?.nome_cientifico, especie?.familia, especie?.nota_revisao]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    // só o nome popular é obrigatório; o resto o app procura na Wikipédia
    if (nova && !juntarNomes(nomesNovos, novoNome).length) return setErro('Escreva pelo menos um nome popular.');
    const dados: Record<string, unknown> = {};
    for (const g of GRUPOS_FICHA) for (const c of g.campos) if (c in form) dados[c] = form[c];
    const r = await repo.salvar('especie', nova ? { fonte_cadastro: 'manual', ...dados } : dados, nova ? undefined : id);
    if (nova) for (const n of juntarNomes(nomesNovos, novoNome)) await adicionarNomePopular(repo, r.id, n);
    setNovoNome('');
    setSalvo(true);
    if (nova) {
      // sem nome científico ou família: procura na Wikipédia (agora, se houver internet; senão, quando conectar)
      if ((!String(dados.nome_cientifico ?? '').trim() || !String(dados.familia ?? '').trim()) && navigator.onLine) void completarEspeciesPelaWikipedia(db, repo).catch(() => undefined);
      navegar(`/especies/${r.id}`, { replace: true });
    }
  }

  const set = (c: string, v: unknown) => {
    setSalvo(false);
    setForm((f) => ({ ...f, [c]: v }));
  };

  function campo(nome: string) {
    const def = CAMPOS.get(nome);
    if (!def) return null;
    const v = form[nome];
    const somenteLeitura = !gestor || nome === 'flora_id';
    if (def.tipo === 'bool') {
      return (
        <label key={nome} className="linha-check">
          <input type="checkbox" checked={Boolean(v)} disabled={somenteLeitura} onChange={(e) => set(nome, e.target.checked)} /> {rotulo(nome)}
        </label>
      );
    }
    if (nome === 'meses_flor' || nome === 'meses_fruto') {
      const meses = Array.isArray(v) ? (v as number[]) : [];
      return (
        <fieldset key={nome} className="meses">
          <legend>{rotulo(nome)}</legend>
          {NOMES_MESES.map((m, i) => (
            <button
              type="button"
              key={m}
              disabled={somenteLeitura}
              className={`chip ${meses.includes(i + 1) ? 'ativo' : ''}`}
              onClick={() => set(nome, meses.includes(i + 1) ? meses.filter((x) => x !== i + 1) : [...meses, i + 1].sort((a, b) => a - b))}
            >
              {m}
            </button>
          ))}
        </fieldset>
      );
    }
    if (def.tipo === 'opcao') {
      return (
        <label key={nome}>
          {rotulo(nome)}
          <select value={String(v ?? '')} disabled={somenteLeitura} onChange={(e) => set(nome, e.target.value || null)}>
            <option value="">—</option>
            {def.opcoes!.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <label key={nome}>
        {rotulo(nome)}
        <input
          type={def.tipo === 'numero' ? 'number' : 'text'}
          value={v === null || v === undefined || (def.tipo === 'numero' && v === 0) ? '' : String(v)}
          readOnly={somenteLeitura}
          required={def.obrigatorio}
          onChange={(e) => set(nome, def.tipo === 'numero' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
        />
      </label>
    );
  }

  if (!nova && especie === undefined) return <Tela titulo="Espécie">{null}</Tela>;

  return (
    <Tela titulo={nova ? 'Nova espécie' : String(populares[0]?.nome ?? especie?.nome_cientifico ?? 'Espécie')}>
      {Boolean(form.revisar) && (
        <p className="mensagem alerta">
          <Icone nome="aviso" tamanho={20} /> Revisar: {String(form.nota_revisao || 'sem nota')}
        </p>
      )}
      <section className="cartao" data-testid="nomes-populares">
        <h2>Nomes populares</h2>
        {gestor && <p className="dica">Uma espécie pode ter vários nomes populares. Escreva um de cada vez ou vários separados por vírgula.</p>}
        <ul className="chips">
          {nova
            ? nomesNovos.map((n) => (
                <li key={n} className="chip">
                  {n}
                  <button type="button" aria-label={`Remover ${n}`} onClick={() => setNomesNovos(nomesNovos.filter((x) => x !== n))}>
                    ×
                  </button>
                </li>
              ))
            : populares.map((p) => (
                <li key={p.id} className="chip">
                  {String(p.nome)}
                  {gestor && (
                    <button type="button" aria-label={`Remover ${String(p.nome)}`} onClick={() => void repo.excluir('nome_popular', p.id)}>
                      ×
                    </button>
                  )}
                </li>
              ))}
          {!nova && !populares.length && <li className="dica">Nenhum nome popular ainda.</li>}
        </ul>
        {gestor && (
          <form
            className="linha-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (nova) setNomesNovos(juntarNomes(nomesNovos, novoNome));
              else for (const n of juntarNomes(populares.map((p) => String(p.nome)), novoNome).slice(populares.length)) await adicionarNomePopular(repo, id!, n);
              setNovoNome('');
            }}
          >
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Ipê-amarelo, Pau-d'arco" aria-label="Novo nome popular" />
            <button className="botao-secundario">Incluir</button>
          </form>
        )}
      </section>
      {!nova && id && <FotosEspecie especieId={id} editavel={gestor} />}
      {!nova && id && <CaracteresAssistente especieId={id} editavel={gestor} />}
      <form onSubmit={salvar} className="formulario">
        {GRUPOS_FICHA.filter((g) => !(nova && g.titulo === 'Referência')).map((g) => (
          <section key={g.titulo} className="cartao">
            <h2>{g.titulo}</h2>
            <div className="formulario">{g.campos.map(campo)}</div>
          </section>
        ))}
        {nova && (
          <p className="dica" data-testid="dica-wikipedia">
            Só o nome popular é obrigatório. Se deixar o nome científico ou a família em branco, o app procura na Wikipédia (pt.wikipedia.org) assim que houver internet e marca a ficha para você conferir.
          </p>
        )}
        {erro && <p className="erro">{erro}</p>}
        {gestor && (
          <button className="botao-principal">
            <Icone nome="certo" /> {salvo ? 'Salvo' : 'Salvar ficha'}
          </button>
        )}
      </form>
    </Tela>
  );
}
