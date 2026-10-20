/**
 * Servidor só para o tutorial em vídeo: um viveiro, quatro pessoas de exemplo
 * e espécies reais (nome científico e família conferidos), sem nada de teste
 * aparecendo nas telas.
 */
import { chamar, criarUsuario, subirServidor, temPocketBase } from '../../servidor/test/servidor';

export const VIVEIRO = 'vivcradpalmas01';

export default async function preparar() {
  if (!temPocketBase) throw new Error('Rode "npm run baixar-pocketbase -w servidor" antes.');
  const s = await subirServidor();
  const criar = async (colecao: string, dados: Record<string, unknown>) => {
    const r = await chamar(s, s.admin, 'POST', `/api/collections/${colecao}/records`, dados);
    if (r.status !== 200) throw new Error(`${colecao}: ${JSON.stringify(r.dados)}`);
    return r.dados;
  };
  await criar('viveiro', { id: VIVEIRO, sigla: 'CRP', nome: 'CRAD Palmas', ativo: true, telefone: '(63) 3218-0000', endereco: 'Palmas - TO' });
  await criarUsuario(s, 'carla@crad.local', { name: 'Carla Souza', gestor_geral: true });
  const ana = await criarUsuario(s, 'ana@crad.local', { name: 'Ana Clara' });
  const bruno = await criarUsuario(s, 'bruno@crad.local', { name: 'Bruno Lima' });
  await criarUsuario(s, 'jose@crad.local', { name: 'José Pereira', solicitante: true });
  await criar('usuario_viveiro', { usuario_id: ana.id, perfil: 'coletor', viveiro_id: VIVEIRO });
  await criar('usuario_viveiro', { usuario_id: bruno.id, perfil: 'viveirista', viveiro_id: VIVEIRO });
  const especies: [string, string, string, string][] = [
    ['Handroanthus serratifolius', 'Bignoniaceae', 'Ipê-amarelo', 'ipe amarelo'],
    ['Hymenaea courbaril', 'Fabaceae', 'Jatobá', 'jatoba'],
    ['Dipteryx alata', 'Fabaceae', 'Baru', 'baru'],
  ];
  for (const [cientifico, familia, popular, busca] of especies) {
    const e = await criar('especie', { nome_cientifico: cientifico, familia });
    await criar('nome_popular', { especie_id: e.id, nome: popular, nome_busca: busca });
  }
  process.env.CRADS_PB_URL = s.url;
  process.env.CRADS_PB_ADMIN = s.admin;
  return () => s.parar();
}
