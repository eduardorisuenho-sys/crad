/** Transporte real: rotas /api/crads/* do PocketBase. */
import type { Operacao, Registro, RespostaEnvio, RespostaRecebimento } from '@crads/dominio';
import { SemConexao, SessaoExpirada, type Transporte } from './sincronizador';

export class TransporteHttp implements Transporte {
  constructor(
    private servidor: () => string,
    private token: () => string | null,
  ) {}

  private async pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.servidor().replace(/\/$/, '')}${caminho}`, {
        ...init,
        headers: { ...(init.headers ?? {}), authorization: this.token() ?? '' },
      });
    } catch {
      throw new SemConexao('Sem conexão com o servidor');
    }
    if (r.status === 401 || r.status === 403) throw new SessaoExpirada('Entre de novo para sincronizar');
    if (r.status >= 500 || r.status === 0) throw new SemConexao(`Servidor indisponível (${r.status})`);
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo?.message ?? `Erro ${r.status}`);
    return corpo as T;
  }

  enviar(dispositivoId: string, operacoes: Operacao[]): Promise<RespostaEnvio> {
    return this.pedir('/api/crads/sync/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dispositivo_id: dispositivoId, operacoes }),
    });
  }

  receber(desde: number, dispositivoId: string): Promise<RespostaRecebimento> {
    return this.pedir(`/api/crads/sync/receber?desde=${desde}&dispositivo=${dispositivoId}`);
  }

  enviarArquivo(colecao: string, id: string, campo: string, blob: Blob, nome: string, dispositivoId: string): Promise<{ registro: Registro }> {
    const form = new FormData();
    form.append(campo, blob, nome);
    return this.pedir(`/api/crads/arquivo/${colecao}/${id}/${campo}?dispositivo=${dispositivoId}`, { method: 'POST', body: form });
  }
}
