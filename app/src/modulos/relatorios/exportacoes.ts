/** Planilha, CSV, KML e PDF dos relatórios, gerados no aparelho. */
import { escreverCsv, escreverKml, escreverXlsx, pontoDoPlantio, type AbaExportar, type DadosRelatorio, type FiltroRelatorio, type Indicadores } from '@crads/dominio';
import { ROTULO_FASE } from '../viveiro/dados';
import { nomesDe } from './dados';

const dia = (v: unknown) => String(v ?? '').slice(0, 10);
const noPeriodo = (v: unknown, f: FiltroRelatorio) => {
  const d = dia(v);
  return (!f.inicio || d >= f.inicio) && (!f.fim || d <= f.fim);
};
const doViveiro = (r: Record<string, unknown>, f: FiltroRelatorio) => !f.viveiros || f.viveiros.includes(String(r.viveiro_id));

/** Tabelas para a planilha (sem CPF, telefone ou documento). */
export function tabelas(d: DadosRelatorio, f: FiltroRelatorio, programa?: Set<string>): AbaExportar[] {
  const nomes = nomesDe(d);
  const viveiros = new Map(d.viveiros.map((v) => [v.id, String(v.nome)]));
  const codigoMatriz = new Map(d.matrizes.map((m) => [m.id, String(m.codigo)]));
  const especie = (id: unknown) => nomes.get(String(id)) ?? '';
  const doacoes = d.doacoes.filter((x) => doViveiro(x, f) && noPeriodo(x.criado_no_aparelho_em, f) && (!programa || programa.has(x.id)));
  const idsDoacoes = new Map(doacoes.map((x) => [x.id, x]));
  return [
    {
      nome: 'Matrizes',
      linhas: [
        ['Código', 'Espécie', 'Certeza', 'Viveiro', 'Latitude', 'Longitude', 'Altura (m)', 'DAP (cm)', 'Cadastrada em'],
        ...d.matrizes
          .filter((m) => doViveiro(m, f) && noPeriodo(m.criado_no_aparelho_em, f))
          .map((m) => [m.codigo, especie(m.especie_id), m.grau_certeza, viveiros.get(String(m.viveiro_id)), m.lat, m.lon, m.altura_m || null, m.dap_cm || null, dia(m.criado_no_aparelho_em)]),
      ],
    },
    {
      nome: 'Coletas',
      linhas: [
        ['Data', 'Matriz', 'Espécie', 'Quantidade', 'Unidade', 'Material', 'Viveiro'],
        ...d.coletas
          .filter((c) => doViveiro(c, f) && noPeriodo(c.data, f))
          .map((c) => {
            const m = d.matrizes.find((x) => x.id === c.matriz_id);
            return [dia(c.data), codigoMatriz.get(String(c.matriz_id)), especie(m?.especie_id), c.quantidade, c.unidade, c.material, viveiros.get(String(c.viveiro_id))];
          }),
      ],
    },
    {
      nome: 'Lotes de mudas',
      linhas: [
        ['Código', 'Espécie', 'Viveiro', 'Origem', 'Semeadura', 'Sementes semeadas', 'Fase'],
        ...d.lotesMudas.filter((l) => doViveiro(l, f)).map((l) => [l.codigo, especie(l.especie_id), viveiros.get(String(l.viveiro_id)), l.origem === 'estoque_inicial' ? 'estoque inicial' : 'semeadura', dia(l.data_semeadura), l.sementes_semeadas || null, ROTULO_FASE[String(l.fase_atual)] ?? l.fase_atual]),
      ],
    },
    {
      nome: 'Doações',
      linhas: [
        ['Código', 'Situação', 'Espécie', 'Pedidas', 'Aprovadas', 'Entregues', 'Finalidade', 'Local', 'Viveiro', 'Plantando Água'],
        ...d.doacaoItens
          .filter((i) => idsDoacoes.has(String(i.doacao_id)))
          .map((i) => {
            const x = idsDoacoes.get(String(i.doacao_id))!;
            return [x.codigo, x.situacao, especie(i.especie_id), i.qtd_pedida || 0, i.qtd_aprovada || 0, i.qtd_entregue || 0, x.finalidade, x.local_plantio, viveiros.get(String(x.viveiro_id)), programa?.has(x.id) ? 'sim' : ''];
          }),
      ],
    },
  ];
}

