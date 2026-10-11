/**
 * Sincronização: envia a fila, sobe os arquivos e recebe as alterações.
 * Pode ser chamada a qualquer momento; sem sinal, nada se perde.
 */
import type { Operacao, Registro, RespostaEnvio, RespostaRecebimento } from '@crads/dominio';
import type { BancoCrads, ItemFila } from './db';
import { agora } from './relogio';

/** Como falar com o servidor. Nos testes, um servidor falso implementa isto. */
export interface Transporte {
  enviar(dispositivoId: string, operacoes: Operacao[]): Promise<RespostaEnvio>;
  receber(desde: number, dispositivoId: string): Promise<RespostaRecebimento>;
  enviarArquivo(colecao: string, id: string, campo: string, blob: Blob, nome: string, dispositivoId: string): Promise<{ registro: Registro }>;
}

/** Sem internet ou servidor fora do ar: tenta de novo depois. */
export class SemConexao extends Error {}
/** Sessão expirada: precisa entrar de novo (a fila continua guardada). */
export class SessaoExpirada extends Error {}

export interface ResumoSync {
  enviadas: number;
  recebidos: number;
  arquivos: number;
  avisos: number;
}

const LOTE_ENVIO = 50;

export class Sincronizador {
  private rodando: Promise<ResumoSync> | null = null;

  constructor(
    private db: BancoCrads,
    private transporte: Transporte,
    private dispositivoId: () => string,
  ) {}

  /** Executa uma rodada; chamadas simultâneas reaproveitam a mesma rodada. */
  sincronizar(): Promise<ResumoSync> {
    this.rodando ??= this.rodada().finally(() => (this.rodando = null));
    return this.rodando;
  }

  async pendentes(): Promise<{ operacoes: number; arquivos: number }> {
    return { operacoes: await this.db._fila.count(), arquivos: await this.db._arquivos.count() };
  }

  private async rodada(): Promise<ResumoSync> {
    const resumo: ResumoSync = { enviadas: 0, recebidos: 0, arquivos: 0, avisos: 0 };
    await this.enviarFila(resumo);
    await this.enviarArquivos(resumo);
    await this.receber(resumo);
    await this.db.gravarMeta('ultima_sincronizacao', agora());
    return resumo;
  }

  private async enviarFila(resumo: ResumoSync) {
    // Sobras de uma rodada interrompida voltam a ser enviáveis.
    await this.db._fila.filter((o) => !!o.enviando).modify({ enviando: false });
    for (;;) {
      const lote = await this.db.transaction('rw', this.db._fila, async () => {
        const ops = await this.db._fila.orderBy('n').limit(LOTE_ENVIO).toArray();
        for (const o of ops) await this.db._fila.update(o.n!, { enviando: true });
        return ops;
      });
      if (!lote.length) return;

      let resposta: RespostaEnvio;
      try {
        resposta = await this.transporte.enviar(
          this.dispositivoId(),
          lote.map(({ n: _n, enviando: _e, ...op }) => op),
        );
      } catch (err) {
        await this.db._fila.where('n').anyOf(lote.map((o) => o.n!)).modify({ enviando: false });
        throw err;
      }

      for (const res of resposta.resultados) {
        const op = lote.find((o) => o.op_id === res.op_id);
        if (!op) continue;
        await this.aplicarResultado(op, res, resumo);
      }
      resumo.enviadas += lote.length;
    }
  }

  private async aplicarResultado(op: ItemFila, res: RespostaEnvio['resultados'][number], resumo: ResumoSync) {
    const tabela = this.db.colecao(op.colecao);
    await this.db.transaction('rw', [tabela, this.db._fila, this.db._avisos], async () => {
      await this.db._fila.delete(op.n!);

      if (res.registro) await this.gravarDoServidor(op.colecao, res.registro);
      else if (res.status === 'rejeitada' && op.tipo === 'criar') {
        // Nunca chegou ao servidor: mantém a cópia local para o usuário corrigir.
        await tabela.update(op.registro_id, { _rejeitado: true });
      }

      if (res.status === 'conflito') {
        resumo.avisos++;
        await this.db._avisos.put({
          id: op.op_id,
          tipo: 'conflito',
          colecao: op.colecao,
          registro_id: op.registro_id,
          mensagem: res.motivo ?? 'Outra pessoa mudou este cadastro ao mesmo tempo. Ficou valendo a versão do servidor.',
          detalhes: { conflitos: res.conflitos ?? [], operacao: op },
          criado_em: agora(),
          resolvido: false,
        });
      } else if (res.status === 'rejeitada') {
        resumo.avisos++;
        await this.db._avisos.put({
          id: op.op_id,
          tipo: 'rejeitada',
          colecao: op.colecao,
          registro_id: op.registro_id,
          mensagem: res.motivo ?? 'O servidor não aceitou esta alteração.',
          detalhes: { operacao: op },
          criado_em: agora(),
          resolvido: false,
        });
      }
      if (res.codigo_alterado) {
        await this.db._avisos.put({
          id: `${op.op_id}-codigo`,
          tipo: 'codigo',
          colecao: op.colecao,
          registro_id: op.registro_id,
          mensagem: `O código ${res.codigo_alterado.de} virou ${res.codigo_alterado.para}. Troque a etiqueta se já tiver escrito o código antigo.`,
          detalhes: res.codigo_alterado,
          criado_em: agora(),
          resolvido: false,
        });
      }
    });
  }

  /** Grava o estado do servidor sem perder alterações locais ainda na fila. */
  private async gravarDoServidor(colecao: string, reg: Registro) {
    const tabela = this.db.colecao(colecao);
    const pendentes = await this.db._fila.where('registro_id').equals(reg.id).sortBy('n');
    if (reg.excluido && !pendentes.length) {
      await tabela.delete(reg.id);
      return;
    }
    let local: Registro = { ...reg };
    for (const p of pendentes) {
      if (p.tipo === 'excluir') local = { ...local, excluido: true };
      else local = { ...local, ...p.dados };
    }
    await tabela.put(local);
  }

  private async enviarArquivos(resumo: ResumoSync) {
    const arquivos = await this.db._arquivos.orderBy('n').toArray();
    for (const a of arquivos) {
      // Só sobe depois que o registro existir no servidor.
      const criacaoPendente = await this.db._fila.where('registro_id').equals(a.registro_id).filter((o) => o.tipo === 'criar').count();
      if (criacaoPendente) continue;
      const { registro } = await this.transporte.enviarArquivo(a.colecao, a.registro_id, a.campo, a.blob, a.nome, this.dispositivoId());
      await this.db.transaction('rw', [this.db.colecao(a.colecao), this.db._arquivos, this.db._fila], async () => {
        await this.db._arquivos.delete(a.n!);
        await this.gravarDoServidor(a.colecao, registro);
      });
      resumo.arquivos++;
    }
  }

  private async receber(resumo: ResumoSync) {
    for (;;) {
      const desde = await this.db.lerMeta<number>('cursor', 0);
      const r = await this.transporte.receber(desde, this.dispositivoId());
      const tabelas = [...new Set(r.registros.map((x) => x.colecao))].map((c) => this.db.colecao(c));
      await this.db.transaction('rw', [...tabelas, this.db._fila, this.db._meta], async () => {
        for (const { colecao, registro } of r.registros) await this.gravarDoServidor(colecao, registro);
        await this.db.gravarMeta('cursor', r.cursor);
      });
      resumo.recebidos += r.registros.length;
      if (!r.mais || r.cursor === desde) return;
    }
  }
}
