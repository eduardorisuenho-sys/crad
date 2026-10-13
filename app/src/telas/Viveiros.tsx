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
  // null = lista; '' = novo viveiro; id = editando
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({ sigla: '', nome: '', telefone: '', endereco: '' });

  function abrir(v?: Record<string, unknown> & { id: string }) {
    setForm({ sigla: String(v?.sigla ?? ''), nome: String(v?.nome ?? ''), telefone: String(v?.telefone ?? ''), endereco: String(v?.endereco ?? '') });
    setEditando(v?.id ?? '');
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados = { sigla: form.sigla.trim().toUpperCase(), nome: form.nome.trim(), telefone: form.telefone.trim() || null, endereco: form.endereco.trim() || null };
    await repo.salvar('viveiro', editando ? dados : { ...dados, ativo: true }, editando || undefined);
    setEditando(null);
  }

  if (!pode('viveiros')) {
    return (
      <Tela titulo="Viveiros">
        <p className="vazio">Só o gestor cadastra viveiros.</p>
      </Tela>
    );
  }

  if (editando !== null) {
    return (
      <Tela titulo={editando ? 'Dados do viveiro' : 'Novo viveiro'}>
        <form onSubmit={salvar} className="formulario">
          <label>
            Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Viveiro de Palmas" required />
          </label>
          <label>
            Sigla (3 letras)
            <input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} placeholder="PAL" maxLength={4} required disabled={!!editando} />
          </label>
          <label>
            Telefone ou WhatsApp do viveiro
            <input type="tel" inputMode="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(63) 99999-0000" />
          </label>
          <p className="dica">Quem pede mudas vê este telefone depois que o pedido é aprovado, para combinar a retirada.</p>
          <label>
            Endereço para retirada
            <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          </label>
          <button className="botao-principal">
            <Icone nome="certo" /> Salvar
          </button>
          <button type="button" className="botao-secundario" onClick={() => setEditando(null)}>
            <Icone nome="voltar" /> Voltar
          </button>
        </form>
      </Tela>
    );
  }

  return (
    <Tela titulo="Viveiros">
      <ul className="lista">
        {viveiros.map((v) => (
          <li key={v.id}>
            <button className="item-lista botao-lista" onClick={() => abrir(v)}>
              <Icone nome="viveiro" />
              <div>
                <strong>{String(v.nome)}</strong>
                <small>
                  {String(v.sigla)}
                  {v.telefone ? ` · ${String(v.telefone)}` : ' · sem telefone'}
                </small>
              </div>
              {naFila.has(v.id) && <span className="selo">não enviado</span>}
            </button>
          </li>
        ))}
        {!viveiros.length && <li className="vazio">Nenhum viveiro ainda.</li>}
      </ul>
      <button className="botao-principal" onClick={() => abrir()}>
        <Icone nome="mais" /> Novo viveiro
      </button>
    </Tela>
  );
}
