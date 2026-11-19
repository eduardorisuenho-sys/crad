/**
 * Antes de um pedido novo: quem já retirou mudas precisa comprovar o plantio
 * (registro com fotos). Doações do Plantando Água não precisam. Quem decide é o
 * servidor (ele vê o histórico e compara o CPF/CNPJ); o app só avisa antes.
 */
import { mensagemSemComprovacao } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';

export type Pendente = { id: string; codigo: string };
export type Consulta = { pendentes: Pendente[]; mensagem: string };

/** Plantios com foto já registrados neste aparelho (ainda podem estar a caminho do servidor). */
async function comprovadasAqui(db: BancoCrads): Promise<Set<string>> {
  const fotos = (await db.colecao('foto').toArray()).filter((f) => !f.excluido && f.entidade === 'plantio');
  const comFoto = new Set(fotos.map((f) => String(f.registro_id)));
  const plantios = (await db.colecao('plantio').toArray()).filter((p) => !p.excluido && comFoto.has(p.id));
  return new Set(plantios.map((p) => String(p.doacao_id)));
}

/** Pergunta ao servidor. Sem internet, devolve null: o servidor confere quando o pedido chegar. */
export async function consultarComprovacao(db: BancoCrads, servidor: string, token: string, documento?: string): Promise<Consulta | null> {
  try {
    const r = await fetch(`${servidor.replace(/\/$/, '')}/api/crads/doacao/pendencias-plantio`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify(documento ? { documento } : {}),
    });
    if (!r.ok) return null;
    const c = (await r.json()) as Consulta;
    const aqui = await comprovadasAqui(db);
    const pendentes = c.pendentes.filter((p) => !aqui.has(p.id));
    return { pendentes, mensagem: pendentes.length === c.pendentes.length ? c.mensagem : pendentes.length ? mensagemSemComprovacao(pendentes) : '' };
  } catch {
    return null;
  }
}
