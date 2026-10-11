/**
 * Banco local do aparelho (IndexedDB via Dexie).
 *
 * As tabelas das coleções saem do esquema único (dominio/src/esquema.ts).
 * As tabelas que começam com "_" existem só no aparelho.
 */
import Dexie, { type Table } from 'dexie';
import { COLECOES, type FaixaCodigo, type Operacao, type Registro } from '@crads/dominio';

/** Operação na fila de envio. */
export interface ItemFila extends Operacao {
  n?: number;
  /** já saiu para o servidor e aguarda resposta: não pode mais ser mesclada */
  enviando?: boolean;
}

/** Foto, assinatura ou PDF esperando sinal para subir. */
export interface ArquivoPendente {
  n?: number;
  colecao: string;
  registro_id: string;
  campo: string;
  nome: string;
  blob: Blob;
  criado_em: string;
}

/** Algo que precisa da atenção do usuário depois da sincronização. */
export interface Aviso {
  id: string;
  tipo: 'conflito' | 'rejeitada' | 'codigo';
  colecao: string;
  registro_id: string;
  mensagem: string;
  detalhes: unknown;
  criado_em: string;
  resolvido: boolean;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

export interface FaixaLocal extends FaixaCodigo {
  n?: number;
}

export class BancoCrads extends Dexie {
  _fila!: Table<ItemFila, number>;
  _arquivos!: Table<ArquivoPendente, number>;
  _avisos!: Table<Aviso, string>;
  _meta!: Table<Meta, string>;
  _faixas!: Table<FaixaLocal, number>;

  constructor(nome = 'crads') {
    super(nome);
    const lojas: Record<string, string> = {
      _fila: '++n, op_id, registro_id, colecao',
      _arquivos: '++n, registro_id',
      _avisos: 'id, resolvido, registro_id',
      _meta: 'chave',
      _faixas: '++n, [tipo+ano]',
    };
    for (const c of COLECOES) {
      const idx = new Set<string>(['seq']);
      if (c.porViveiro) idx.add('viveiro_id');
      for (const i of c.indices ?? []) idx.add(i);
      lojas[c.nome] = ['id', ...idx].join(', ');
    }
    // Ao mudar o esquema, aumente a versão (o Dexie migra os índices sozinho).
    this.version(3).stores(lojas);
  }

  colecao(nome: string): Table<Registro, string> {
    return this.table(nome);
  }

  async lerMeta<T>(chave: string, padrao: T): Promise<T> {
    const m = await this._meta.get(chave);
    return m ? (m.valor as T) : padrao;
  }

  async gravarMeta(chave: string, valor: unknown): Promise<void> {
    await this._meta.put({ chave, valor });
  }
}
