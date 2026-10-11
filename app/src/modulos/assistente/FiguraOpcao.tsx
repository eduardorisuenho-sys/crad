/** Figuras simples das respostas do assistente (funcionam sem internet). */
const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const folha = (x: number, y: number, rot = 0, tam = 1) => (
  <ellipse key={`${x}-${y}-${rot}`} cx={x} cy={y} rx={5 * tam} ry={10 * tam} transform={`rotate(${rot} ${x} ${y})`} fill="#7fb38f" stroke="#1f6f43" strokeWidth={2} />
);
const flor = (cor: string) => (
  <g>
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse key={r} cx={32} cy={20} rx={8} ry={12} transform={`rotate(${r} 32 32)`} fill={cor} stroke="#555" strokeWidth={1.5} />
    ))}
    <circle cx={32} cy={32} r={6} fill="#f2c94c" stroke="#555" strokeWidth={1.5} />
  </g>
);

const FIGURAS: Record<string, JSX.Element> = {
  folha_simples: <>{folha(32, 30, 0, 2)}<path d="M32 50v10" {...T} /></>,
  folha_composta: <><path d="M32 6v54" {...T} />{[14, 26, 38].flatMap((y) => [folha(22, y, -60), folha(42, y, 60)])}{folha(32, 8)}</>,
  folha_bipinada: <><path d="M32 6v54M32 18l-14-8M32 18l14-8M32 34l-14-8M32 34l14-8" {...T} />{[10, 14, 18, 26, 30, 34].flatMap((y, i) => [folha(18 + (i % 3) * 3, y - 2, -60, 0.4), folha(46 - (i % 3) * 3, y - 2, 60, 0.4)])}</>,
  folha_digitada: <><path d="M32 60V34" {...T} />{[-60, -30, 0, 30, 60].map((r) => folha(32 + Math.sin((r * Math.PI) / 180) * 16, 34 - Math.cos((r * Math.PI) / 180) * 16, r, 1.2))}</>,
  alterna: <><path d="M32 4v56" {...T} />{folha(20, 14, -50)}{folha(44, 28, 50)}{folha(20, 42, -50)}{folha(44, 56, 50)}</>,
  oposta: <><path d="M32 4v56" {...T} />{folha(20, 16, -50)}{folha(44, 16, 50)}{folha(20, 40, -50)}{folha(44, 40, 50)}</>,
  verticilada: <><path d="M32 4v56" {...T} />{[0, 60, 120, 180, 240, 300].map((r) => folha(32 + Math.cos((r * Math.PI) / 180) * 14, 30 + Math.sin((r * Math.PI) / 180) * 14, r + 90, 0.8))}</>,
  latex_branco: <><rect x={22} y={4} width={20} height={40} rx={4} fill="#a07850" /><path d="M32 30c-4 8-4 14 0 18 4-4 4-10 0-18z" fill="#fff" stroke="#888" strokeWidth={1.5} /><circle cx={32} cy={56} r={4} fill="#fff" stroke="#888" /></>,
  latex_colorido: <><rect x={22} y={4} width={20} height={40} rx={4} fill="#a07850" /><path d="M32 30c-4 8-4 14 0 18 4-4 4-10 0-18z" fill="#c0392b" stroke="#7b241c" strokeWidth={1.5} /><circle cx={32} cy={56} r={4} fill="#e67e22" /></>,
  sem_latex: <><rect x={22} y={4} width={20} height={40} rx={4} fill="#a07850" /><path d="M20 52l24 0" {...T} /></>,
  com_espinhos: <><rect x={24} y={2} width={16} height={60} rx={4} fill="#a07850" />{[10, 22, 34, 46].flatMap((y) => [<path key={`e${y}`} d={`M24 ${y}l-10 4 10 4`} fill="#5d4037" />, <path key={`d${y}`} d={`M40 ${y + 6}l10 4-10 4`} fill="#5d4037" />])}</>,
  sem_espinhos: <rect x={24} y={2} width={16} height={60} rx={4} fill="#a07850" />,
  casca_lisa: <rect x={14} y={4} width={36} height={56} rx={6} fill="#b8a48c" />,
  casca_rugosa: <><rect x={14} y={4} width={36} height={56} rx={6} fill="#8d6e53" /><path d="M22 6v20l4 10v22M32 6v14l-3 12v26M42 6v24l3 8v20" stroke="#4e342e" strokeWidth={2.5} fill="none" /></>,
  casca_placas: <><rect x={14} y={4} width={36} height={56} rx={6} fill="#c9b79c" /><path d="M18 10h12v12H18zM34 20h12v14H34zM20 36h12v14H20z" fill="#8d6e53" stroke="#4e342e" strokeWidth={1.5} /></>,
  casca_cortica: <><rect x={10} y={4} width={44} height={56} rx={10} fill="#9e8467" /><path d="M14 16c8 4 28 4 36 0M14 30c8 4 28 4 36 0M14 44c8 4 28 4 36 0" stroke="#5d4037" strokeWidth={3} fill="none" /></>,
  flor_branca: flor('#ffffff'),
  flor_amarela: flor('#f4d03f'),
  flor_rosa: flor('#d98cc9'),
  flor_vermelha: flor('#e74c3c'),
  flor_verde: flor('#d5e8b5'),
  fruto_vagem: <path d="M10 40c10-26 36-30 46-24-6 4-30 10-46 24z" fill="#8d6e53" stroke="#4e342e" strokeWidth={2} />,
  fruto_carnoso: <><circle cx={32} cy={36} r={18} fill="#e67e22" stroke="#a04000" strokeWidth={2} /><path d="M32 18c0-6 4-10 8-12" {...T} /></>,
  fruto_alado: <><ellipse cx={22} cy={40} rx={7} ry={9} fill="#8d6e53" /><path d="M26 34c8-16 22-26 30-26-2 12-14 26-30 30z" fill="#d7c4a3" stroke="#8d6e53" strokeWidth={2} /></>,
  fruto_capsula: <><path d="M32 10c-10 10-12 30 0 46 12-16 10-36 0-46z" fill="#a1887f" stroke="#4e342e" strokeWidth={2} /><path d="M32 12v42" stroke="#4e342e" strokeWidth={2} /></>,
  fruto_coco: <><ellipse cx={32} cy={36} rx={18} ry={22} fill="#8d6e53" stroke="#4e342e" strokeWidth={2} /><circle cx={26} cy={26} r={2.5} fill="#3e2723" /><circle cx={36} cy={24} r={2.5} fill="#3e2723" /></>,
  nao_sei: <><circle cx={32} cy={32} r={24} {...T} /><path d="M25 25a7 7 0 1 1 9 7c-2 1-2 3-2 6M32 46v1" {...T} /></>,
};

export function FiguraOpcao({ nome, tamanho = 72 }: { nome?: string; tamanho?: number }) {
  const f = nome ? FIGURAS[nome] : undefined;
  if (!f) return null;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true">
      {f}
    </svg>
  );
}
