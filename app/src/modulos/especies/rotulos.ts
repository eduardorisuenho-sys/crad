/** Como cada campo da ficha aparece na tela. */
import { COLUNAS_ESPECIE } from '@crads/dominio';

export const GRUPOS_FICHA: { titulo: string; campos: string[] }[] = [
  { titulo: 'Nome', campos: ['nome_cientifico', 'autor', 'familia', 'origem', 'forma_vida', 'endemica'] },
  { titulo: 'Como reconhecer em campo', campos: ['folha', 'disposicao', 'latex', 'espinhos', 'casca', 'flor', 'fruto'] },
  { titulo: 'Época', campos: ['meses_flor', 'meses_fruto'] },
  { titulo: 'Sementes e mudas', campos: ['sementes_por_kg', 'dormencia', 'tratamento_pre_germinativo', 'dias_germinacao', 'meses_ate_pronta', 'grupo_sucessional'] },
  { titulo: 'Referência', campos: ['lorenzi_volume', 'lorenzi_pagina', 'flora_id'] },
  { titulo: 'Situação', campos: ['publicada', 'revisar', 'nota_revisao', 'ficticia'] },
];

const EXTRAS: Record<string, string> = {
  endemica: 'Endêmica do Brasil',
  flora_id: 'Código na Flora e Funga',
  publicada: 'Aparece no catálogo',
  revisar: 'Precisa de revisão',
  nota_revisao: 'O que revisar',
  ficticia: 'Espécie fictícia (só para testes)',
};

export function rotulo(campo: string): string {
  return COLUNAS_ESPECIE[campo]?.rotulo ?? EXTRAS[campo] ?? campo.replace(/_/g, ' ');
}

export const NOMES_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
