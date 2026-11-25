/**
 * Logomarca da instituição que usa o app (escolhida em Ajustes). Vai sozinha
 * para o cabeçalho de todos os documentos em PDF, para o termo de compromisso
 * e para o rodapé de todas as telas. Fica guardada no aparelho (funciona sem
 * internet) e vem do servidor como um parâmetro geral.
 */
import { useSyncExternalStore } from 'react';

export const CHAVE_LOGOMARCA = 'logomarca_instituicao';
const GUARDADA = 'crads_logomarca';
/** maior lado da imagem guardada (pixels): nítida no PDF e leve para sincronizar */
const LADO_MAXIMO = 800;
/** tamanho máximo da imagem guardada (o parâmetro vai para todos os aparelhos) */
const BYTES_MAXIMO = 900_000;

export interface Logomarca {
  /** data:image/png ou data:image/jpeg */
  imagem: string;
  largura: number;
  altura: number;
  /** nome do arquivo original (para baixar de volta) */
  nome?: string;
}

export function ehLogomarca(v: unknown): v is Logomarca {
  const l = v as Logomarca | null;
  return !!l && typeof l.imagem === 'string' && /^data:image\/(png|jpeg);base64,/.test(l.imagem) && Number(l.largura) > 0 && Number(l.altura) > 0;
}

// ---- a logomarca em uso (todas as telas e os PDFs leem daqui)
let atual: Logomarca | null = lerGuardada();
const ouvintes = new Set<() => void>();

function lerGuardada(): Logomarca | null {
  try {
    const v = JSON.parse(localStorage.getItem(GUARDADA) ?? 'null');
    return ehLogomarca(v) ? v : null;
  } catch {
    return null;
  }
}

export function definirLogomarca(l: Logomarca | null) {
  const nova = ehLogomarca(l) ? l : null;
  if (nova?.imagem === atual?.imagem) return;
  atual = nova;
  try {
    if (nova) localStorage.setItem(GUARDADA, JSON.stringify(nova));
    else localStorage.removeItem(GUARDADA);
  } catch {
    /* sem espaço no aparelho: fica só nesta abertura */
  }
  for (const f of ouvintes) f();
}

export const logomarcaAtual = () => atual;

export function useLogomarca(): Logomarca | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}

/** Antes do login (entrada, catálogo público): pergunta ao servidor. */
export async function buscarLogomarcaPublica(servidor: string): Promise<void> {
  try {
    const r = await fetch(`${servidor.replace(/\/$/, '')}/api/crads/publico/logomarca`);
    if (!r.ok) return;
    const { logomarca } = (await r.json()) as { logomarca: unknown };
    definirLogomarca(ehLogomarca(logomarca) ? logomarca : null);
  } catch {
    /* sem internet: fica a guardada */
  }
}

// ---- preparar a imagem escolhida em Ajustes

/** Tamanho que cabe em `larg` × `alt` sem deformar. */
export function caber(l: { largura: number; altura: number }, larg: number, alt: number): { largura: number; altura: number } {
  const k = Math.min(larg / l.largura, alt / l.altura, 1e9);
  return { largura: l.largura * k, altura: l.altura * k };
}

export async function prepararLogomarca(arquivo: File): Promise<Logomarca> {
  if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(arquivo.type)) throw new Error('Escolha uma imagem (PNG ou JPG).');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível abrir esta imagem.'));
      i.src = url;
    });
    const w0 = img.naturalWidth || 400;
    const h0 = img.naturalHeight || 200;
    const { largura, altura } = caber({ largura: w0, altura: h0 }, Math.min(LADO_MAXIMO, w0), Math.min(LADO_MAXIMO, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(largura));
    canvas.height = Math.max(1, Math.round(altura));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG mantém o fundo transparente; se ficar pesado demais, JPG em fundo branco
    let imagem = canvas.toDataURL('image/png');
    if (imagem.length > BYTES_MAXIMO) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      imagem = canvas.toDataURL('image/jpeg', 0.85);
    }
    if (imagem.length > BYTES_MAXIMO) throw new Error('A imagem é grande demais. Use uma logomarca mais simples.');
    return { imagem, largura: canvas.width, altura: canvas.height, nome: arquivo.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- documentos em PDF

interface PdfComImagem {
  addImage(imagem: string, formato: string, x: number, y: number, w: number, h: number): unknown;
}

/**
 * Cabeçalho dos PDFs: a logomarca da instituição no canto direito (o símbolo do
 * CRAD fica no esquerdo). `direita` é a margem direita em mm. Devolve a largura
 * usada (0 sem logomarca), para o título não passar por baixo dela.
 */
export function logomarcaNoPdf(pdf: PdfComImagem, { direita = 195, y = 10, larguraMax = 42, alturaMax = 24 } = {}): number {
  const l = atual;
  if (!l) return 0;
  const { largura, altura } = caber(l, larguraMax, alturaMax);
  try {
    pdf.addImage(l.imagem, l.imagem.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', direita - largura, y, largura, altura);
    return largura;
  } catch {
    return 0;
  }
}
