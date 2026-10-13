/** PDF do relatório de serviço do coletor (gerado no aparelho, funciona sem internet). */
import type { ServicoColetor } from '@crads/dominio';
import { mostrarNumero } from '../../plataforma/numero';
import { ROTULO_CERTEZA as CERTEZA } from '../matrizes/ListaMatrizes';

const AZUL_ESCURO: [number, number, number] = [51, 97, 141];
const VERDE: [number, number, number] = [72, 103, 47];
const CINZA: [number, number, number] = [235, 239, 244];

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsDataURL(blob);
  });
}

export interface DadosPdfServico {
  orgao: string;
  coletor: string;
  periodo: string;
  viveiro: string;
  servico: ServicoColetor;
  nomeEspecie: (id: unknown) => string;
  municipio: (id: unknown) => string;
  /** qualquer matriz do aparelho (a coleta pode ser numa matriz cadastrada antes do período) */
  matriz: (id: unknown) => Record<string, unknown> | undefined;
  /** miniatura guardada no aparelho, se houver */
  foto: (fotoId: string) => Promise<Blob | undefined>;
}

const dia = (v: unknown) => String(v ?? '').slice(0, 10).split('-').reverse().join('/');

export async function pdfServicoColetor(d: DadosPdfServico): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;
  const novaPagina = () => {
    pdf.addPage();
    y = 18;
  };
  const precisa = (altura: number) => {
    if (y + altura > 280) novaPagina();
  };

  // Cabeçalho
  try {
    const r = await fetch('/marca/logo-completa.png');
    if (r.ok) pdf.addImage(await dataUrl(await r.blob()), 'PNG', 15, 10, 18, 26);
  } catch {
    /* sem logo */
  }
  pdf.setTextColor(...VERDE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Relatório de serviço do coletor', 38, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...AZUL_ESCURO);
  pdf.text(d.orgao, 38, 24);
  pdf.text(`Centro de Recuperação de Áreas Degradadas · ${d.viveiro}`, 38, 29);
  pdf.setDrawColor(...AZUL_ESCURO);
  pdf.line(15, 40, 195, 40);
  y = 48;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Coletor:', 15, y);
  pdf.text('Período:', 120, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(d.coletor, 33, y);
  pdf.text(d.periodo, 138, y);
  y += 10;

  // Resumo
  const t = d.servico.totais;
  const outras = Object.entries(t.outras_unidades).map(([u, q]) => `${mostrarNumero(q)} ${u}`).join(', ');
  const resumo: [string, string][] = [
    ['Dias de campo', String(t.dias_de_campo)],
    ['Matrizes cadastradas', String(t.matrizes)],
    ['Coletas', `${t.coletas}${t.quilos ? ` · ${mostrarNumero(t.quilos)} kg` : ''}${outras ? ` · ${outras}` : ''}`],
    ['Espécies', String(t.especies)],
    ['Registros de flor e fruto', String(t.registros_flor_fruto)],
  ];
  pdf.setFillColor(...CINZA);
  pdf.rect(15, y - 5, 180, 6 * resumo.length + 4, 'F');
  for (const [r, v] of resumo) {
    pdf.text(r, 18, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(v, 192, y, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    y += 6;
  }
  y += 6;

  const titulo = (texto: string) => {
    precisa(14);
    pdf.setTextColor(...VERDE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(texto, 15, y);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...AZUL_ESCURO);
    y += 7;
  };

  // Matrizes, com fotos
  titulo(`Matrizes cadastradas (${t.matrizes})`);
  if (!d.servico.matrizes.length) {
    pdf.text('Nenhuma matriz no período.', 15, y);
    y += 8;
  }
  for (const m of d.servico.matrizes) {
    const fotos = (d.servico.fotosPorMatriz.get(m.id) ?? []).slice(0, 3);
    const imagens: string[] = [];
    for (const f of fotos) {
      const b = await d.foto(f.id);
      if (b) imagens.push(await dataUrl(b));
    }
    precisa(imagens.length ? 52 : 26);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${String(m.codigo)} · ${d.nomeEspecie(m.especie_id) || 'espécie a identificar'}`, 15, y);
    pdf.setFont('helvetica', 'normal');
    y += 5;
    const local = [d.municipio(m.municipio_id), typeof m.lat === 'number' ? `${(m.lat as number).toFixed(5)}, ${(m.lon as number).toFixed(5)}` : '', m.precisao_m ? `±${m.precisao_m} m` : ''].filter(Boolean).join(' · ');
    pdf.text(`Cadastrada em ${dia(m.criado_no_aparelho_em ?? m.created)} · certeza: ${CERTEZA[String(m.grau_certeza)] ?? '—'}`, 15, y);
    y += 5;
    if (local) {
      pdf.text(`Local: ${local}`, 15, y);
      y += 5;
    }
    if (imagens.length) {
      imagens.forEach((src, i) => pdf.addImage(src, 'JPEG', 15 + i * 44, y, 40, 40));
      y += 44;
    } else if (fotos.length) {
      pdf.setFontSize(8);
      pdf.text(`${fotos.length} foto(s) registradas (não estão guardadas neste aparelho).`, 15, y);
      pdf.setFontSize(10);
      y += 5;
    }
    pdf.setDrawColor(...CINZA);
    pdf.line(15, y, 195, y);
    y += 6;
  }

  // Coletas
  titulo(`Coletas (${t.coletas})`);
  if (!d.servico.coletas.length) {
    pdf.text('Nenhuma coleta no período.', 15, y);
    y += 8;
  } else {
    const cab = () => {
      pdf.setFillColor(...CINZA);
      pdf.rect(15, y - 5, 180, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data', 17, y);
      pdf.text('Matriz', 40, y);
      pdf.text('Espécie', 70, y);
      pdf.text('Material', 145, y);
      pdf.text('Quantidade', 193, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      y += 7;
    };
    cab();
    for (const c of d.servico.coletas) {
      if (y > 275) {
        novaPagina();
        cab();
      }
      const matriz = c.matriz_id ? d.matriz(c.matriz_id) : undefined;
      pdf.text(dia(c.data), 17, y);
      pdf.text(matriz ? String(matriz.codigo ?? '') : 'sem matriz', 40, y);
      pdf.text(pdf.splitTextToSize(d.nomeEspecie(matriz?.especie_id ?? c.especie_id), 72)[0] ?? '', 70, y);
      pdf.text(String(c.material ?? ''), 145, y);
      pdf.text(c.quantidade ? `${mostrarNumero(c.quantidade)} ${c.unidade ?? ''}` : '—', 193, y, { align: 'right' });
      y += 6;
    }
    y += 4;
  }

  // Flor e fruto
  if (d.servico.fenologias.length) {
    titulo(`Flor e fruto (${t.registros_flor_fruto})`);
    for (const f of d.servico.fenologias) {
      precisa(6);
      const fases = Array.isArray(f.fases) ? (f.fases as string[]).join(', ').replace(/_/g, ' ') : '';
      const m = d.matriz(f.matriz_id);
      pdf.text(`${dia(f.data)} · ${String(m?.codigo ?? '')} · ${fases}`, 15, y);
      y += 6;
    }
    y += 4;
  }

  // Assinaturas
  precisa(40);
  y += 14;
  pdf.setDrawColor(...AZUL_ESCURO);
  pdf.line(15, y, 95, y);
  pdf.line(115, y, 195, y);
  pdf.text(d.coletor, 15, y + 5);
  pdf.text('Coletor', 15, y + 10);
  pdf.text('Gestor do viveiro', 115, y + 5);
  pdf.setFontSize(8);
  pdf.text(`Gerado pelo app do CRAD em ${new Date().toLocaleString('pt-BR')}. Dados conforme os registros de campo sincronizados.`, 15, 290);
  return pdf.output('blob');
}
