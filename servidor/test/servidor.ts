/** Sobe um PocketBase temporário para os testes de integração. */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BINARIO = process.env.PB_BIN ?? join(raiz, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
export const temPocketBase = existsSync(BINARIO);

async function portaLivre(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => ok(p));
    });
  });
}

export interface ServidorTeste {
  url: string;
  admin: string;
  parar(): void;
}

export async function subirServidor(): Promise<ServidorTeste> {
  const dir = mkdtempSync(join(tmpdir(), 'crads-pb-'));
  const flags = [`--dir=${dir}`, `--hooksDir=${join(raiz, 'pb_hooks')}`, `--migrationsDir=${join(raiz, 'pb_migrations')}`];
  execFileSync(BINARIO, ['superuser', 'upsert', 'admin@teste.local', 'senha-admin-123', ...flags]);
  const porta = await portaLivre();
  const url = `http://127.0.0.1:${porta}`;
  const proc: ChildProcess = spawn(BINARIO, ['serve', `--http=127.0.0.1:${porta}`, ...flags], { stdio: 'ignore' });
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(`${url}/api/crads/saude`)).ok) break;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const r = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@teste.local', password: 'senha-admin-123' }),
  });
  const admin = (await r.json()).token as string;
  return {
    url,
    admin,
    parar() {
      proc.kill();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function chamar<T = any>(s: ServidorTeste, token: string, metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; dados: T }> {
  const r = await fetch(`${s.url}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, dados: texto ? JSON.parse(texto) : null };
}

/** Cria um usuário (como superusuário) e devolve id e token. */
export async function criarUsuario(s: ServidorTeste, email: string, extra: Record<string, unknown> = {}) {
  const senha = 'senha-teste-123';
  const c = await chamar(s, s.admin, 'POST', '/api/collections/users/records', { email, password: senha, passwordConfirm: senha, name: email.split('@')[0], ...extra });
  if (c.status !== 200) throw new Error(JSON.stringify(c.dados));
  const a = await chamar(s, '', 'POST', '/api/collections/users/auth-with-password', { identity: email, password: senha });
  return { id: c.dados.id as string, token: a.dados.token as string };
}
