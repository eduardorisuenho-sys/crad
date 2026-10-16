/**
 * Relatório detalhado do plantio em PDF (gerado no aparelho): é o
 * "Relatório simplificado de execução" pedido no termo de compromisso.
 * Dados do pedido e do plantio, mudas por espécie, sobrevivência,
 * acompanhamentos e as fotos com data e ponto do GPS. Sem CPF nem telefone.
 */
const AZUL_ESCURO: [number, number, number] = [51, 97, 141];
const VERDE: [number, number, number] = [72, 103, 47];
const CINZA: [number, number, number] = [90, 100, 110];

export interface FotoRelatorio {
  /** JPEG em data URL (já reduzido) ou null sem a imagem no aparelho */
  imagem: string | null;
  data: string;
  lat?: number | null;
  lon?: number | null;
  /** aviso da conferência pelo GPS (ex.: longe do local) */
  aviso?: string | null;
  legenda: string;
}

export interface DadosRelatorioPlantio {
  orgao: string;
  codigo: string;
  viveiro: string;
  solicitante: string;
  instituicao?: string;
  finalidade?: string;
  dataPlantio: string;
  local?: string;
  coordenadas?: string;
  area_ha?: number | null;
  programa?: string;
  especies: { nome: string; entregues: number; plantadas: number; vivas: number | null; taxa: number | null }[];
  sobrevivencia: string;
  acompanhamentos: { data: string; tipo: string; observacao?: string; vivas: number | null; plantadas: number }[];
  fotos: FotoRelatorio[];
  termoAceitoEm?: string;
  /** e-mail para onde o termo manda enviar o relatório */
  emailRelatorio?: string;
}

/** E-mail citado no termo (para onde enviar o relatório). */
export function emailDoTermo(termo: string | undefined): string | undefined {
  return termo?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
}

const pct = (n: number | null) => (n === null ? '—' : `${String(Math.round(n * 10) / 10).replace('.', ',')}%`);

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

