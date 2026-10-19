/**
 * Botão "Editar" com o formulário dos campos que dá para corrigir depois do
 * cadastro (matriz, coleta, lote de sementes). Grava só o que mudou; funciona
 * sem internet (vai na próxima sincronização).
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Registro } from '@crads/dominio';
import type { BancoCrads } from '../dados/db';
import { useApp } from '../contexto';
import { lerPosicao } from '../plataforma/gps';
import { CAMPO_DECIMAL, lerNumero } from '../plataforma/numero';
import { EscolherEspecie } from '../modulos/especies/EscolherEspecie';
import { Icone } from './Icone';

export interface CampoEdicao {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'textoLongo' | 'numero' | 'data' | 'opcao' | 'especie' | 'gps';
  opcoes?: { valor: string; rotulo: string }[];
}

const paraTexto = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function EditarRegistro({ colecao, registro, campos, podeEditar, depois, rotulo = 'Editar' }: { colecao: string; registro: Registro; campos: CampoEdicao[]; podeEditar: boolean; depois?: ReactNode; rotulo?: string }) {
  const { repo, db } = useApp();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [trocandoEspecie, setTrocandoEspecie] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [procurandoGps, setProcurandoGps] = useState(false);
  const valor = (nome: string) => form[nome] ?? (campos.find((c) => c.nome === nome)?.tipo === 'data' ? paraTexto(registro[nome]).slice(0, 10) : paraTexto(registro[nome]));
  const set = (nome: string, v: string) => setForm((f) => ({ ...f, [nome]: v }));
  const nomeEspecie = useNomeEspecie(db, valor('especie_id'));
  if (!podeEditar) return null;

  function abrir() {
    setForm({});
    setMsg('');
    setErro('');
    setAberto(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const mudancas: Record<string, unknown> = {};
    const nomes = campos.flatMap((c) => (c.tipo === 'gps' ? ['lat', 'lon'] : [c.nome]));
    for (const nome of nomes) {
      if (form[nome] === undefined) continue;
      const c = campos.find((x) => x.nome === nome) ?? { tipo: 'numero' };
      let v: unknown = form[nome];
      if (c.tipo === 'numero' || nome === 'lat' || nome === 'lon') {
        v = form[nome].trim() === '' ? null : lerNumero(form[nome]);
        if (form[nome].trim() !== '' && (v === null || Number.isNaN(v))) return setErro(`${c.tipo === 'gps' ? 'Coordenada' : (c as CampoEdicao).rotulo ?? nome}: número inválido.`);
      } else if (v === '') v = null;
      if (paraTexto(v) !== paraTexto(registro[nome]).slice(0, c.tipo === 'data' ? 10 : undefined)) mudancas[nome] = v;
    }
    if (mudancas.lat !== undefined && mudancas.lat !== null && (Number(mudancas.lat) < -34 || Number(mudancas.lat) > 6)) return setErro('Latitude fora do Brasil.');
    if (mudancas.lon !== undefined && mudancas.lon !== null && (Number(mudancas.lon) < -75 || Number(mudancas.lon) > -28)) return setErro('Longitude fora do Brasil.');
    if (!Object.keys(mudancas).length) {
      setAberto(false);
      return;
    }
    await repo.salvar(colecao, mudancas, registro.id);
    setAberto(false);
    setMsg('Alterações salvas.');
  }

  if (!aberto) {
    return (
      <>
        {msg && <p className="mensagem">{msg}</p>}
        <button type="button" className="botao-secundario nao-imprimir" onClick={abrir}>
          <Icone nome="lapis" /> {rotulo}
        </button>
      </>
    );
  }

  return (
    <form className="cartao formulario nao-imprimir" onSubmit={(e) => void salvar(e)} data-testid="editar-registro">
      <h2>{rotulo}</h2>
      {campos.map((c) => {
        if (c.tipo === 'especie') {
          return (
            <div key={c.nome}>
              <p>
                <strong>{c.rotulo}:</strong> {nomeEspecie || 'sem espécie'}
              </p>
              {trocandoEspecie ? (
                <EscolherEspecie
                  aoEscolher={(id) => {
                    set(c.nome, id);
                    setTrocandoEspecie(false);
                  }}
                />
              ) : (
                <button type="button" className="botao-secundario" onClick={() => setTrocandoEspecie(true)}>
                  Trocar a espécie
                </button>
              )}
            </div>
          );
        }
        if (c.tipo === 'gps') {
          return (
            <fieldset key={c.nome} className="formulario">
              <legend>{c.rotulo}</legend>
              <label>
                Latitude
                <input {...CAMPO_DECIMAL} value={valor('lat')} onChange={(e) => set('lat', e.target.value)} />
              </label>
              <label>
                Longitude
                <input {...CAMPO_DECIMAL} value={valor('lon')} onChange={(e) => set('lon', e.target.value)} />
              </label>
              <button
                type="button"
                className="botao-secundario"
                disabled={procurandoGps}
                onClick={async () => {
                  setProcurandoGps(true);
                  const p = await lerPosicao();
                  setProcurandoGps(false);
                  if (!p) return setErro('Não deu para ler o GPS agora.');
                  set('lat', String(p.lat));
                  set('lon', String(p.lon));
                }}
              >
                <Icone nome="plantio" /> {procurandoGps ? 'Procurando o GPS…' : 'Usar minha posição agora'}
              </button>
            </fieldset>
          );
        }
        if (c.tipo === 'opcao') {
          return (
            <label key={c.nome}>
              {c.rotulo}
              <select value={valor(c.nome)} onChange={(e) => set(c.nome, e.target.value)}>
                <option value="">—</option>
                {c.opcoes?.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (c.tipo === 'textoLongo') {
          return (
            <label key={c.nome}>
              {c.rotulo}
              <textarea rows={3} value={valor(c.nome)} onChange={(e) => set(c.nome, e.target.value)} />
            </label>
          );
        }
        return (
          <label key={c.nome}>
            {c.rotulo}
            <input
              {...(c.tipo === 'numero' ? CAMPO_DECIMAL : {})}
              type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? CAMPO_DECIMAL.type : 'text'}
              value={c.tipo === 'numero' ? valor(c.nome).replace('.', ',') : valor(c.nome)}
              onChange={(e) => set(c.nome, e.target.value)}
            />
          </label>
        );
      })}
      {depois}
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="botao-principal">
          <Icone nome="certo" /> Salvar alterações
        </button>
        <button type="button" className="botao-secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function useNomeEspecie(db: BancoCrads, id: string): string {
  return (
    useLiveQuery(async () => {
      if (!id) return '';
      const pop = (await db.colecao('nome_popular').where('especie_id').equals(id).toArray()).find((n) => !n.excluido);
      const e = await db.colecao('especie').get(id);
      return [pop?.nome, e?.nome_cientifico].filter(Boolean).join(' · ');
    }, [id]) ?? ''
  );
}
