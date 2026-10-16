/** Dados do assistente lidos do banco do aparelho, e cadastro dos exemplos. */
import { PERGUNTAS_PADRAO, type EspecieAssistente, type PerguntaAssistente, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';
import type { Repositorio } from '../../dados/repositorio';

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);

export interface DadosAssistente {
  perguntas: PerguntaAssistente[];
  especies: EspecieAssistente[];
}

export async function carregarAssistente(db: BancoCrads): Promise<DadosAssistente> {
  const perguntasReg = ativos(await db.colecao('pergunta').toArray()).filter((p) => p.ativa !== false);
  const opcoes = ativos(await db.colecao('opcao').toArray());
  const perguntas: PerguntaAssistente[] = perguntasReg
    .map((p) => ({
      id: p.id,
      texto: String(p.texto),
      ordem: Number(p.ordem ?? 0),
      opcoes: opcoes
        .filter((o) => o.pergunta_id === p.id)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((o) => ({ id: o.id, rotulo: String(o.rotulo), figura_padrao: o.figura_padrao ? String(o.figura_padrao) : undefined })),
    }))
    .filter((p) => p.opcoes.length)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const marcas = new Map<string, Set<string>>();
  for (const eo of ativos(await db.colecao('especie_opcao').toArray())) {
    const id = String(eo.especie_id);
    (marcas.get(id) ?? marcas.set(id, new Set()).get(id)!).add(String(eo.opcao_id));
  }
  const biomas = new Map<string, string[]>();
  for (const oc of ativos(await db.colecao('especie_ocorrencia').toArray())) {
    if (!oc.bioma) continue;
    const id = String(oc.especie_id);
    (biomas.get(id) ?? biomas.set(id, []).get(id)!).push(String(oc.bioma));
  }
  const municipios = new Map<string, string[]>();
  for (const em of ativos(await db.colecao('especie_municipio').toArray())) {
    const id = String(em.especie_id);
    (municipios.get(id) ?? municipios.set(id, []).get(id)!).push(String(em.municipio_id));
  }
  // Também conta onde a espécie já tem matriz identificada com certeza (registro real de campo).
  for (const m of ativos(await db.colecao('matriz').toArray())) {
    if (!m.especie_id || !m.municipio_id || m.grau_certeza !== 'certo') continue;
    const id = String(m.especie_id);
    const lista = municipios.get(id) ?? municipios.set(id, []).get(id)!;
    if (!lista.includes(String(m.municipio_id))) lista.push(String(m.municipio_id));
  }
  const especies: EspecieAssistente[] = ativos(await db.colecao('especie').toArray()).map((e) => ({
    id: e.id,
    opcoes: marcas.get(e.id) ?? new Set(),
    meses_flor: Array.isArray(e.meses_flor) ? (e.meses_flor as number[]) : undefined,
    meses_fruto: Array.isArray(e.meses_fruto) ? (e.meses_fruto as number[]) : undefined,
    biomas: biomas.get(e.id),
    municipios: municipios.get(e.id),
  }));
  return { perguntas, especies };
}

/** Cria as perguntas padrão que ainda não existem (pela chave). */
export async function criarPerguntasPadrao(db: BancoCrads, repo: Repositorio): Promise<number> {
  const existentes = new Set(ativos(await db.colecao('pergunta').toArray()).map((p) => p.chave));
  let criadas = 0;
  for (const p of PERGUNTAS_PADRAO) {
    if (existentes.has(p.chave)) continue;
    const reg = await repo.salvar('pergunta', { texto: p.texto, chave: p.chave, parte: p.parte, ordem: p.ordem, ativa: true });
    for (const [i, o] of p.opcoes.entries()) await repo.salvar('opcao', { pergunta_id: reg.id, rotulo: o.rotulo, chave: o.chave, figura_padrao: o.figura, ordem: i + 1 });
    criadas++;
  }
  return criadas;
}
