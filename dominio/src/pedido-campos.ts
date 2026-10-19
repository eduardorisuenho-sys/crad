/**
 * Pedido de mudas: todos os campos são obrigatórios. Devolve as mensagens
 * do que falta, em linguagem simples (vazio = tudo certo).
 */
const digitos = (s: string) => s.replace(/\D/g, '');

/** CPF com os dígitos verificadores certos. */
export function cpfValido(cpf: string): boolean {
  const d = digitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

/** CNPJ com os dígitos verificadores certos. */
export function cnpjValido(cnpj: string): boolean {
  const d = digitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  for (const t of [12, 13]) {
    const pesos = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0) % 11;
    if ((resto < 2 ? 0 : 11 - resto) !== Number(d[t])) return false;
  }
  return true;
}

export interface CamposPlantio {
  finalidade: string;
  municipio: string;
  local: string;
  area: number | null;
}

export function faltaNoPlantio(p: CamposPlantio): string[] {
  const f: string[] = [];
  if (!p.finalidade.trim()) f.push('Escolha para quê são as mudas.');
  if (!p.municipio.trim()) f.push('Escreva o município.');
  if (!p.local.trim()) f.push('Escreva o endereço ou como chegar.');
  if (p.area === null || !Number.isFinite(p.area) || p.area <= 0) f.push('Escreva a área aproximada em hectares (ex.: 0,5).');
  return f;
}

export interface CamposPessoa {
  tipo: string;
  nome: string;
  instituicao: string;
  documento: string;
  telefone: string;
}

export function faltaNaPessoa(p: CamposPessoa): string[] {
  const f: string[] = [];
  if (!p.nome.trim()) f.push(p.tipo === 'juridica' ? 'Escreva o nome.' : 'Escreva o nome completo.');
  else if (p.tipo !== 'juridica' && p.nome.trim().split(/\s+/).length < 2) f.push('Escreva o nome completo (nome e sobrenome).');
  if (!p.instituicao.trim()) f.push(p.tipo === 'juridica' ? 'Escreva o nome da instituição.' : 'Escreva a instituição (ou “particular”).');
  if (p.tipo === 'juridica' ? !cnpjValido(p.documento) : !cpfValido(p.documento)) f.push(p.tipo === 'juridica' ? 'CNPJ incompleto ou com número errado.' : 'CPF incompleto ou com número errado.');
  const tel = digitos(p.telefone);
  if (tel.length < 10 || tel.length > 13) f.push('Escreva o telefone com DDD (ex.: 63 99999-0000).');
  return f;
}
