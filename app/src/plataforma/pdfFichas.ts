/**
 * PDFs para imprimir, gerados no próprio aparelho:
 * - fichas das espécies (catálogo ou as espécies de um pedido), com foto e
 *   as informações da ficha pública;
 * - etiquetas com QR para fixar nas mudas dentro do viveiro.
 * Nada é inventado: só entra o que está cadastrado na espécie.
 */
import QRCode from 'qrcode';

export interface FichaPdf {
  nome: string;
  outrosNomes: string[];
  cientifico: string;
  familia?: string;
  /** pares rótulo → valor, já em texto */
  dados: [string, string][];
  /** linha de destaque (ex.: "40 mudas prontas" ou "Pedidas: 20 · Aprovadas: 15") */
  destaque?: string;
  ficticia?: boolean;
  /** foto já em data URL (JPEG) */
  foto?: string | null;
}

export interface EtiquetaPdf {
  codigo: string;
  nome: string;
  cientifico: string;
  viveiro?: string;
  data?: string;
  /** texto gravado no QR (endereço do rastreio público) */
  qr: string;
  ficticia?: boolean;
}

const AZUL_ESCURO: [number, number, number] = [51, 97, 141];
const VERDE: [number, number, number] = [72, 103, 47];
const CINZA: [number, number, number] = [90, 100, 110];

/** Linhas de texto de uma ficha (testável sem gerar o PDF). */
export function textoDaFicha(f: FichaPdf): string[] {
  const l: string[] = [f.nome];
  if (f.ficticia) l.push('ESPÉCIE FICTÍCIA (só para testes)');
  l.push(`${f.cientifico}${f.familia ? ` · ${f.familia}` : ''}`);
  if (f.outrosNomes.length) l.push(`Também chamada de ${f.outrosNomes.join(', ')}`);
  if (f.destaque) l.push(f.destaque);
  for (const [r, v] of f.dados) l.push(`${r}: ${v}`);
  return l;
}

/** Posição de cada etiqueta numa folha A4 (3 colunas × 8 linhas, 24 por folha). */
export const ETIQUETAS_POR_FOLHA = 24;
export function posicaoEtiqueta(i: number): { pagina: number; x: number; y: number; largura: number; altura: number } {
  const n = i % ETIQUETAS_POR_FOLHA;
  return { pagina: Math.floor(i / ETIQUETAS_POR_FOLHA), x: 7 + (n % 3) * 66, y: 12 + Math.floor(n / 3) * 34, largura: 64, altura: 32 };
}

