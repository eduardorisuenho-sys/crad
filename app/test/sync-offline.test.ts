import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ContextoUsuario } from '@crads/dominio';
import { BancoCrads } from '../src/dados/db';
import { Repositorio } from '../src/dados/repositorio';
import { SemConexao, Sincronizador } from '../src/dados/sincronizador';
import { ServidorFalso } from './servidor-falso';

const VIV = 'vivpalmas000001';
const coletor: ContextoUsuario = { id: 'usrcoletor00001', gestorGeral: false, solicitante: false, perfisPorViveiro: { [VIV]: ['coletor'] } };
const gestor: ContextoUsuario = { id: 'usrgestor000001', gestorGeral: true, solicitante: false, perfisPorViveiro: {} };

let contador = 0;
function aparelho(servidor: ServidorFalso, ctx: ContextoUsuario) {
  const db = new BancoCrads(`teste-${++contador}`);
  const disp = `aparelho${String(contador).padStart(7, '0')}`;
  const repo = new Repositorio(db, () => ({ dispositivoId: disp, viveiroId: VIV }));
  const sync = new Sincronizador(db, servidor.transporte(ctx), () => disp);
  return { db, repo, sync };
}

const matriz = { codigo: 'MT-0500', grau_certeza: 'provavel', lat: -10.18, lon: -48.33 };

