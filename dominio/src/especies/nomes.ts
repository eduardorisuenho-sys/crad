/** Nomes de espécies: normalização para busca, nome-base e problemas a revisar. */

/** "Ipê-roxo", "ipe roxo", "IPÊ  ROXO" → "ipe roxo". Usado na busca por nome popular. */
export function normalizarBusca(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Limpa espaços (inclusive o não-separável) de um nome científico. */
export function limparNome(nome: string): string {
  return nome.replace(/[ \s]+/g, ' ').trim();
}

/**
 * Gênero + epíteto ("Handroanthus impetiginosus (Mart. ex DC.) Mattos" →
 * "handroanthus impetiginosus"). Serve para juntar linhas da mesma espécie e
 * para cruzar com a Flora e Funga, ignorando o autor.
 */
export function nomeBase(cientifico: string): string {
  const partes = limparNome(cientifico).split(' ');
  const genero = partes[0] ?? '';
  let epiteto = partes[1] ?? '';
  if (/^(x|×)$/i.test(epiteto)) epiteto = `x ${partes[2] ?? ''}`; // híbridos
  if (!/^[a-zà-ÿ×x-]+$/i.test(epiteto) || /^(sp|spp)\.?$/i.test(epiteto) || /^\(/.test(epiteto)) epiteto = '';
  // Subespécie e variedade continuam separadas da espécie.
  const i = partes.findIndex((p, k) => k > 1 && /^(subsp|ssp|var|f)\.?$/i.test(p));
  const infra = i > 0 && partes[i + 1] ? ` ${partes[i].replace(/\.$/, '').replace(/^ssp$/i, 'subsp').toLowerCase()} ${partes[i + 1]}` : '';
  return `${genero} ${epiteto}${epiteto ? infra : ''}`.trim().toLowerCase();
}

/** Problemas no nome científico que pedem conferência de um botânico. */
export function problemasNome(cientifico: string): string[] {
  const n = limparNome(cientifico);
  const p: string[] = [];
  if (!n) return ['sem nome científico'];
  if (/\sou\s|\//i.test(n)) p.push('mais de uma espécie no mesmo nome');
  if (/\bet\.?\s*al\b/i.test(n)) p.push('nome com "et al."');
  if (/\b(sp|spp)\.?$/i.test(n) || n.split(' ').length < 2) p.push('identificado só até o gênero');
  if (/\?/.test(n)) p.push('nome com dúvida (?)');
  if (n.split(' ')[0] !== n.split(' ')[0].charAt(0).toUpperCase() + n.split(' ')[0].slice(1).toLowerCase()) p.push('gênero deve começar com maiúscula');
  return p;
}

/** Distância de edição (Levenshtein), para tolerar erros de digitação. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    ant = atual;
  }
  return ant[b.length];
}

export interface EntradaBusca {
  especie_id: string;
  /** texto mostrado (nome popular ou científico) */
  nome: string;
  tipo: 'popular' | 'cientifico' | 'sinonimo';
}

export interface ResultadoBusca extends EntradaBusca {
  pontos: number;
}

/**
 * Busca tolerante: aceita variações regionais, sem acento e com erro de
 * digitação ("ipe", "ipê-roxo", "pau d'arco"). Devolve uma linha por espécie,
 * a de maior pontuação.
 */
export function buscarNomes(consulta: string, entradas: EntradaBusca[], limite = 20): ResultadoBusca[] {
  const q = normalizarBusca(consulta);
  if (!q) return [];
  const palavrasQ = q.split(' ');
  const melhor = new Map<string, ResultadoBusca>();
  for (const e of entradas) {
    const n = normalizarBusca(e.nome);
    let pontos = 0;
    if (n === q) pontos = 100;
    else if (n.startsWith(q)) pontos = 80;
    else if (n.split(' ').some((p) => p.startsWith(q))) pontos = 70;
    else if (palavrasQ.every((pq) => n.split(' ').some((p) => p.startsWith(pq)))) pontos = 60;
    else {
      // erro de digitação: compara com o começo do nome do mesmo tamanho
      const tolerancia = q.length <= 4 ? 1 : 2;
      const d = Math.min(distancia(q, n), distancia(q, n.slice(0, q.length)), ...n.split(' ').map((p) => distancia(q, p)));
      if (q.length >= 3 && d <= tolerancia) pontos = 40 - d * 10;
    }
    if (!pontos) continue;
    if (e.tipo === 'popular') pontos += 2;
    const atual = melhor.get(e.especie_id);
    if (!atual || pontos > atual.pontos) melhor.set(e.especie_id, { ...e, pontos });
  }
  return [...melhor.values()].sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, limite);
}
