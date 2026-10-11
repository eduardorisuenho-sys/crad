/**
 * PDFs do Módulo 5, gerados no próprio aparelho (funcionam sem internet):
 * relatório do pedido (para anexar ao ofício) e termo de doação (na retirada).
 * O texto do termo vem da configuração da instalação; o modelo oficial da
 * secretaria entra aí quando for enviado.
 */
export interface LinhaPdf {
  especie: string;
  pedida: number;
  aprovada?: number;
  entregue?: number;
}

export interface DadosPdf {
  orgao: string;
  codigo: string;
  viveiro: string;
  solicitante: string;
  instituicao?: string;
  documento?: string;
  finalidade?: string;
  local?: string;
  area_ha?: number | null;
  data: string;
  itens: LinhaPdf[];
  programa?: string;
  textoTermo?: string;
  recebedor?: string;
  assinatura?: Blob | null;
  entreguePor?: string;
}

export const TEXTO_TERMO_PADRAO =
  'Declaro ter recebido as mudas nativas relacionadas acima, doadas pelo Centro de Recuperação de Áreas Degradadas (CRAD), e me comprometo a plantá-las no local informado, cuidar delas e informar o plantio e o acompanhamento quando solicitado.';

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsDataURL(blob);
  });
}

async function logo(): Promise<string | null> {
  try {
    const r = await fetch('/marca/logo-completa.png');
    return r.ok ? dataUrl(await r.blob()) : null;
  } catch {
    return null;
  }
}

const AZUL_ESCURO: [number, number, number] = [51, 97, 141];
const VERDE: [number, number, number] = [72, 103, 47];

async function documento(titulo: string, d: DadosPdf) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const img = await logo();
  if (img) pdf.addImage(img, 'PNG', 15, 10, 18, 26);
  pdf.setTextColor(...VERDE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(titulo, 38, 18);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...AZUL_ESCURO);
  pdf.text(d.orgao, 38, 24);
  pdf.text(`Centro de Recuperação de Áreas Degradadas · ${d.viveiro}`, 38, 29);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(d.codigo, 195, 18, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(d.data, 195, 24, { align: 'right' });
  pdf.setDrawColor(...AZUL_ESCURO);
  pdf.line(15, 40, 195, 40);

  let y = 48;
  const linha = (rotulo: string, valor?: string | number | null) => {
    if (valor === undefined || valor === null || valor === '') return;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${rotulo}:`, 15, y);
    pdf.setFont('helvetica', 'normal');
    const partes = pdf.splitTextToSize(String(valor), 140);
    pdf.text(partes, 55, y);
    y += 6 * partes.length;
  };
  linha('Solicitante', d.solicitante);
  linha('Instituição', d.instituicao);
  linha('Documento', d.documento);
  linha('Finalidade', d.finalidade);
  linha('Local do plantio', d.local);
  linha('Área (ha)', d.area_ha);
  linha('Programa', d.programa);

  y += 4;
  const comAprov = d.itens.some((i) => i.aprovada !== undefined);
  const comEntrega = d.itens.some((i) => i.entregue !== undefined);
  pdf.setFillColor(235, 239, 244);
  pdf.rect(15, y - 5, 180, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('Espécie', 17, y);
  pdf.text('Pedidas', 120, y, { align: 'right' });
  if (comAprov) pdf.text('Aprovadas', 155, y, { align: 'right' });
  if (comEntrega) pdf.text('Entregues', 193, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 8;
  for (const i of d.itens) {
    pdf.text(i.especie, 17, y);
    pdf.text(String(i.pedida), 120, y, { align: 'right' });
    if (comAprov) pdf.text(String(i.aprovada ?? 0), 155, y, { align: 'right' });
    if (comEntrega) pdf.text(String(i.entregue ?? 0), 193, y, { align: 'right' });
    y += 7;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total', 17, y);
  pdf.text(String(d.itens.reduce((s, i) => s + i.pedida, 0)), 120, y, { align: 'right' });
  if (comAprov) pdf.text(String(d.itens.reduce((s, i) => s + (i.aprovada ?? 0), 0)), 155, y, { align: 'right' });
  if (comEntrega) pdf.text(String(d.itens.reduce((s, i) => s + (i.entregue ?? 0), 0)), 193, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  return { pdf, y: y + 10 };
}

/** Relatório do pedido: o solicitante anexa ao ofício. */
export async function relatorioPedido(d: DadosPdf): Promise<Blob> {
  const { pdf, y } = await documento('Pedido de mudas', d);
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize('Documento gerado pelo app do CRAD para anexar ao ofício de solicitação de mudas. A quantidade depende da análise do órgão ambiental e do estoque no momento da aprovação.', 180), 15, y);
  return pdf.output('blob');
}

/** Termo de doação assinado na retirada. */
export async function termoDoacao(d: DadosPdf): Promise<Blob> {
  const { pdf, y: y0 } = await documento('Termo de doação de mudas', d);
  let y = y0;
  pdf.setFontSize(10);
  const texto = pdf.splitTextToSize(d.textoTermo || TEXTO_TERMO_PADRAO, 180);
  pdf.text(texto, 15, y);
  y += 6 * texto.length + 8;
  if (d.assinatura) {
    pdf.addImage(await dataUrl(d.assinatura), 'PNG', 15, y, 70, 28);
    y += 30;
  }
  pdf.line(15, y, 95, y);
  pdf.text(`Recebido por: ${d.recebedor ?? ''}`, 15, y + 5);
  if (d.entreguePor) pdf.text(`Entregue por: ${d.entreguePor}`, 110, y + 5);
  return pdf.output('blob');
}

/** Abre o PDF (ou baixa, quando o navegador não abre). */
export function abrirPdf(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.target = '_blank';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
