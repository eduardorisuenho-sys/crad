/** Ícones grandes e simples (traço), desenhados para leitura rápida em campo. */
const CAMINHOS: Record<string, string> = {
  arvore: 'M12 2a6 6 0 0 0-6 6 5 5 0 0 0 2 9h3v5h2v-5h3a5 5 0 0 0 2-9 6 6 0 0 0-6-6z',
  semente: 'M12 3c4 3 6 7 6 10a6 6 0 0 1-12 0c0-3 2-7 6-10zM12 9v8',
  muda: 'M12 22V11M12 11c0-4 3-7 8-7 0 5-3 7-8 7zM12 14c0-3-2-5-7-5 0 4 2 5 7 5zM6 22h12',
  catalogo: 'M4 4h7v16H4zM13 4h7v16h-7zM6 8h3M15 8h3M6 12h3M15 12h3',
  doacao: 'M3 11h18v4H3zM5 15h14v6H5zM12 11v10M12 11c-2-5-7-5-6-2 1 2 6 2 6 2zm0 0c2-5 7-5 6-2-1 2-6 2-6 2z',
  plantio: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 7v6M9 10h6',
  relatorio: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sincronizar: 'M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5M18 3v4h-4M6 21v-4h4',
  configuracoes: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  aviso: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.5',
  casa: 'M3 11l9-8 9 8M5 10v11h14V10',
  voltar: 'M15 5l-7 7 7 7',
  mais: 'M12 5v14M5 12h14',
  viveiro: 'M3 21V10l9-6 9 6v11M3 21h18M8 21v-6h8v6',
  pessoas: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-5',
  cadeado: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  baixar: 'M12 3v12M7 10l5 5 5-5M5 19h14',
  lixo: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  certo: 'M5 13l4 4 10-10',
  folha: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7',
  camera: 'M4 8h4l2-3h4l2 3h4v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  compartilhar: 'M12 3v12M7 8l5-5 5 5M5 13v8h14v-8',
  lupa: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM14.5 14.5L21 21',
  sinal: 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20v.5',
  semSinal: 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20v.5M3 3l18 18',
};

export function Icone({ nome, tamanho = 32 }: { nome: keyof typeof CAMINHOS | string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome] ?? CAMINHOS.aviso} />
    </svg>
  );
}