export function indicadoresEmLinhas(r: Indicadores): unknown[][] {
  return [
    ['Indicador', 'Valor'],
    ['Matrizes cadastradas', r.matrizes.total],
    ['Matrizes ativas', r.matrizes.ativas],
    ['Espécies com matriz', r.matrizes.especies],
    ['Coletas', r.coletas.total],
    ['Coletado (kg)', r.coletas.kg],
    ['Estoque de sementes (g)', r.sementes.estoque_g],
    ['Sementes semeadas', r.mudas.semeadas],
    ['Taxa de germinação (%)', r.mudas.taxa_germinacao],
    ['Perdas no viveiro', r.mudas.perdas],
    ['Mudas do estoque inicial (sem semeadura registrada)', r.mudas.estoque_inicial],
    ['Mudas prontas para doação', r.mudas.por_fase.pronta ?? 0],
    ['Mudas em formação', Object.entries(r.mudas.por_fase).reduce((s, [f, n]) => s + (f === 'pronta' ? 0 : n), 0)],
    ['Pedidos de doação', r.doacoes.pedidos],
    ['Mudas entregues', r.doacoes.mudas_entregues],
    ['Doações do Plantando Água', r.doacoes.programa],
    ['Mudas plantadas', r.plantio.plantadas],
    ['Sobrevivência (%)', r.plantio.sobrevivencia],
  ];
}

/** KML interno (com coordenadas exatas): matrizes, coletas e plantios. */
export function kml(d: DadosRelatorio, f: FiltroRelatorio, programa?: Set<string>): string {
  const nomes = nomesDe(d);
  const especie = (id: unknown) => nomes.get(String(id)) ?? '';
  const ok = (lat: unknown, lon: unknown) => typeof lat === 'number' && typeof lon === 'number';
  const plantios = d.plantios.filter((p) => doViveiro(p, f) && noPeriodo(p.data, f) && (!programa || programa.has(String(p.doacao_id))));
  return escreverKml('CRAD', [
    {
      nome: 'Matrizes',
      cor: '#48672f',
      pontos: programa
        ? []
        : d.matrizes
            .filter((m) => doViveiro(m, f) && ok(m.lat, m.lon))
            .map((m) => ({ nome: String(m.codigo), lat: m.lat as number, lon: m.lon as number, descricao: { especie: especie(m.especie_id), certeza: m.grau_certeza } })),
    },
    {
      nome: 'Coletas',
      cor: '#259ad4',
      pontos: programa
        ? []
        : d.coletas
            .filter((c) => doViveiro(c, f) && noPeriodo(c.data, f) && ok(c.lat, c.lon))
            .map((c) => ({ nome: `Coleta ${dia(c.data)}`, lat: c.lat as number, lon: c.lon as number, descricao: { quantidade: c.quantidade, unidade: c.unidade } })),
    },
    {
      nome: 'Plantios',
      cor: '#33618d',
      pontos: plantios
        .map((p) => ({ p, pt: pontoDoPlantio(p.geometria) }))
        .filter((x) => x.pt)
        .map(({ p, pt }) => {
          const doacao = d.doacoes.find((x) => x.id === p.doacao_id);
          const mudas = d.plantioItens.filter((i) => i.plantio_id === p.id).reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
          return { nome: String(doacao?.codigo ?? 'Plantio'), lat: pt!.lat, lon: pt!.lon, descricao: { data: dia(p.data), mudas, plantando_agua: programa?.has(String(p.doacao_id)) ? 'sim' : '' } };
        }),
    },
  ]);
}

export function planilha(d: DadosRelatorio, f: FiltroRelatorio, r: Indicadores, programa?: Set<string>): Blob {
  const bytes = escreverXlsx([{ nome: 'Indicadores', linhas: indicadoresEmLinhas(r) }, ...tabelas(d, f, programa)]);
  return new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function csvIndicadores(r: Indicadores): Blob {
  return new Blob([escreverCsv(indicadoresEmLinhas(r))], { type: 'text/csv;charset=utf-8' });
}

/** PDF de prestação de contas com os indicadores. */
export async function pdfIndicadores(titulo: string, subtitulo: string, r: Indicadores, orgao: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  try {
    const b = await (await fetch('/marca/logo-completa.png')).blob();
    const url = await new Promise<string>((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.readAsDataURL(b);
    });
    pdf.addImage(url, 'PNG', 15, 10, 18, 26);
  } catch {
    /* sem logo */
  }
  pdf.setTextColor(72, 103, 47);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(titulo, 38, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(51, 97, 141);
  pdf.text(orgao, 38, 24);
  pdf.text(subtitulo, 38, 29);
  pdf.line(15, 40, 195, 40);
  let y = 50;
  for (const [rotulo, valor] of indicadoresEmLinhas(r).slice(1)) {
    pdf.text(String(rotulo), 17, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(valor === null || valor === undefined ? '—' : String(valor).replace('.', ','), 193, y, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setDrawColor(235, 239, 244);
    pdf.line(15, y + 2.5, 195, y + 2.5);
    y += 8;
  }
  pdf.setFontSize(8);
  pdf.text(`Gerado pelo app do CRAD em ${new Date().toLocaleString('pt-BR')}.`, 15, 285);
  return pdf.output('blob');
}
