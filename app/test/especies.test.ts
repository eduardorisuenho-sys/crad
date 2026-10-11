import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { buscarNomes, lerLinhas, planejarImportacao, type ContextoUsuario } from '@crads/dominio';
import { BancoCrads } from '../src/dados/db';
import { Repositorio } from '../src/dados/repositorio';
import { Sincronizador } from '../src/dados/sincronizador';
import { aplicarPlanilha, carregarExistentes, indiceBusca } from '../src/modulos/especies/dados';
import { ServidorFalso } from './servidor-falso';

const gestor: ContextoUsuario = { id: 'usrgestor000001', gestorGeral: true, solicitante: false, perfisPorViveiro: {} };

it('importa a planilha sem internet, busca pelo nome popular e envia depois; reimportar não duplica', async () => {
  const servidor = new ServidorFalso();
  const db = new BancoCrads('especies-1');
  const repo = new Repositorio(db, () => ({ dispositivoId: 'aparelho0000001' }));
  const sync = new Sincronizador(db, servidor.transporte(gestor), () => 'aparelho0000001');
  const linhas = [
    ['Nome Popular', 'Família Botânica', 'Nome Científico'],
    ['Ipê-fictício', 'Ficticiaceae', 'Ficticia alba Fulano'],
    ['Pau-de-teste/Árvore-teste', 'Ficticiaceae', 'Ficticia rubra'],
  ];

  servidor.online = false;
  await aplicarPlanilha(repo, planejarImportacao(lerLinhas(linhas).registros, await carregarExistentes(db)));
  expect(await db.colecao('especie').count()).toBe(2);
  expect(buscarNomes('ipe ficticio', await indiceBusca(db))).toHaveLength(1);
  expect(buscarNomes('arvore teste', await indiceBusca(db))[0].nome).toBe('Árvore-teste');

  servidor.online = true;
  await sync.sincronizar();
  expect(servidor.tabela('especie').size).toBe(2);
  expect(servidor.tabela('nome_popular').size).toBe(3);

  const segunda = planejarImportacao(lerLinhas(linhas).registros, await carregarExistentes(db));
  expect(segunda.resumo).toMatchObject({ novas: 0, nomesPopulares: 0 });
});
