/** Empacota a lógica do servidor (com o domínio) num único arquivo para os hooks do PocketBase. */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(aqui, '..', 'src', 'crads.ts')],
  outfile: join(aqui, '..', 'pb_hooks', 'lib', 'crads.js'),
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  // o motor JS do PocketBase (goja) entende ES2015+ sem async
  target: 'es2017',
  banner: { js: '// Gerado por servidor/scripts/empacotar.ts. Não edite à mão.' },
});
console.log('pb_hooks/lib/crads.js gerado.');
