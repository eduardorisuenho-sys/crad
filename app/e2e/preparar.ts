/** Sobe um PocketBase de teste com gestora, coletor, viveiro e uma espécie fictícia. */
import { chamar, criarUsuario, subirServidor, temPocketBase } from '../../servidor/test/servidor';

export const VIVEIRO_TESTE = 'vivteste0000001';

export default async function preparar() {
  if (!temPocketBase) throw new Error('Rode "npm run baixar-pocketbase -w servidor" antes dos testes de ponta a ponta.');
  const s = await subirServidor();
  await criarUsuario(s, 'gestora@teste.local', { name: 'Gestora Teste', gestor_geral: true });
  const coletor = await criarUsuario(s, 'coletor@teste.local', { name: 'Coletor Teste' });
  // Cadastros feitos "pelo painel" (superusuário): os hooks dão versão e seq.
  const criar = async (colecao: string, dados: Record<string, unknown>) => {
    const r = await chamar(s, s.admin, 'POST', `/api/collections/${colecao}/records`, dados);
    if (r.status !== 200) throw new Error(`${colecao}: ${JSON.stringify(r.dados)}`);
    return r.dados;
  };
  await criar('viveiro', { id: VIVEIRO_TESTE, sigla: 'TST', nome: 'Viveiro Teste', ativo: true });
  await criar('usuario_viveiro', { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIVEIRO_TESTE });
  const especie = await criar('especie', { nome_cientifico: 'Ficticia campestris', familia: 'Ficticiaceae', ficticia: true });
  await criar('nome_popular', { especie_id: especie.id, nome: 'Árvore-de-campo-fictícia', nome_busca: 'arvore de campo ficticia' });
  // Módulo 2: viveirista e uma matriz já aprovada, com fruto maduro.
  const viveirista = await criarUsuario(s, 'viveirista@teste.local', { name: 'Viveirista Teste' });
  await criar('usuario_viveiro', { usuario_id: viveirista.id, perfil: 'viveirista', viveiro_id: VIVEIRO_TESTE });
  const matriz = await criar('matriz', {
    codigo: 'MT-9001', especie_id: especie.id, grau_certeza: 'certo', situacao: 'ativa', situacao_validacao: 'aprovada',
    lat: -10.19, lon: -48.34, viveiro_id: VIVEIRO_TESTE,
  });
  await criar('fenologia', { matriz_id: matriz.id, data: new Date().toISOString().slice(0, 10), fases: ['fruto_maduro'], viveiro_id: VIVEIRO_TESTE });
  // Módulo 4: espécie publicada (nome de teste) com um lote de mudas pronto.
  const publica = await criar('especie', { nome_cientifico: 'Catalogia demonstrativa', familia: 'Testaceae', publicada: true, folha: 'composta' });
  await criar('nome_popular', { especie_id: publica.id, nome: 'Árvore-do-catálogo', nome_busca: 'arvore do catalogo' });
  const mPub = await criar('matriz', { codigo: 'MT-9002', especie_id: publica.id, grau_certeza: 'certo', situacao_validacao: 'aprovada', lat: -10.3, lon: -48.3, viveiro_id: VIVEIRO_TESTE });
  const cPub = await criar('coleta', { matriz_id: mPub.id, data: '2026-01-05', viveiro_id: VIVEIRO_TESTE });
  const lsPub = await criar('lote_sementes', { codigo: 'LS-2026-901', especie_id: publica.id, data_formacao: '2026-01-10', viveiro_id: VIVEIRO_TESTE });
  await criar('lote_sementes_coleta', { lote_sementes_id: lsPub.id, coleta_id: cPub.id, viveiro_id: VIVEIRO_TESTE });
  const lmPub = await criar('lote_mudas', { codigo: 'LM-2026-901-A', lote_sementes_id: lsPub.id, especie_id: publica.id, data_semeadura: '2026-02-01', fase_atual: 'pronta', viveiro_id: VIVEIRO_TESTE });
  await criar('movimento_estoque_mudas', { lote_mudas_id: lmPub.id, tipo: 'entrada', quantidade: 60, data: '2026-03-01', viveiro_id: VIVEIRO_TESTE });
  process.env.CRADS_ESPECIE_PUBLICA = publica.id;
  process.env.CRADS_PB_URL = s.url;
  process.env.CRADS_PB_ADMIN = s.admin;
  return () => s.parar();
}
