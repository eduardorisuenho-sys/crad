/** Ficha da espécie: o gestor edita; os outros perfis só consultam. */
import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { colecao, type Campo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CaracteresAssistente } from './CaracteresAssistente';
import { FotosEspecie } from './FotosEspecie';
import { adicionarNomePopular, nomesPopularesDe } from './dados';
import { GRUPOS_FICHA, NOMES_MESES, rotulo } from './rotulos';

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
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (especie) setForm(especie);
  }, [especie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados: Record<string, unknown> = {};
    for (const g of GRUPOS_FICHA) for (const c of g.campos) if (c in form) dados[c] = form[c];
    const r = await repo.salvar('especie', nova ? { fonte_cadastro: 'manual', ...dados } : dados, nova ? undefined : id);
    setSalvo(true);
    if (nova) navegar(`/especies/${r.id}`, { replace: true });
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
      {!nova && (
        <section className="cartao">
          <h2>Nomes populares</h2>
          <ul className="chips">
            {populares.map((p) => (
              <li key={p.id} className="chip">
                {String(p.nome)}
                {gestor && (
                  <button type="button" aria-label={`Remover ${String(p.nome)}`} onClick={() => void repo.excluir('nome_popular', p.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {gestor && (
            <form
              className="linha-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (novoNome.trim()) await adicionarNomePopular(repo, id!, novoNome.trim());
                setNovoNome('');
              }}
            >
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Novo nome popular" aria-label="Novo nome popular" />
              <button className="botao-secundario">Incluir</button>
            </form>
          )}
        </section>
      )}
      {!nova && id && <FotosEspecie especieId={id} editavel={gestor} />}
      {!nova && id && <CaracteresAssistente especieId={id} editavel={gestor} />}
      <form onSubmit={salvar} className="formulario">
        {GRUPOS_FICHA.map((g) => (
          <section key={g.titulo} className="cartao">
            <h2>{g.titulo}</h2>
            <div className="formulario">{g.campos.map(campo)}</div>
          </section>
        ))}
        {gestor && (
          <button className="botao-principal">
            <Icone nome="certo" /> {salvo ? 'Salvo' : 'Salvar ficha'}
          </button>
        )}
      </form>
    </Tela>
  );
}
