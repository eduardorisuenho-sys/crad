/**
 * Leitor mínimo de planilhas Excel (.xlsx e .xlsm) — só valores, sem macros.
 * Funciona no navegador, no Node e sem internet. Fórmulas são lidas pelo
 * último valor calculado que o Excel salvou no arquivo.
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface Aba {
  nome: string;
  /** linhas[0] é a linha 1 da planilha; colunas[0] é a coluna A */
  linhas: unknown[][];
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e] ?? m;
  });
}

function textos(xml: string): string {
  let s = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += m[1];
  return decodificar(s);
}

function coluna(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function atributo(tag: string, nome: string): string | undefined {
  return new RegExp(`\\s${nome}="([^"]*)"`).exec(tag)?.[1];
}

export function lerXlsx(bytes: Uint8Array): Aba[] {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(bytes, { filter: (f) => f.name.startsWith('xl/') && f.name.endsWith('.xml') || f.name.endsWith('.rels') });
  } catch {
    throw new Error('Arquivo não é uma planilha Excel (.xlsx ou .xlsm).');
  }
  const ler = (n: string) => (arquivos[n] ? strFromU8(arquivos[n]) : '');
  const workbook = ler('xl/workbook.xml');
  if (!workbook) throw new Error('Arquivo não é uma planilha Excel (.xlsx ou .xlsm).');

  const compartilhados: string[] = [];
  for (const m of ler('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) compartilhados.push(textos(m[1]));

  const alvos: Record<string, string> = {};
  for (const m of ler('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)) {
    const id = atributo(m[0], 'Id');
    const alvo = atributo(m[0], 'Target');
    if (id && alvo) alvos[id] = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
  }

  const abas: Aba[] = [];
  for (const m of workbook.matchAll(/<sheet\s[^>]*\/?>/g)) {
    const nome = decodificar(atributo(m[0], 'name') ?? '');
    const rid = atributo(m[0], 'r:id');
    const xml = rid ? ler(alvos[rid]) : '';
    const linhas: unknown[][] = [];
    for (const r of xml.matchAll(/<row\s([^>]*)>([\s\S]*?)<\/row>/g)) {
      const numero = Number(atributo(` ${r[1]}`, 'r')) - 1;
      const linha: unknown[] = [];
      for (const c of r[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = atributo(` ${c[1]}`, 'r');
        if (!ref) continue;
        const tipo = atributo(` ${c[1]}`, 't');
        const corpo = c[2] ?? '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
        let valor: unknown;
        if (tipo === 's') valor = v === undefined ? undefined : compartilhados[Number(v)];
        else if (tipo === 'inlineStr') valor = textos(corpo);
        else if (tipo === 'str') valor = v === undefined ? undefined : decodificar(v);
        else if (tipo === 'b') valor = v === '1';
        else if (tipo === 'e') valor = undefined;
        else valor = v === undefined ? undefined : Number(v);
        if (valor !== undefined && valor !== '') linha[coluna(ref)] = valor;
      }
      linhas[numero] = linha;
    }
    for (let i = 0; i < linhas.length; i++) linhas[i] ??= [];
    abas.push({ nome, linhas });
  }
  return abas;
}

/** Lê um CSV simples (separador ; ou ,) — alternativa para quem não usa Excel. */
export function lerCsv(texto: string): Aba[] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: unknown[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return [{ nome: 'CSV', linhas }];
}
