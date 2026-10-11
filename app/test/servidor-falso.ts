/**
 * Servidor falso em memória, com a MESMA lógica de resolução do servidor real
 * (resolverOperacao e montarRecebimento do domínio). Permite simular
 * "sem internet" e dois aparelhos ao mesmo tempo.
 */
import {
  COLECOES,
  codigoMatriz,
  colecao,
  existeColecao,
  montarRecebimento,
  resolverOperacao,
  type ContextoUsuario,
  type Operacao,
  type Registro,
  type RespostaEnvio,
  type RespostaRecebimento,
} from '@crads/dominio';
import { SemConexao, type Transporte } from '../src/dados/sincronizador';

export class ServidorFalso {
  online = true;
  dados = new Map<string, Map<string, Registro>>();
  feitas = new Map<string, unknown>();
  seq = 0;
  proximoMT = 900;
  chamadasEnvio = 0;

  tabela(nome: string) {
    if (!this.dados.has(nome)) this.dados.set(nome, new Map());
    return this.dados.get(nome)!;
  }

  /** Um "aparelho" conectado como este usuário. */
  transporte(ctx: ContextoUsuario): Transporte {
    const checar = () => {
      if (!this.online) throw new SemConexao('sem sinal');
    };
    return {
      enviar: async (_disp: string, operacoes: Operacao[]): Promise<RespostaEnvio> => {
        checar();
        this.chamadasEnvio++;
        return { resultados: operacoes.map((op) => this.aplicar(op, ctx)) };
      },
      receber: async (desde: number): Promise<RespostaRecebimento> => {
        checar();
        const porColecao = COLECOES.map((c) => ({ colecao: c, registros: [...this.tabela(c.nome).values()].filter((r) => (r.seq ?? 0) > desde) }));
        return montarRecebimento(porColecao, ctx, desde, 3); // limite baixo para testar a paginação
      },
      enviarArquivo: async (col: string, id: string, campo: string, _blob: Blob, nome: string) => {
        checar();
        const r = this.tabela(col).get(id);
        if (!r) throw new Error('registro ainda não sincronizado');
        const novo = { ...r, [campo]: nome, seq: ++this.seq };
        this.tabela(col).set(id, novo);
        return { registro: novo };
      },
    };
  }

  aplicar(op: Operacao, ctx: ContextoUsuario) {
    if (this.feitas.has(op.op_id)) return this.feitas.get(op.op_id) as RespostaEnvio['resultados'][number];
    const atual = existeColecao(op.colecao) ? this.tabela(op.colecao).get(op.registro_id) ?? null : null;
    const d = resolverOperacao(op, atual, ctx, {
      codigoEmUso: (c, codigo, exceto) => [...this.tabela(c).values()].some((r) => r.codigo === codigo && r.id !== exceto),
      novoCodigo: () => codigoMatriz(this.proximoMT++),
      faixasDoDispositivo: () => [],
    });
    if (d.gravar) {
      const salvo = { ...d.gravar, seq: ++this.seq };
      this.tabela(op.colecao).set(salvo.id, salvo);
      d.resultado.registro = salvo;
    }
    if (d.resultado.status !== 'rejeitada') this.feitas.set(op.op_id, d.resultado);
    return d.resultado;
  }

  /** Alteração feita direto no servidor (ex.: por outro usuário). */
  alterarDireto(col: string, id: string, campos: Record<string, unknown>) {
    const r = this.tabela(col).get(id)!;
    this.tabela(col).set(id, { ...r, ...campos, versao: r.versao + 1, seq: ++this.seq });
  }
}

export { colecao };
