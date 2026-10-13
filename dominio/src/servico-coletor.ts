/**
 * Relatório de serviço do coletor: o que a pessoa fez no período (matrizes
 * cadastradas, coletas, registros de flor e fruto), para comprovar o trabalho.
 * Tudo vem dos registros; nada é digitado de novo.
 */
import { emGramas } from './sementes';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };

export interface FiltroServico {
  coletorId: string;
  /** AAAA-MM-DD, inclusive */
  inicio: string;
  fim: string;
  viveiroId?: string;
}

export interface ServicoColetor {
  matrizes: Reg[];
  coletas: Reg[];
  fenologias: Reg[];
  /** fotos de cada matriz do relatório (árvore primeiro) */
  fotosPorMatriz: Map<string, Reg[]>;
  totais: { matrizes: number; coletas: number; especies: number; quilos: number; outras_unidades: Record<string, number>; registros_flor_fruto: number; dias_de_campo: number };
}

/** Dia (AAAA-MM-DD) no fuso do aparelho: datas com hora vêm em UTC (toISOString). */
const dia = (v: unknown) => {
  const s = String(v ?? '');
  if (s.length <= 10) return s;
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ORDEM_FOTO = ['arvore', 'tronco', 'folha', 'flor', 'fruto', 'semente', 'casca', 'ramo', 'outro'];

/** É desta pessoa? (coletor informado no registro ou quem criou) */
const daPessoa = (r: Reg, id: string, campo?: string) => (campo && r[campo] ? r[campo] === id : r.criado_por === id);

export function servicoColetor(d: { matrizes: Reg[]; coletas: Reg[]; fenologias: Reg[]; fotos: Reg[] }, f: FiltroServico): ServicoColetor {
  const noPeriodo = (v: unknown) => {
    const x = dia(v);
    return !!x && x >= f.inicio && x <= f.fim;
  };
  const doViveiro = (r: Reg) => !f.viveiroId || r.viveiro_id === f.viveiroId;
  const ativos = <T extends Reg>(rs: T[]) => rs.filter((r) => !r.excluido && doViveiro(r));

  const matrizes = ativos(d.matrizes)
    .filter((m) => daPessoa(m, f.coletorId, 'coletor_id') && noPeriodo(m.criado_no_aparelho_em ?? m.created))
    .sort((a, b) => String(a.criado_no_aparelho_em ?? '').localeCompare(String(b.criado_no_aparelho_em ?? '')));
  const coletas = ativos(d.coletas)
    .filter((c) => daPessoa(c, f.coletorId, 'coletor_id') && noPeriodo(c.data))
    .sort((a, b) => dia(a.data).localeCompare(dia(b.data)));
  const fenologias = ativos(d.fenologias)
    .filter((x) => daPessoa(x, f.coletorId) && noPeriodo(x.data))
    .sort((a, b) => dia(a.data).localeCompare(dia(b.data)));

  const ids = new Set(matrizes.map((m) => m.id));
  const fotosPorMatriz = new Map<string, Reg[]>();
  for (const foto of d.fotos) {
    if (foto.excluido || foto.entidade !== 'matriz' || !ids.has(String(foto.registro_id))) continue;
    const k = String(foto.registro_id);
    (fotosPorMatriz.get(k) ?? fotosPorMatriz.set(k, []).get(k)!).push(foto);
  }
  for (const fs of fotosPorMatriz.values()) fs.sort((a, b) => ORDEM_FOTO.indexOf(String(a.parte)) - ORDEM_FOTO.indexOf(String(b.parte)));

  let gramas = 0;
  const outras: Record<string, number> = {};
  for (const c of coletas) {
    const g = emGramas(c.quantidade as number, c.unidade as string);
    if (g !== null) gramas += g;
    else if (c.quantidade) outras[String(c.unidade ?? 'unidades')] = (outras[String(c.unidade ?? 'unidades')] ?? 0) + Number(c.quantidade);
  }
  const dias = new Set([...matrizes.map((m) => dia(m.criado_no_aparelho_em ?? m.created)), ...coletas.map((c) => dia(c.data)), ...fenologias.map((x) => dia(x.data))]);
  const especies = new Set([...matrizes.map((m) => m.especie_id), ...coletas.map((c) => (c.matriz_id ? d.matrizes.find((m) => m.id === c.matriz_id)?.especie_id : c.especie_id))].filter(Boolean));

  return {
    matrizes,
    coletas,
    fenologias,
    fotosPorMatriz,
    totais: {
      matrizes: matrizes.length,
      coletas: coletas.length,
      especies: especies.size,
      quilos: Math.round(gramas / 10) / 100,
      outras_unidades: outras,
      registros_flor_fruto: fenologias.length,
      dias_de_campo: dias.size,
    },
  };
}