describe('fluxo sem internet', () => {
  let servidor: ServidorFalso;
  beforeEach(() => {
    servidor = new ServidorFalso();
  });

  it('cadastra offline, guarda na fila e envia quando o sinal volta', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    servidor.online = false;

    const m = await repo.salvar('matriz', matriz);
    await repo.salvar('matriz', { altura_m: 14 }, m.id);
    await repo.anexarArquivo('matriz', m.id, 'x' as never, new Blob(['x']), 'x.jpg').catch(() => undefined);

    expect(await db._fila.count()).toBe(1); // criação + alteração viram uma operação só
    expect((await db.colecao('matriz').get(m.id))?.altura_m).toBe(14);
    await expect(sync.sincronizar()).rejects.toBeInstanceOf(SemConexao);
    expect(await db._fila.count()).toBe(1);
    expect((await db._fila.toArray())[0].enviando).toBe(false);

    servidor.online = true;
    const r = await sync.sincronizar();
    expect(r.enviadas).toBe(1);
    expect(await db._fila.count()).toBe(0);
    expect(servidor.tabela('matriz').get(m.id)).toMatchObject({ altura_m: 14, versao: 1, viveiro_id: VIV });
    expect((await db.colecao('matriz').get(m.id))?.versao).toBe(1);
  });

  it('se a resposta se perder, o reenvio não duplica', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    await repo.salvar('matriz', matriz);
    const op = (await db._fila.toArray())[0];
    // O servidor aplicou, mas a resposta nunca chegou ao aparelho.
    servidor.aplicar(op, coletor);
    await sync.sincronizar();
    expect(servidor.tabela('matriz').size).toBe(1);
    expect(await db._fila.count()).toBe(0);
  });

  it('dois aparelhos offline mexendo no mesmo cadastro: funde campos diferentes e avisa no mesmo campo', async () => {
    const a = aparelho(servidor, coletor);
    const b = aparelho(servidor, gestor);
    const m = await a.repo.salvar('matriz', { ...matriz, observacao: 'original', altura_m: 10 });
    await a.sync.sincronizar();
    await b.sync.sincronizar();

    servidor.online = false;
    await a.repo.salvar('matriz', { observacao: 'do coletor', altura_m: 12 }, m.id);
    await b.repo.salvar('matriz', { observacao: 'do gestor', dap_cm: 40 }, m.id);
    servidor.online = true;

    await b.sync.sincronizar();
    const ra = await a.sync.sincronizar();
    expect(ra.avisos).toBe(1);
    const final = servidor.tabela('matriz').get(m.id)!;
    expect(final).toMatchObject({ observacao: 'do gestor', altura_m: 12, dap_cm: 40 });
    const local = await a.db.colecao('matriz').get(m.id);
    expect(local).toMatchObject({ observacao: 'do gestor', altura_m: 12, dap_cm: 40 });
    const [aviso] = await a.db._avisos.toArray();
    expect(aviso).toMatchObject({ tipo: 'conflito', registro_id: m.id });
  });

  it('o que chega do servidor não apaga edição local ainda não enviada', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    const m = await repo.salvar('matriz', { ...matriz, observacao: 'a' });
    await sync.sincronizar();
    servidor.alterarDireto('matriz', m.id, { dap_cm: 50 });
    servidor.online = false;
    await repo.salvar('matriz', { observacao: 'editada offline' }, m.id);
    servidor.online = true;
    await sync.sincronizar();
    expect(await db.colecao('matriz').get(m.id)).toMatchObject({ observacao: 'editada offline', dap_cm: 50 });
    expect(servidor.tabela('matriz').get(m.id)).toMatchObject({ observacao: 'editada offline', dap_cm: 50 });
  });

  it('código provisório: aparelho sem faixa recebe o código definitivo e um aviso', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    const codigo = await repo.proximoCodigo('MT');
    expect(codigo).toMatch(/^MT-P-/);
    const m = await repo.salvar('matriz', { ...matriz, codigo });
    await sync.sincronizar();
    expect((await db.colecao('matriz').get(m.id))?.codigo).toBe('MT-0900');
    expect((await db._avisos.toArray()).some((a) => a.tipo === 'codigo')).toBe(true);
  });

  it('usa a faixa reservada enquanto houver código', async () => {
    const { db, repo } = aparelho(servidor, coletor);
    await db._faixas.add({ tipo: 'MT', ano: 0, inicio: 40, fim: 41, ultimo: 39 });
    expect(await repo.proximoCodigo('MT')).toBe('MT-0040');
    expect(await repo.proximoCodigo('MT')).toBe('MT-0041');
    expect(await repo.proximoCodigo('MT')).toMatch(/^MT-P-/);
  });

  it('operação recusada vira aviso e não trava a fila', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    const ruim = await repo.salvar('lote_mudas', { codigo: 'LM-2026-001-A', lote_sementes_id: 'x', especie_id: 'y' }); // coletor não pode
    const boa = await repo.salvar('matriz', matriz);
    await sync.sincronizar();
    expect(await db._fila.count()).toBe(0);
    expect(servidor.tabela('matriz').has(boa.id)).toBe(true);
    expect((await db._avisos.get((await db._avisos.toArray())[0].id))?.tipo).toBe('rejeitada');
    expect((await db.colecao('lote_mudas').get(ruim.id))?._rejeitado).toBe(true);
  });

  it('excluir algo que nunca foi enviado só tira da fila', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    const m = await repo.salvar('matriz', matriz);
    await repo.excluir('matriz', m.id);
    expect(await db._fila.count()).toBe(0);
    await sync.sincronizar();
    expect(servidor.tabela('matriz').size).toBe(0);
  });

  it('exclusão de registro sincronizado é lógica e chega aos outros aparelhos', async () => {
    const a = aparelho(servidor, coletor);
    const b = aparelho(servidor, gestor);
    const m = await a.repo.salvar('matriz', matriz);
    await a.sync.sincronizar();
    await b.sync.sincronizar();
    expect(await b.db.colecao('matriz').get(m.id)).toBeTruthy();
    await a.repo.excluir('matriz', m.id);
    await a.sync.sincronizar();
    expect(servidor.tabela('matriz').get(m.id)?.excluido).toBe(true);
    await b.sync.sincronizar();
    expect(await b.db.colecao('matriz').get(m.id)).toBeUndefined();
  });

  it('foto espera o registro chegar ao servidor e depois sobe', async () => {
    const { db, repo, sync } = aparelho(servidor, coletor);
    servidor.online = false;
    const f = await repo.salvar('foto', { entidade: 'matriz', registro_id: 'x', parte: 'folha' });
    await repo.anexarArquivo('foto', f.id, 'arquivo', new Blob(['jpeg']), 'folha.jpg');
    servidor.online = true;
    const r = await sync.sincronizar();
    expect(r.arquivos).toBe(1);
    expect(await db._arquivos.count()).toBe(0);
    expect(servidor.tabela('foto').get(f.id)?.arquivo).toBe('folha.jpg');
  });

  it('recebe em páginas até o fim', async () => {
    const a = aparelho(servidor, coletor);
    for (let i = 0; i < 8; i++) await a.repo.salvar('matriz', { ...matriz, codigo: `MT-${String(600 + i).padStart(4, '0')}` });
    await a.sync.sincronizar();
    const b = aparelho(servidor, gestor);
    const r = await b.sync.sincronizar();
    expect(r.recebidos).toBe(8);
    expect(await b.db.colecao('matriz').count()).toBe(8);
  });
});
