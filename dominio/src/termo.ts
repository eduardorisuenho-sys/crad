/**
 * Termo de compromisso e declaração que quem pede mudas lê e aceita antes de
 * enviar o pedido. O administrador pode trocar o texto (parâmetro
 * `termo_compromisso`); os marcadores entre colchetes são preenchidos com os
 * dados do pedido. O texto aceito fica guardado no pedido.
 */

export const TERMO_COMPROMISSO_PADRAO = `TERMO DE COMPROMISSO E DECLARAÇÃO

Eu, [NOME], declaro, sob as penas da lei, que as informações prestadas neste formulário são verdadeiras e completas.

Declaro não possuir passivo ambiental registrado junto ao Instituto Natureza do Tocantins (NATURATINS) e que não estou utilizando estas mudas para cumprimento de PRAD, Recuperação de Áreas Degradadas ou qualquer outra modalidade de compensação/penalidade ambiental.

COMPROMETIDO(A), eu me responsabilizo por:

Utilizar as mudas nativas solicitadas ([ESPÉCIES E QUANTITATIVO]) EXCLUSIVAMENTE no plantio indicado nas coordenadas [COORDENADAS UTM/DECIMAIS] e área de [ÁREA TOTAL], conforme justificativa e metodologia descritas.

Realizar o plantio conforme boas práticas silviculturais, garantindo preparo adequado do solo, espaçamento correto e proteção inicial das mudas.

Monitorar e manter as mudas por 12 (doze) meses após o plantio, controle de pragas, capina e proteção contra incêndios e pastejo.

Elaborar e enviar RELATÓRIO SIMPLIFICADO DE EXECUÇÃO em até 30 dias após o término dos 12 meses, contendo:

Taxa de sobrevivência das mudas (estimativa %);

Registros fotográficos georreferenciados (antes, durante e após 12 meses);

Relação de problemas encontrados e soluções adotadas.

O relatório deverá ser enviado para o E-Mail: geprh2023@gmail.com

AUTORIZAÇÕES E RESPONSABILIDADES:

Autorizo vistorias técnicas para verificação do plantio e sobrevivência das mudas.

Assumo total responsabilidade civil e administrativa por descumprimento deste compromisso, sujeitando-me às sanções previstas na Lei Federal nº 9.605/1998 (Crimes Ambientais), Código Florestal (Lei nº 12.651/2012) e legislações estaduais aplicáveis.

As mudas não poderão ser comercializadas, doadas ou destinadas a outros fins.

Declaro estar ciente de que fornecer informações falsas ou não cumprir este compromisso configura falsidade ideológica (art. 299 do Código Penal) e sujeita a perdas de benefícios futuros.

Palmas/TO, [DATA]`;

export interface DadosTermo {
  nome?: string;
  itens: { especie: string; quantidade: number }[];
  lat?: number | null;
  lon?: number | null;
  /** local escrito (quando não há coordenadas) */
  local?: string;
  area_ha?: number | null;
  /** data do aceite (AAAA-MM-DD) */
  data: string;
}

const numero = (n: number, casas = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });

/** Preenche os marcadores do termo; o que não foi informado fica escrito como tal. */
export function preencherTermo(texto: string, d: DadosTermo): string {
  const especies = d.itens.length ? d.itens.map((i) => `${i.especie}: ${i.quantidade}`).join('; ') + `; total ${d.itens.reduce((s, i) => s + i.quantidade, 0)} mudas` : 'não informado';
  const temPonto = typeof d.lat === 'number' && typeof d.lon === 'number' && Number.isFinite(d.lat) && Number.isFinite(d.lon) && !(d.lat === 0 && d.lon === 0);
  const coordenadas = temPonto ? `${d.lat!.toFixed(6)}, ${d.lon!.toFixed(6)}` : d.local?.trim() ? `não informadas (local: ${d.local.trim()})` : 'não informadas';
  const area = d.area_ha && d.area_ha > 0 ? `${numero(d.area_ha, 4)} ha` : 'não informada';
  const [a, m, dia] = d.data.slice(0, 10).split('-');
  const trocas: [RegExp, string][] = [
    [/\[NOME\]/gi, d.nome?.trim() || '______________________________'],
    [/\[ESP[ÉE]CIES E QUANTITATIVO\]/gi, especies],
    [/\[COORDENADAS[^\]]*\]/gi, coordenadas],
    [/\[[ÁA]REA TOTAL\]/gi, area],
    [/\[DATA\]/gi, dia && m && a ? `${dia}/${m}/${a}` : d.data],
  ];
  return trocas.reduce((t, [re, v]) => t.replace(re, v), texto);
}
