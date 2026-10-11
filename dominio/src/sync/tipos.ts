/** Formato das mensagens de sincronização entre aparelho e servidor. */

export interface Registro {
  id: string;
  versao: number;
  seq?: number;
  excluido?: boolean;
  [campo: string]: unknown;
}

export type TipoOperacao = 'criar' | 'alterar' | 'excluir';

/** Uma alteração feita no aparelho, guardada na fila até ser enviada. */
export interface Operacao {
  /** id único da operação: reenviar a mesma operação não duplica nada */
  op_id: string;
  colecao: string;
  registro_id: string;
  tipo: TipoOperacao;
  /** valores novos dos campos alterados */
  dados: Record<string, unknown>;
  /** valores desses campos antes da edição (para a fusão campo a campo) */
  base: Record<string, unknown>;
  /** versão do registro no aparelho quando foi editado (0 ao criar) */
  base_versao: number;
  criado_no_aparelho_em: string;
  dispositivo_id: string;
}

export interface ConflitoCampo {
  campo: string;
  valor_base: unknown;
  valor_aparelho: unknown;
  valor_servidor: unknown;
}

export type StatusOperacao = 'aplicada' | 'conflito' | 'rejeitada';

export interface ResultadoOperacao {
  op_id: string;
  colecao: string;
  registro_id: string;
  status: StatusOperacao;
  /** estado do registro no servidor depois da operação */
  registro?: Registro;
  conflitos?: ConflitoCampo[];
  motivo?: string;
  /** o servidor trocou o código (provisório ou repetido) */
  codigo_alterado?: { de: string; para: string };
}

export interface PedidoEnvio {
  dispositivo_id: string;
  operacoes: Operacao[];
}

export interface RespostaEnvio {
  resultados: ResultadoOperacao[];
}

export interface RespostaRecebimento {
  registros: { colecao: string; registro: Registro }[];
  /** maior seq entregue; usar como `desde` na próxima chamada */
  cursor: number;
  /** ainda há mais registros depois deste cursor */
  mais: boolean;
}
