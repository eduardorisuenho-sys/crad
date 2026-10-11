import type { ContextoUsuario } from '../src/acesso';
import type { Operacao } from '../src/sync/tipos';

export const VIV_PALMAS = 'vivpalmas000001';
export const VIV_GURUPI = 'vivgurupi000001';

export const coletorPalmas: ContextoUsuario = { id: 'usrcoletor00001', gestorGeral: false, solicitante: false, perfisPorViveiro: { [VIV_PALMAS]: ['coletor'] } };
export const viveiristaPalmas: ContextoUsuario = { id: 'usrviveirista01', gestorGeral: false, solicitante: false, perfisPorViveiro: { [VIV_PALMAS]: ['viveirista'] } };
export const gestorGeral: ContextoUsuario = { id: 'usrgestor000001', gestorGeral: true, solicitante: false, perfisPorViveiro: {} };
export const solicitante: ContextoUsuario = { id: 'usrsolicitante1', gestorGeral: false, solicitante: true, perfisPorViveiro: {} };

let n = 0;
export function op(p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'registro_id' | 'tipo'>): Operacao {
  n++;
  return {
    op_id: `op${String(n).padStart(13, '0')}`,
    dados: {},
    base: {},
    base_versao: 0,
    criado_no_aparelho_em: '2026-10-11T10:00:00.000Z',
    dispositivo_id: 'dispositivo0001',
    ...p,
  };
}