/** Reduz a foto para o relatório (JPEG até 700 px). */
export async function fotoDoBlob(blob: Blob | undefined): Promise<string | null> {
  if (!blob) return null;
  try {
    const bmp = await createImageBitmap(blob);
    const escala = Math.min(1, 700 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

export async function relatorioPlantio(d: DadosRelatorioPlantio): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const img = await logo();
  let y = 0;
  const novaPagina = () => {
    pdf.addPage();
    y = 18;
  };
  const precisa = (mm: number) => {
    if (y + mm > 282) novaPagina();
  };
  const titulo = (t: string) => {
    precisa(14);
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...VERDE);
    pdf.text(t, 15, y);
    y += 2;
    pdf.setDrawColor(...AZUL_ESCURO);
    pdf.line(15, y, 195, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...AZUL_ESCURO);
  };
  const linha = (rotulo: string, valor?: string | number | null) => {
    if (valor === undefined || valor === null || valor === '') return;
    const partes = pdf.splitTextToSize(String(valor), 135) as string[];
    precisa(5.5 * partes.length);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${rotulo}:`, 15, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(partes, 58, y);
    y += 5.5 * partes.length;
  };

  // cabeçalho
  if (img) pdf.addImage(img, 'PNG', 15, 10, 18, 26);
  pdf.setTextColor(...VERDE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('Relatório simplificado de execução do plantio', 38, 18);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...AZUL_ESCURO);
  pdf.text(d.orgao, 38, 24);
  pdf.text(`Centro de Recuperação de Áreas Degradadas · ${d.viveiro}`, 38, 29);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Pedido ${d.codigo}`, 195, 18, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 195, 24, { align: 'right' });
  pdf.line(15, 38, 195, 38);
  y = 44;

  titulo('Pedido e plantio');
  linha('Solicitante', d.solicitante);
  linha('Instituição', d.instituicao);
  linha('Finalidade', d.finalidade);
  linha('Data do plantio', d.dataPlantio);
  linha('Local', d.local);
  linha('Coordenadas', d.coordenadas ?? 'sem ponto de GPS');
  linha('Área (ha)', d.area_ha ? String(d.area_ha).replace('.', ',') : null);
  linha('Programa', d.programa);
  linha('Sobrevivência', d.sobrevivencia);

  titulo('Mudas por espécie');
  pdf.setFillColor(235, 239, 244);
  pdf.rect(15, y - 4.5, 180, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('Espécie', 17, y);
  pdf.text('Entregues', 125, y, { align: 'right' });
  pdf.text('Plantadas', 150, y, { align: 'right' });
  pdf.text('Vivas', 170, y, { align: 'right' });
  pdf.text('%', 193, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 7;
  for (const e of d.especies) {
    precisa(7);
    pdf.text((pdf.splitTextToSize(e.nome, 95) as string[])[0], 17, y);
    pdf.text(String(e.entregues), 125, y, { align: 'right' });
    pdf.text(String(e.plantadas), 150, y, { align: 'right' });
    pdf.text(e.vivas === null ? '—' : String(e.vivas), 170, y, { align: 'right' });
    pdf.text(pct(e.taxa), 193, y, { align: 'right' });
    y += 6.5;
  }
  pdf.setFont('helvetica', 'bold');
  precisa(7);
  pdf.text('Total', 17, y);
  pdf.text(String(d.especies.reduce((s, e) => s + e.entregues, 0)), 125, y, { align: 'right' });
  pdf.text(String(d.especies.reduce((s, e) => s + e.plantadas, 0)), 150, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  y += 6;

  titulo('Acompanhamentos');
  if (!d.acompanhamentos.length) {
    precisa(6);
    pdf.text('Ainda sem acompanhamento registrado.', 15, y);
    y += 6;
  }
  for (const a of d.acompanhamentos) {
    const texto = `${a.data} · ${a.tipo}${a.vivas !== null ? ` · ${a.vivas} vivas de ${a.plantadas}` : ''}${a.observacao ? ` · ${a.observacao}` : ''}`;
    const partes = pdf.splitTextToSize(texto, 178) as string[];
    precisa(5.5 * partes.length);
    pdf.text(partes, 15, y);
    y += 5.5 * partes.length + 1;
  }

  titulo(`Fotos (${d.fotos.length})`);
  if (!d.fotos.length) {
    precisa(6);
    pdf.text('Nenhuma foto registrada.', 15, y);
    y += 6;
  }
  // 2 por linha: foto 85 × 64 mm com a legenda embaixo
  for (let i = 0; i < d.fotos.length; i += 2) {
    precisa(82);
    for (const [j, f] of d.fotos.slice(i, i + 2).entries()) {
      const x = 15 + j * 95;
      if (f.imagem) {
        try {
          pdf.addImage(f.imagem, 'JPEG', x, y, 85, 64);
        } catch {
          pdf.rect(x, y, 85, 64);
        }
      } else {
        pdf.setDrawColor(200, 210, 220);
        pdf.rect(x, y, 85, 64);
        pdf.setTextColor(...CINZA);
        pdf.text('imagem não está neste aparelho', x + 42.5, y + 33, { align: 'center' });
        pdf.setTextColor(...AZUL_ESCURO);
      }
      pdf.setFontSize(8.5);
      const legenda = [f.legenda, f.data, typeof f.lat === 'number' && typeof f.lon === 'number' ? `GPS ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}` : 'sem GPS'].filter(Boolean).join(' · ');
      pdf.text(pdf.splitTextToSize(legenda, 85) as string[], x, y + 68);
      if (f.aviso) {
        pdf.setTextColor(180, 60, 40);
        pdf.text(`Conferir: ${f.aviso}`, x, y + 75);
        pdf.setTextColor(...AZUL_ESCURO);
      }
      pdf.setFontSize(10);
    }
    y += 82;
  }

  titulo('Compromisso');
  const fim = [
    d.termoAceitoEm ? `Termo de compromisso e declaração aceito no app em ${d.termoAceitoEm}.` : null,
    d.emailRelatorio ? `Envie este relatório para: ${d.emailRelatorio}` : null,
    'Relatório gerado pelo app do CRAD com os dados registrados no plantio e nos acompanhamentos.',
  ].filter(Boolean) as string[];
  for (const t of fim) {
    const partes = pdf.splitTextToSize(t, 178) as string[];
    precisa(5.5 * partes.length);
    pdf.text(partes, 15, y);
    y += 5.5 * partes.length + 1;
  }
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(...CINZA);
    pdf.text(`Pedido ${d.codigo} · página ${p} de ${total}`, 195, 290, { align: 'right' });
  }
  return pdf.output('blob');
}
