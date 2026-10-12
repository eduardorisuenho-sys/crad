/** Cadastro de viveiros (gestor). Funciona sem internet como o resto do app. */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';

export function Viveiros() {
  const { repo, db, pode } = useApp();
  const viveiros = useLiveQuery(() => repo.listar('viveiro'), [repo]) ?? [];
  const naFila = useLiveQuery(async () => new Set((await db._fila.toArray()).map((o) => o.registro_id)), [db]) ?? new Set<string>();
  const [novo, setNovo] = useState(false);
  const [sigla, setSigla] = useState('');
  const [nome, setNome] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    await repo.salvar('viveiro', { sigla: sigla.trim().toUpperCase(), nome: nome.trim(), ativo: true });
    setSigla('');
    setNome('');
    setNovo(false);
  }

  if (!pode('viveiros')) {
    return (
      <Tela titulo="Viveiros">
        <p className="vazio">Só o gestor cadastra viveiros.</p>
      </Tela>
    );
  }

  if (novo) {
    return (
      <Tela titulo="Novo viveiro">
        <form onSubmit={salvar} className="formulario">
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Viveiro de Palmas" required />
          </label>
          <label>
            Sigla (3 letras)
            <input value={sigla} onChange={(e) => setSigla(e.target.value)} placeholder="PAL" maxLength={4} required />
          </label>
          <button className="botao-principal">
            <Icone nome="certo" /> Salvar
          </button>
        </form>
      </Tela>
    );
  }

  return (
    <Tela titulo="Viveiros">
      <ul className="lista">
        {viveiros.map((v) => (
          <li key={v.id} className="item-lista">
            <Icone nome="viveiro" />
            <div>
              <strong>{String(v.nome)}</strong>
              <small>{String(v.sigla)}</small>
            </div>
            {naFila.has(v.id) && <span className="selo">não enviado</span>}
          </li>
        ))}
        {!viveiros.length && <li className="vazio">Nenhum viveiro ainda.</li>}
      </ul>
      <button className="botao-principal" onClick={() => setNovo(true)}>
        <Icone nome="mais" /> Novo viveiro
      </button>
    </Tela>
  );
}
