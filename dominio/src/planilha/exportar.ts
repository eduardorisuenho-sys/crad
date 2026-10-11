/**
 * Exportação: planilha Excel (.xlsx), CSV e KML (Google Earth / QGIS).
 * Gerados no aparelho, sem internet e sem bibliotecas extras.
 */
import { strToU8, zipSync } from 'fflate';

export interface AbaExportar {
  nome: string;
  linhas: unknown[][];
}

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function coluna(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function folha(linhas: unknown[][]): string {
  const rows = linhas
    .map((linha, r) => {
      const cels = linha
        .map((v, c) => {
          const ref = `${coluna(c)}${r + 1}`;
          if (v === null || v === undefined || v === '') return '';
          if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${r === 0 ? ' s="1"' : ''}><v>${v}</v></c>`;
          if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cels}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`;
}

/** Nome de aba válido no Excel (até 31 caracteres, sem []:*?/\). */
const nomeAba = (n: string) => n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Planilha';

export function escreverXlsx(abas: AbaExportar[]): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas
        .map((a, i) => `<sheet name="${xml(nomeAba(a.nome))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    // estilo 1 = cabeçalho em negrito
    'xl/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" xfId="0"/><xf fontId="1" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
  };
  abas.forEach((a, i) => (arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(folha(a.linhas))));
  return zipSync(arquivos);
}

/** CSV com ponto e vírgula e BOM (abre certo no Excel em português). */
export function escreverCsv(linhas: unknown[][]): string {
  const campo = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + linhas.map((l) => l.map(campo).join(';')).join('\r\n');
}

export interface PontoKml {
  nome: string;
  lat: number;
  lon: number;
  descricao?: Record<string, unknown>;
}

/** KML com uma pasta por camada (matrizes, coletas, plantios…). */
export function escreverKml(titulo: string, pastas: { nome: string; cor: string; pontos: PontoKml[] }[]): string {
  // cor KML = aabbggrr
  const kmlCor = (hex: string) => `ff${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;
  const estilos = pastas.map((p, i) => `<Style id="e${i}"><IconStyle><color>${kmlCor(p.cor)}</color><scale>1.1</scale></IconStyle></Style>`).join('');
  const corpo = pastas
    .map(
      (p, i) =>
        `<Folder><name>${xml(p.nome)}</name>${p.pontos
          .map((pt) => {
            const dados = Object.entries(pt.descricao ?? {})
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => `<Data name="${xml(k)}"><value>${xml(String(v))}</value></Data>`)
              .join('');
            return `<Placemark><name>${xml(pt.nome)}</name><styleUrl>#e${i}</styleUrl><ExtendedData>${dados}</ExtendedData><Point><coordinates>${pt.lon},${pt.lat},0</coordinates></Point></Placemark>`;
          })
          .join('')}</Folder>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(titulo)}</name>${estilos}${corpo}</Document></kml>`;
}
