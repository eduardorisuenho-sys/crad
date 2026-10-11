/** Sobe um PocketBase de teste, com um gestor, para o teste de ponta a ponta. */
import { criarUsuario, subirServidor, temPocketBase } from '../../servidor/test/servidor';

export default async function preparar() {
  if (!temPocketBase) throw new Error('Rode "npm run baixar-pocketbase -w servidor" antes dos testes de ponta a ponta.');
  const s = await subirServidor();
  await criarUsuario(s, 'gestora@teste.local', { name: 'Gestora Teste', gestor_geral: true });
  process.env.CRADS_PB_URL = s.url;
  process.env.CRADS_PB_ADMIN = s.admin;
  return () => s.parar();
}
