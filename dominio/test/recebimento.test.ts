import { expect, it } from 'vitest';
import { colecao } from '../src/esquema';
import { montarRecebimento } from '../src/sync/recebimento';
import { coletorPalmas, VIV_PALMAS } from './apoio';

it('entrega em ordem de seq, pagina e esconde dados que o usuário não pode ler', () => {
  const r = montarRecebimento(
    [
      { colecao: colecao('matriz'), registros: [{ id: 'a', versao: 1, seq: 3, viveiro_id: VIV_PALMAS }, { id: 'b', versao: 1, seq: 5, viveiro_id: VIV_PALMAS }] },
      { colecao: colecao('dados_pessoais'), registros: [{ id: 'c', versao: 1, seq: 4, documento: '123', pessoa_id: 'p' }] },
    ],
    coletorPalmas,
    2,
    2,
  );
  expect(r.registros.map((x) => x.registro.id)).toEqual(['a', 'c']);
  expect(r.registros[1].registro).toEqual({ id: 'c', versao: 1, seq: 4, excluido: true });
  expect(r.cursor).toBe(4);
  expect(r.mais).toBe(true);
});
