/**
 * Carteiro de avisos do CRADS (Web Push): entrega no celular os avisos de
 * pedido de mudas, aprovação etc., mesmo com o app fechado. O som é o da
 * notificação do próprio celular.
 *
 * - Na primeira vez cria as chaves VAPID (vapid.json, fica só no servidor) e
 *   publica a chave pública em pb_public/push/chave.json para o app.
 * - Escuta só na própria máquina (127.0.0.1:8091). O PocketBase decide quem
 *   recebe o quê e manda aqui: POST /enviar { envios: [{ inscricao, titulo, texto, rota }] }.
 * - Responde { enviados, mortas: [endpoints] } — inscrições que o celular
 *   cancelou, para o PocketBase apagar.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.CRADS_PUSH_PORTA ?? 8091);
const ARQ_CHAVES = process.env.CRADS_PUSH_CHAVES ?? join(AQUI, 'vapid.json');
const PUBLICO = process.env.CRADS_PUSH_PUBLICO ?? join(AQUI, '..', 'pb_public', 'push', 'chave.json');
const CONTATO = process.env.CRADS_PUSH_CONTATO ?? 'mailto:crad@semarh.to.gov.br';

export function carregarChaves(arquivo = ARQ_CHAVES, publico = PUBLICO) {
  let chaves;
  if (existsSync(arquivo)) chaves = JSON.parse(readFileSync(arquivo, 'utf8'));
  else {
    chaves = webpush.generateVAPIDKeys();
    writeFileSync(arquivo, JSON.stringify(chaves), { mode: 0o600 });
  }
  mkdirSync(dirname(publico), { recursive: true });
  writeFileSync(publico, JSON.stringify({ publicKey: chaves.publicKey }));
  return chaves;
}

export async function enviar(envios, chaves, contato = CONTATO) {
  const mortas = [];
  let enviados = 0;
  for (const e of envios ?? []) {
    try {
      await webpush.sendNotification(e.inscricao, JSON.stringify({ titulo: e.titulo, texto: e.texto, rota: e.rota }), {
        TTL: 24 * 3600,
        urgency: 'high',
        vapidDetails: { subject: contato, publicKey: chaves.publicKey, privateKey: chaves.privateKey },
      });
      enviados++;
    } catch (err) {
      // 404/410: o celular cancelou a inscrição (app desinstalado, permissão tirada).
      if (err?.statusCode === 404 || err?.statusCode === 410) mortas.push(e.inscricao?.endpoint);
      else console.error('falha ao enviar aviso:', err?.statusCode ?? '', err?.body ?? err?.message ?? err);
    }
  }
  return { enviados, mortas };
}

export function iniciar(porta = PORTA) {
  const chaves = carregarChaves();
  const servidor = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/enviar') {
      res.writeHead(404).end();
      return;
    }
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', async () => {
      try {
        const r = await enviar(JSON.parse(corpo || '{}').envios, chaves);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(r));
      } catch (err) {
        res.writeHead(400).end(String(err));
      }
    });
  });
  servidor.listen(porta, '127.0.0.1', () => console.log(`Carteiro de avisos do CRADS em 127.0.0.1:${porta}`));
  return servidor;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) iniciar();
