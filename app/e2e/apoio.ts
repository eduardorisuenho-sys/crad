import { expect, type Page } from '@playwright/test';
import { PROGRAMA_SEM_COMPROVACAO, retiradasSemComprovacao } from '../../dominio/src/index';

type Reg = Record<string, unknown> & { id: string };

export const PB = () => process.env.CRADS_PB_URL!;

/** Entra (com internet) e espera o app ficar guardado no aparelho. */
export async function entrar(page: Page, email: string, saudacao: string) {
  await page.goto('/');
  // sem campo de endereço na tela: o servidor de teste fica guardado no aparelho
  await page.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await expect(page.getByLabel('Endereço do servidor')).toHaveCount(0);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: saudacao })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
}

export const entrarComoGestora = (page: Page) => entrar(page, 'gestora@teste.local', 'Olá, Gestora');
export const entrarComoColetor = (page: Page) => entrar(page, 'coletor@teste.local', 'Olá, Coletor');
export const entrarComoSolicitante = (page: Page) => entrar(page, 'solicitante@teste.local', 'Olá, Solicitante');
export const entrarComoViveirista = (page: Page) => entrar(page, 'viveirista@teste.local', 'Olá, Viveirista');

export async function lerDoServidor(colecao: string) {
  const r = await fetch(`${PB()}/api/collections/${colecao}/records?perPage=500`, { headers: { authorization: process.env.CRADS_PB_ADMIN! } });
  return (await r.json()).items as Record<string, unknown>[];
}

/** Abre um módulo pelo ícone da tela inicial. */
export async function abrirModulo(page: Page, nome: string) {
  // o nome pode vir com as pendências: "Pós-plantio, 1 pendência"
  const exato = new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`);
  await page.locator('.grade-blocos').getByRole('link', { name: exato }).click();
}

/** Quantas mudas o catálogo público mostra para uma espécie. */
export async function noCatalogo(nomePopular: string): Promise<number> {
  const r = await fetch(`${PB()}/api/crads/publico/catalogo`);
  const { itens } = await r.json();
  return itens.find((i: { nomes_populares: string[] }) => i.nomes_populares.includes(nomePopular))?.total ?? 0;
}

/**
 * Para os testes em que o solicitante só precisa fazer um pedido: as retiradas
 * dele ainda sem plantio comprovado passam, por um tempo, para o Plantando Água
 * (que não precisa comprovar). Devolve a função que desfaz a marcação.
 */
export async function dispensarComprovacaoDoSolicitante(): Promise<() => Promise<void>> {
  const [usuario] = (await lerDoServidor('users')).filter((u) => u.email === 'solicitante@teste.local');
  const [doacoes, plantios, fotos, historico] = await Promise.all(['doacao', 'plantio', 'foto', 'doacao_programa_historico'].map(lerDoServidor));
  const pendentes = retiradasSemComprovacao(doacoes.filter((d) => d.solicitante_usuario_id === usuario.id) as Reg[], plantios as Reg[], fotos as Reg[], historico as Reg[]);
  const marcar = (acao: 'marcou' | 'desmarcou') =>
    Promise.all(
      pendentes.map((d) =>
        fetch(`${PB()}/api/collections/doacao_programa_historico/records`, {
          method: 'POST',
          headers: { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' },
          body: JSON.stringify({ doacao_id: d.id, programa_id: PROGRAMA_SEM_COMPROVACAO, acao, motivo: 'teste', viveiro_id: d.viveiro_id, criado_no_aparelho_em: new Date().toISOString() }),
        }),
      ),
    );
  await marcar('marcou');
  return async () => void (await marcar('desmarcou'));
}