async function logo(): Promise<string | null> {
  try {
    const r = await fetch('/marca/logo-completa.png');
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

/** Baixa a foto e reduz para impressão (JPEG até 900 px). Sem internet: sem foto. */
export async function fotoParaPdf(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    const escala = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

/** Fichas das espécies: duas por folha A4, com foto à esquerda. */
export async function fichasPdf(titulo: string, subtitulo: string, fichas: FichaPdf[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const img = await logo();
  const cabecalho = () => {
    if (img) pdf.addImage(img, 'PNG', 15, 8, 12, 17);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...VERDE);
    pdf.text(titulo, 31, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...AZUL_ESCURO);
    pdf.text(subtitulo, 31, 21);
    pdf.setDrawColor(...AZUL_ESCURO);
    pdf.line(15, 28, 195, 28);
  };
  const rodape = (p: number, total: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(...CINZA);
    pdf.text(`Gerado pelo app do CRAD em ${new Date().toLocaleDateString('pt-BR')}`, 15, 290);
    pdf.text(`${p}/${total}`, 195, 290, { align: 'right' });
  };
  const total = Math.max(1, Math.ceil(fichas.length / 2));
  if (!fichas.length) {
    cabecalho();
    pdf.setFontSize(11);
    pdf.text('Nenhuma espécie.', 15, 40);
  }
  fichas.forEach((f, i) => {
    if (i % 2 === 0) {
      if (i) pdf.addPage();
      cabecalho();
      rodape(i / 2 + 1, total);
    }
    const y0 = i % 2 === 0 ? 34 : 162;
    // foto (ou espaço vazio)
    if (f.foto) {
      try {
        pdf.addImage(f.foto, 'JPEG', 15, y0, 60, 60);
      } catch {
        /* imagem ilegível: segue sem foto */
      }
    } else {
      pdf.setDrawColor(200, 210, 220);
      pdf.rect(15, y0, 60, 60);
      pdf.setFontSize(9);
      pdf.setTextColor(...CINZA);
      pdf.text('sem foto', 45, y0 + 31, { align: 'center' });
    }
    let y = y0 + 6;
    const x = 81;
    const largura = 114;
    pdf.setTextColor(...VERDE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    for (const l of pdf.splitTextToSize(f.nome, largura)) {
      pdf.text(l, x, y);
      y += 6.5;
    }
    if (f.ficticia) {
      pdf.setFontSize(9);
      pdf.setTextColor(180, 60, 40);
      pdf.text('ESPÉCIE FICTÍCIA (só para testes)', x, y);
      y += 5;
    }
    pdf.setTextColor(...AZUL_ESCURO);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(11);
    pdf.text(f.cientifico, x, y);
    pdf.setFont('helvetica', 'normal');
    if (f.familia) pdf.text(`  · ${f.familia}`, x + pdf.getTextWidth(f.cientifico), y);
    y += 6;
    pdf.setFontSize(9);
    if (f.outrosNomes.length) {
      const t = pdf.splitTextToSize(`Também chamada de ${f.outrosNomes.join(', ')}.`, largura);
      pdf.text(t, x, y);
      y += 4.5 * t.length;
    }
    if (f.destaque) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...VERDE);
      pdf.text(f.destaque, x, y + 1);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...AZUL_ESCURO);
    }
    // dados da ficha: ao lado da foto; abaixo dela, a largura toda
    pdf.setFontSize(9);
    const limite = y0 + 122;
    for (const [r, v] of f.dados) {
      const aoLado = y + 4.5 <= y0 + 62;
      if (!aoLado && y < y0 + 66) y = y0 + 66;
      const xi = aoLado ? x : 15;
      const li = aoLado ? largura : 180;
      pdf.setFont('helvetica', 'bold');
      const larguraRotulo = pdf.getTextWidth(`${r}: `);
      pdf.setFont('helvetica', 'normal');
      const primeira = pdf.splitTextToSize(v, li - larguraRotulo) as string[];
      const resto = primeira.length > 1 ? (pdf.splitTextToSize(primeira.slice(1).join(' '), li) as string[]) : [];
      if (y + 4.5 * (1 + resto.length) > limite) break;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${r}:`, xi, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(primeira[0] ?? '', xi + larguraRotulo, y);
      y += 4.5;
      for (const t of resto) {
        pdf.text(t, xi, y);
        y += 4.5;
      }
    }
    if (i % 2 === 0) {
      pdf.setDrawColor(220, 226, 232);
      pdf.line(15, 158, 195, 158);
    }
  });
  return pdf.output('blob');
}

/** Etiquetas com QR para fixar nas mudas: 24 por folha A4 (corte nas linhas). */
export async function etiquetasPdf(etiquetas: EtiquetaPdf[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const qrs = new Map<string, string>();
  for (const e of etiquetas) if (!qrs.has(e.qr)) qrs.set(e.qr, await QRCode.toDataURL(e.qr, { errorCorrectionLevel: 'M', margin: 1, width: 300 }));
  etiquetas.forEach((e, i) => {
    const p = posicaoEtiqueta(i);
    if (i && p.pagina > posicaoEtiqueta(i - 1).pagina) pdf.addPage();
    pdf.setDrawColor(200, 210, 220);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.rect(p.x, p.y, p.largura, p.altura);
    pdf.setLineDashPattern([], 0);
    pdf.addImage(qrs.get(e.qr)!, 'PNG', p.x + 1.5, p.y + 2, 28, 28);
    const x = p.x + 31;
    const l = p.largura - 32.5;
    let y = p.y + 6;
    pdf.setTextColor(...VERDE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    for (const t of pdf.splitTextToSize(e.nome, l).slice(0, 2)) {
      pdf.text(t, x, y);
      y += 4;
    }
    pdf.setTextColor(...AZUL_ESCURO);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    for (const t of pdf.splitTextToSize(e.cientifico, l).slice(0, 2)) {
      pdf.text(t, x, y);
      y += 3.4;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text(e.codigo, x, y + 1);
    y += 4.6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    if (e.viveiro) {
      pdf.text(pdf.splitTextToSize(e.viveiro, l)[0], x, y);
      y += 3.2;
    }
    if (e.data) pdf.text(e.data, x, y);
    if (e.ficticia) {
      pdf.setTextColor(180, 60, 40);
      pdf.text('espécie fictícia (teste)', x, p.y + p.altura - 1.5);
    }
  });
  return pdf.output('blob');
}
