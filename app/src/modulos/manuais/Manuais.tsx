/**
 * Manual do viveirista: material técnico e prático (germinação de sementes, produção de
 * mudas…) em PDF. Quem entrou no app lê; o gestor inclui e tira. O PDF aberto uma vez fica
 * guardado no aparelho e abre depois sem internet.
 */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ASSUNTOS_MANUAL, type Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import type { BancoCrads } from '../../dados/db';
import type { Sessao } from '../../dados/sessao';
import { nomesEspecies } from '../coleta/dados';
import { EscolherEspecie } from '../especies/EscolherEspecie';

export const ROTULO_ASSUNTO: Record<string, string> = {
  germinacao: 'Germinação de sementes',
  producao: 'Produção de mudas',
  pragas: 'Pragas e doenças',
  plantio: 'Plantio',
  outro: 'Outros',
};

const LIMITE = 15_000_000;
/** O PDF guardado no aparelho vale para aquele arquivo: trocou o PDF, baixa de novo. */
const chaveGuardada = (m: Registro) => `manual:${m.id}:${String(m.arquivo ?? '')}`;

async function pdfDoManual(db: BancoCrads, sessao: Sessao, m: Registro): Promise<Blob> {
  const guardado = await db._miniaturas.get(chaveGuardada(m));
  if (guardado) return guardado.blob;
  if (!navigator.onLine) throw new Error('Sem internet. Abra este manual uma vez com sinal para ele ficar guardado no celular.');
  const r = await fetch(`${sessao.servidor.replace(/\/$/, '')}/api/crads/arquivo/manual/${m.id}/arquivo`, { headers: { authorization: sessao.token } });
  if (!r.ok) throw new Error('O PDF ainda não chegou ao servidor. Tente de novo daqui a pouco.');
  const blob = new Blob([await r.arrayBuffer()], { type: 'application/pdf' });
  await db._miniaturas.put({ id: chaveGuardada(m), blob });
  return blob;
}

function FormManual({ aoTerminar }: { aoTerminar: () => void }) {
  const { db, repo } = useApp();
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [d, setD] = useState({ titulo: '', resumo: '', assunto: 'germinacao', fonte: '', especie_id: '' });
  const [pdf, setPdf] = useState<File | null>(null);
  const [escolherEspecie, setEscolherEspecie] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!pdf) return setErro('Escolha o arquivo PDF do manual.');
    if (pdf.type && pdf.type !== 'application/pdf') return setErro('O arquivo precisa ser um PDF.');
    if (pdf.size > LIMITE) return setErro('O PDF passa de 15 MB. Diminua o arquivo (exportar com qualidade menor) e tente de novo.');
    setSalvando(true);
    try {
      const reg = await repo.salvar('manual', { ...d, especie_id: d.especie_id || null });
      await repo.anexarArquivo('manual', reg.id, 'arquivo', pdf, pdf.name.toLowerCase().endsWith('.pdf') ? pdf.name : `${pdf.name}.pdf`);
      aoTerminar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao formulario" onSubmit={salvar} data-testid="form-manual">
      <h2>Incluir manual</h2>
      <label>
        Título
        <input value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} required minLength={3} />
      </label>
      <label>
        Do que trata (opcional)
        <input value={d.resumo} onChange={(e) => setD({ ...d, resumo: e.target.value })} />
      </label>
      <fieldset className="meses">
        <legend>Assunto</legend>
        {ASSUNTOS_MANUAL.map((a) => (
          <button type="button" key={a} className={`chip ${d.assunto === a ? 'ativo' : ''}`} aria-pressed={d.assunto === a} onClick={() => setD({ ...d, assunto: a })}>
            {ROTULO_ASSUNTO[a]}
          </button>
        ))}
      </fieldset>
      <div>
        <strong>Espécie (opcional)</strong>
        {d.especie_id ? (
          <p className="dica">
            {nomes?.get(d.especie_id) ?? ''}{' '}
            <button type="button" className="link" onClick={() => setD({ ...d, especie_id: '' })}>
              tirar
            </button>
          </p>
        ) : escolherEspecie ? (
          <EscolherEspecie
            aoEscolher={(id) => {
              setD({ ...d, especie_id: id });
              setEscolherEspecie(false);
            }}
          />
        ) : (
          <button type="button" className="botao-secundario" onClick={() => setEscolherEspecie(true)}>
            Escolher a espécie
          </button>
        )}
      </div>
      <label>
        Fonte (opcional)
        <input value={d.fonte} onChange={(e) => setD({ ...d, fonte: e.target.value })} placeholder="ex.: Embrapa Cerrados, 2004" />
      </label>
      <label>
        Arquivo PDF (até 15 MB)
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} required />
      </label>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      <div className="acoes">
        <button type="button" className="botao-secundario" onClick={aoTerminar}>
          Cancelar
        </button>
        <button className="botao-principal" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar manual'}
        </button>
      </div>
    </form>
  );
}

