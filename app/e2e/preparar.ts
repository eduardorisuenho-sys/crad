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
  process.env.CRADS_PB_URL = s.url;
  process.env.CRADS_PB_ADMIN = s.admin;
  return () => s.parar();
}
