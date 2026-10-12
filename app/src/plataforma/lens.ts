/**
 * Google Lens não tem ligação direta para apps: a foto vai pelo "Compartilhar"
 * do celular (a pessoa escolhe Google Lens / Pesquisar com o Google). No
 * computador, a foto é baixada e o Lens abre numa aba para receber a foto.
 */
export type ResultadoLens = 'compartilhado' | 'computador' | 'cancelado';

export async function pesquisarNoLens(foto: Blob, nome = 'arvore.jpg'): Promise<ResultadoLens> {
  const arquivo = new File([foto], nome, { type: foto.type || 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: 'Identificar árvore' });
      return 'compartilhado';
    } catch {
      return 'cancelado';
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  window.open('https://lens.google.com/', '_blank', 'noopener');
  return 'computador';
}