export function Manuais() {
  const { db, repo, sessao, perfis } = useApp();
  const ehGestor = !!sessao && (sessao.gestorGeral || perfis.includes('gestor'));
  const manuais = useLiveQuery(async () => (await repo.listar('manual')).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR')), [repo]) ?? [];
  const guardados = useLiveQuery(async () => new Set((await db._miniaturas.where('id').startsWith('manual:').primaryKeys()) as string[]), [db]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [incluindo, setIncluindo] = useState(false);
  const [abrindo, setAbrindo] = useState('');
  const [erro, setErro] = useState('');

  async function abrir(m: Registro) {
    setErro('');
    setAbrindo(m.id);
    // a janela abre já (o navegador bloqueia janela aberta depois de esperar o download)
    const janela = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await pdfDoManual(db, sessao!, m));
      if (janela) janela.location.href = url;
      else window.location.href = url;
    } catch (e) {
      janela?.close();
      setErro((e as Error).message);
    } finally {
      setAbrindo('');
    }
  }

  return (
    <Tela titulo="Manual do viveirista">
      <p className="dica">Material técnico e prático para o viveiro: germinação de sementes, produção de mudas e mais. Abriu uma vez, fica guardado no celular.</p>
      {erro && (
        <p className="mensagem alerta" role="alert">
          {erro}
        </p>
      )}
      <ul className="lista" data-testid="lista-manuais">
        {manuais.map((m) => {
          const guardado = guardados?.has(chaveGuardada(m));
          return (
            <li key={m.id} className="cartao manual">
              <div className="manual-topo">
                <Icone nome="catalogo" tamanho={36} />
                <div>
                  <strong>{String(m.titulo)}</strong>
                  <small>
                    {ROTULO_ASSUNTO[String(m.assunto)] ?? ''}
                    {m.especie_id ? ` · ${nomes?.get(String(m.especie_id)) ?? ''}` : ''}
                  </small>
                </div>
              </div>
              {m.resumo ? <p>{String(m.resumo)}</p> : null}
              {m.fonte ? <small className="fonte">Fonte: {String(m.fonte)}</small> : null}
              <button className="botao-principal" onClick={() => void abrir(m)} disabled={abrindo === m.id || !m.arquivo}>
                <Icone nome="baixar" /> {abrindo === m.id ? 'Abrindo…' : m.arquivo ? 'Abrir o manual (PDF)' : 'PDF ainda enviando…'}
              </button>
              {guardado && (
                <small className="guardado">
                  <Icone nome="certo" tamanho={14} /> guardado no celular
                </small>
              )}
              {ehGestor && (
                <button
                  className="link perigo"
                  onClick={async () => {
                    if (!confirm(`Tirar o manual "${String(m.titulo)}"? Ele vai para a lixeira.`)) return;
                    await repo.excluir('manual', m.id);
                  }}
                >
                  Tirar este manual
                </button>
              )}
            </li>
          );
        })}
        {!manuais.length && <li className="vazio">Nenhum manual ainda.</li>}
      </ul>
      {ehGestor &&
        (incluindo ? (
          <FormManual aoTerminar={() => setIncluindo(false)} />
        ) : (
          <button className="botao-grande" onClick={() => setIncluindo(true)}>
            <Icone nome="mais" tamanho={36} /> <span>Incluir manual</span>
          </button>
        ))}
    </Tela>
  );
}
