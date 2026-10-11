/**
 * Gravação local. Toda alteração vai para o banco do aparelho e para a fila de
 * envio na mesma transação. Nada aqui depende de internet.
 */
import {
  colecao as buscarColecao,
  codigoProvisorio,
  gerarId,
  iguais,
  nomesCampos,
  proximoDaFaixa,
  type FaixaCodigo,
  type PrefixoCodigo,
  type Registro,
} from '@crads/dominio';
import type { BancoCrads, ItemFila } from './db';
import { agora } from './relogio';

export interface Contexto {
  dispositivoId: string;
  /** viveiro em que o usuário está trabalhando; preenche viveiro_id */
  viveiroId?: string;
}

export class Repositorio {
  constructor(
    private db: BancoCrads,
    private ctx: () => Contexto,
  ) {}

  /** Cria (sem id) ou altera (com id) um registro. Devolve o registro local. */
  async salvar(nomeColecao: string, dados: Record<string, unknown>, id?: string): Promise<Registro> {
    const col = buscarColecao(nomeColecao);
    const tabela = this.db.colecao(nomeColecao);
    const { dispositivoId, viveiroId } = this.ctx();
    const permitidos = new Set(nomesCampos(col));
    const limpos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados)) if (permitidos.has(k)) limpos[k] = v;

    return this.db.transaction('rw', [tabela, this.db._fila], async () => {
      const atual = id ? await tabela.get(id) : undefined;

      if (!atual) {
        if (col.porViveiro && !limpos.viveiro_id) limpos.viveiro_id = viveiroId;
        const novo: Registro = {
          ...limpos,
          id: id ?? gerarId(),
          versao: 0, // vira 1 quando o servidor confirmar
          excluido: false,
          dispositivo_id: dispositivoId,
          criado_no_aparelho_em: agora(),
        };
        await tabela.put(novo);
        await this.db._fila.add({
          op_id: gerarId(),
          colecao: nomeColecao,
          registro_id: novo.id,
          tipo: 'criar',
          dados: limpos,
          base: {},
          base_versao: 0,
          criado_no_aparelho_em: novo.criado_no_aparelho_em as string,
          dispositivo_id: dispositivoId,
        });
        return novo;
      }

      const mudou: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(limpos)) if (!iguais(atual[k], v)) mudou[k] = v;
      if (!Object.keys(mudou).length) return atual;

      const atualizado: Registro = { ...atual, ...mudou };
      await tabela.put(atualizado);

      // Junta com uma operação ainda não enviada do mesmo registro.
      const aberta = await this.operacaoAberta(atual.id);
      if (aberta && aberta.tipo !== 'excluir') {
        const base = { ...aberta.base };
        if (aberta.tipo === 'alterar') for (const k of Object.keys(mudou)) if (!(k in base)) base[k] = atual[k];
        await this.db._fila.update(aberta.n!, { dados: { ...aberta.dados, ...mudou }, base });
      } else {
        const base: Record<string, unknown> = {};
        for (const k of Object.keys(mudou)) base[k] = atual[k];
        await this.db._fila.add({
          op_id: gerarId(),
          colecao: nomeColecao,
          registro_id: atual.id,
          tipo: 'alterar',
          dados: mudou,
          base,
          base_versao: atual.versao,
          criado_no_aparelho_em: agora(),
          dispositivo_id: dispositivoId,
        });
      }
      return atualizado;
    });
  }

  /** Exclusão lógica. Se o registro nunca chegou ao servidor, some da fila. */
  async excluir(nomeColecao: string, id: string): Promise<void> {
    const col = buscarColecao(nomeColecao);
    const tabela = this.db.colecao(nomeColecao);
    if (col.natureza === 'evento') throw new Error('Eventos não podem ser excluídos. Registre um evento de correção.');
    await this.db.transaction('rw', [tabela, this.db._fila, this.db._arquivos], async () => {
      const atual = await tabela.get(id);
      if (!atual) return;
      const aberta = await this.operacaoAberta(id);
      if (aberta?.tipo === 'criar') {
        await this.db._fila.delete(aberta.n!);
        await this.db._arquivos.where('registro_id').equals(id).delete();
        await tabela.delete(id);
        return;
      }
      if (aberta) await this.db._fila.delete(aberta.n!);
      await tabela.put({ ...atual, excluido: true });
      await this.db._fila.add({
        op_id: gerarId(),
        colecao: nomeColecao,
        registro_id: id,
        tipo: 'excluir',
        dados: {},
        base: {},
        base_versao: atual.versao,
        criado_no_aparelho_em: agora(),
        dispositivo_id: this.ctx().dispositivoId,
      });
    });
  }

  /** Guarda um arquivo (já comprimido) para subir quando houver sinal. */
  async anexarArquivo(nomeColecao: string, registroId: string, campo: string, blob: Blob, nome: string): Promise<void> {
    const col = buscarColecao(nomeColecao);
    if (!col.campos.some((c) => c.nome === campo && c.tipo === 'arquivo')) throw new Error(`${nomeColecao}.${campo} não é campo de arquivo`);
    await this.db.transaction('rw', this.db._arquivos, async () => {
      await this.db._arquivos.where('registro_id').equals(registroId).filter((a) => a.campo === campo).delete();
      await this.db._arquivos.add({ colecao: nomeColecao, registro_id: registroId, campo, nome, blob, criado_em: agora() });
    });
  }

  /** Lista registros ativos de uma coleção (no viveiro atual, quando for separada por viveiro). */
  async listar(nomeColecao: string, filtro?: (r: Registro) => boolean): Promise<Registro[]> {
    const col = buscarColecao(nomeColecao);
    const tabela = this.db.colecao(nomeColecao);
    const { viveiroId } = this.ctx();
    const base = col.porViveiro && viveiroId ? tabela.where('viveiro_id').equals(viveiroId) : tabela.toCollection();
    return base.filter((r) => !r.excluido && (!filtro || filtro(r))).toArray();
  }

  /** Próximo código (MT, LS, DO) da faixa reservada; provisório se a faixa acabou. */
  async proximoCodigo(tipo: FaixaCodigo['tipo'], ano = new Date().getFullYear()): Promise<string> {
    return this.db.transaction('rw', [this.db._faixas, this.db._meta], async () => {
      const faixas = await this.db._faixas.toArray();
      const r = proximoDaFaixa(faixas, tipo, ano);
      if (r) {
        const f = faixas.find((x) => x.tipo === r.faixa.tipo && x.ano === r.faixa.ano && x.inicio === r.faixa.inicio)!;
        await this.db._faixas.update(f.n!, { ultimo: r.faixa.ultimo });
        return r.codigo;
      }
      return this.codigoProvisorio(tipo);
    });
  }

  /** Código provisório (o servidor troca pelo definitivo ao sincronizar). */
  async codigoProvisorio(tipo: PrefixoCodigo): Promise<string> {
    return this.db.transaction('rw', this.db._meta, async () => {
      const contador = (await this.db.lerMeta<number>(`provisorio_${tipo}`, 0)) + 1;
      await this.db.gravarMeta(`provisorio_${tipo}`, contador);
      return codigoProvisorio(tipo, this.ctx().dispositivoId, contador);
    });
  }

  private async operacaoAberta(registroId: string): Promise<ItemFila | undefined> {
    const ops = await this.db._fila.where('registro_id').equals(registroId).sortBy('n');
    const ultima = ops[ops.length - 1];
    return ultima && !ultima.enviando ? ultima : undefined;
  }
}
