// Baixa o PocketBase para esta máquina (Linux/macOS/Windows, x64/arm64).
import { execFileSync } from 'node:child_process';
import { createWriteStream, chmodSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const VERSAO = '0.30.0';
const aqui = join(dirname(fileURLToPath(import.meta.url)), '..');
const so = { linux: 'linux', darwin: 'darwin', win32: 'windows' }[process.platform];
const arq = { x64: 'amd64', arm64: 'arm64' }[process.arch];
if (!so || !arq) throw new Error(`Plataforma não suportada: ${process.platform}/${process.arch}`);
const url = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSAO}/pocketbase_${VERSAO}_${so}_${arq}.zip`;
const zip = join(aqui, 'pocketbase.zip');
console.log(`Baixando ${url}`);
const r = await fetch(url);
if (!r.ok) throw new Error(`Falha ao baixar: ${r.status}`);
await pipeline(Readable.fromWeb(r.body), createWriteStream(zip));
execFileSync('unzip', ['-o', zip], { cwd: aqui, stdio: 'inherit' });
const bin = join(aqui, so === 'windows' ? 'pocketbase.exe' : 'pocketbase');
if (existsSync(bin)) chmodSync(bin, 0o755);
console.log(`Pronto: ${bin}`);
