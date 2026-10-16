import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivpush00000001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-15T10:00:00.000Z',
  dispositivo_id: 'aparelho0000060',
  ...p,
});

describe.skipIf(!temPocketBase)('avisos no celular com o app fechado (Web Push)', () => {
  let s: ServidorTeste;
  let carteiro: Server;
  const recebidos: { inscricao: { endpoint: string }; titulo: string; texto: string; rota: string }[] = [];
  let admin: { id: string; token: string };
  let gestor: { id: string; token: string };
  let solicitante: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000060', operacoes: ops });
  const inscrever = (t: string, endpoint: string) => chamar(s, t, 'POST', '/api/crads/push/inscrever', { endpoint, keys: { p256dh: 'chave-p256dh', auth: 'chave-auth' } });

  beforeAll(async () => {
    // Carteiro falso: guarda o que receberia e diz que uma inscrição "morreu".
    carteiro = createServer((req, res) => {
      let corpo = '';
      req.on('data', (c) => (corpo += c));
      req.on('end', () => {
        const envios = JSON.parse(corpo).envios as typeof recebidos;
        recebidos.push(...envios);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ enviados: envios.length, mortas: envios.map((e) => e.inscricao.endpoint).filter((e) => e.endsWith('/morta')) }));
      });
    });
    await new Promise<void>((ok) => carteiro.listen(0, '127.0.0.1', ok));
    process.env.CRADS_PUSH_URL = `http://127.0.0.1:${(carteiro.address() as { port: number }).port}/enviar`;
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@push.local', { gestor_geral: true });
    gestor = await criarUsuario(s, 'gestor@push.local');
    solicitante = await criarUsuario(s, 'sol@push.local', { solicitante: true });
    await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'PUS', nome: 'Viveiro Push', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: gestor.id, perfil: 'gestor', viveiro_id: VIV } }),
    ]);
  });
  afterAll(() => {
    s?.parar();
    carteiro?.close();
    delete process.env.CRADS_PUSH_URL;
  });

  it('pedido novo avisa o gestor; aprovação avisa quem pediu; inscrição cancelada é apagada', async () => {
    expect((await inscrever(gestor.token, 'https://push.exemplo/gestor')).status).toBe(200);
    expect((await inscrever(solicitante.token, 'https://push.exemplo/solicitante')).status).toBe(200);
    expect((await inscrever(solicitante.token, 'https://push.exemplo/morta')).status).toBe(200);
    expect((await inscrever(gestor.token, 'http://inseguro')).status).toBe(400);

    const pessoa = gerarId();
    const doacao = gerarId();
    await enviar(solicitante.token, [
      op({ colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome: 'Quem Pede', usuario_id: solicitante.id } }),
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: 'DO-2026-960', solicitante_pessoa_id: pessoa, solicitante_usuario_id: solicitante.id, situacao: 'enviada', viveiro_id: VIV, termo_aceito_em: '2026-10-16', termo_texto: 'Termo de compromisso aceito' } }),
    ]);
    await expect.poll(() => recebidos.find((r) => r.inscricao.endpoint === 'https://push.exemplo/gestor')?.titulo).toBe('Novo pedido de mudas');
    expect(recebidos.some((r) => r.inscricao.endpoint.includes('solicitante') && r.titulo === 'Novo pedido de mudas')).toBe(false);

    const atual = (await chamar(s, s.admin, 'GET', `/api/collections/doacao/records/${doacao}`)).dados;
    await chamar(s, s.admin, 'PATCH', `/api/collections/doacao/records/${doacao}`, { situacao: 'aprovada', atualizado_por: gestor.id, versao: atual.versao });
    await expect.poll(() => recebidos.find((r) => r.inscricao.endpoint === 'https://push.exemplo/solicitante')?.titulo).toBe('Seu pedido de mudas foi aprovado!');
    expect(recebidos.find((r) => r.inscricao.endpoint === 'https://push.exemplo/solicitante')?.rota).toBe(`/doacao/${doacao}`);
    // a inscrição "morta" foi apagada
    await expect.poll(async () => (await chamar(s, s.admin, 'GET', `/api/collections/inscricao_push/records?perPage=50`)).dados.items.map((i: { endpoint: string }) => i.endpoint).sort()).toEqual(['https://push.exemplo/gestor', 'https://push.exemplo/solicitante']);
  });
});
