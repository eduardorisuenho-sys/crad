/**
 * Perguntas padrão do assistente (morfologia geral, sem dado de espécie) e
 * espécies FICTÍCIAS para testes e treinamento. Nenhum dado botânico real.
 */

export interface OpcaoPadrao {
  chave: string;
  rotulo: string;
  /** nome da figura desenhada no app (componente FiguraOpcao) */
  figura: string;
}

export interface PerguntaPadrao {
  chave: string;
  texto: string;
  parte: string;
  ordem: number;
  opcoes: OpcaoPadrao[];
}

export const PERGUNTAS_PADRAO: PerguntaPadrao[] = [
  {
    chave: 'folha',
    texto: 'Como é a folha?',
    parte: 'folha',
    ordem: 1,
    opcoes: [
      { chave: 'folha_simples', rotulo: 'Simples (uma folha só)', figura: 'folha_simples' },
      { chave: 'folha_composta', rotulo: 'Composta (vários folíolos)', figura: 'folha_composta' },
      { chave: 'folha_bipinada', rotulo: 'Muito dividida (folíolos miúdos)', figura: 'folha_bipinada' },
      { chave: 'folha_digitada', rotulo: 'Em forma de mão', figura: 'folha_digitada' },
    ],
  },
  {
    chave: 'disposicao',
    texto: 'Como as folhas saem do galho?',
    parte: 'ramo',
    ordem: 2,
    opcoes: [
      { chave: 'alterna', rotulo: 'Uma de cada vez (alternas)', figura: 'alterna' },
      { chave: 'oposta', rotulo: 'Duas de frente (opostas)', figura: 'oposta' },
      { chave: 'verticilada', rotulo: 'Várias juntas (em roda)', figura: 'verticilada' },
    ],
  },
  {
    chave: 'latex',
    texto: 'Ao quebrar a folha ou riscar a casca, sai leite ou resina?',
    parte: 'casca',
    ordem: 3,
    opcoes: [
      { chave: 'latex_branco', rotulo: 'Sai leite branco', figura: 'latex_branco' },
      { chave: 'latex_colorido', rotulo: 'Sai líquido colorido ou resina', figura: 'latex_colorido' },
      { chave: 'sem_latex', rotulo: 'Não sai nada', figura: 'sem_latex' },
    ],
  },
  {
    chave: 'espinhos',
    texto: 'Tem espinhos no tronco ou nos galhos?',
    parte: 'tronco',
    ordem: 4,
    opcoes: [
      { chave: 'com_espinhos', rotulo: 'Tem espinhos', figura: 'com_espinhos' },
      { chave: 'sem_espinhos', rotulo: 'Não tem', figura: 'sem_espinhos' },
    ],
  },
  {
    chave: 'casca',
    texto: 'Como é a casca do tronco?',
    parte: 'casca',
    ordem: 5,
    opcoes: [
      { chave: 'casca_lisa', rotulo: 'Lisa', figura: 'casca_lisa' },
      { chave: 'casca_rugosa', rotulo: 'Rachada ou rugosa', figura: 'casca_rugosa' },
      { chave: 'casca_placas', rotulo: 'Soltando em placas', figura: 'casca_placas' },
      { chave: 'casca_cortica', rotulo: 'Grossa, de cortiça', figura: 'casca_cortica' },
    ],
  },
  {
    chave: 'cor_flor',
    texto: 'Qual a cor da flor?',
    parte: 'flor',
    ordem: 6,
    opcoes: [
      { chave: 'flor_branca', rotulo: 'Branca', figura: 'flor_branca' },
      { chave: 'flor_amarela', rotulo: 'Amarela', figura: 'flor_amarela' },
      { chave: 'flor_rosa', rotulo: 'Rosa ou roxa', figura: 'flor_rosa' },
      { chave: 'flor_vermelha', rotulo: 'Vermelha ou laranja', figura: 'flor_vermelha' },
      { chave: 'flor_verde', rotulo: 'Verde ou creme', figura: 'flor_verde' },
    ],
  },
  {
    chave: 'fruto',
    texto: 'Como é o fruto?',
    parte: 'fruto',
    ordem: 7,
    opcoes: [
      { chave: 'fruto_vagem', rotulo: 'Vagem', figura: 'fruto_vagem' },
      { chave: 'fruto_carnoso', rotulo: 'Carnoso (polpa)', figura: 'fruto_carnoso' },
      { chave: 'fruto_alado', rotulo: 'Seco com asa', figura: 'fruto_alado' },
      { chave: 'fruto_capsula', rotulo: 'Seco que abre (cápsula)', figura: 'fruto_capsula' },
      { chave: 'fruto_coco', rotulo: 'Coco ou caroço grande', figura: 'fruto_coco' },
    ],
  },
];

export interface EspecieFicticia {
  chave: string;
  nome_cientifico: string;
  nome_popular: string;
  familia: string;
  opcoes: string[];
  meses_flor: number[];
  meses_fruto: number[];
  biomas: string[];
}

/** Espécies inventadas, só para testar e treinar o uso do assistente. */
export const ESPECIES_FICTICIAS: EspecieFicticia[] = [
  { chave: 'a', nome_cientifico: 'Ficticia aurea', nome_popular: 'Ipê-de-mentira', familia: 'Ficticiaceae', opcoes: ['folha_digitada', 'oposta', 'sem_latex', 'sem_espinhos', 'casca_rugosa', 'flor_amarela', 'fruto_capsula'], meses_flor: [7, 8, 9], meses_fruto: [9, 10], biomas: ['cerrado', 'amazonia'] },
  { chave: 'b', nome_cientifico: 'Ficticia rosea', nome_popular: 'Ipê-rosa-de-teste', familia: 'Ficticiaceae', opcoes: ['folha_digitada', 'oposta', 'sem_latex', 'sem_espinhos', 'casca_lisa', 'flor_rosa', 'fruto_capsula'], meses_flor: [6, 7], meses_fruto: [8, 9], biomas: ['cerrado'] },
  { chave: 'c', nome_cientifico: 'Imaginaria leguminosa', nome_popular: 'Angico-de-teste', familia: 'Ficticiaceae', opcoes: ['folha_bipinada', 'alterna', 'latex_colorido', 'com_espinhos', 'casca_rugosa', 'flor_branca', 'fruto_vagem'], meses_flor: [10, 11], meses_fruto: [6, 7, 8], biomas: ['cerrado', 'caatinga'] },
  { chave: 'd', nome_cientifico: 'Imaginaria lactea', nome_popular: 'Leiteira-de-teste', familia: 'Ficticiaceae', opcoes: ['folha_simples', 'alterna', 'latex_branco', 'sem_espinhos', 'casca_lisa', 'flor_verde', 'fruto_carnoso'], meses_flor: [1, 2], meses_fruto: [3, 4], biomas: ['amazonia'] },
  { chave: 'e', nome_cientifico: 'Inventa palmaris', nome_popular: 'Palmeira-de-teste', familia: 'Ficticiaceae', opcoes: ['folha_composta', 'alterna', 'sem_latex', 'com_espinhos', 'casca_placas', 'flor_verde', 'fruto_coco'], meses_flor: [9, 10], meses_fruto: [1, 2, 3], biomas: ['cerrado', 'amazonia'] },
];
