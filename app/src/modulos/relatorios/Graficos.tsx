/** Barras e mapa simples (SVG), com as cores da logo e números escritos ao lado. */
import { useMemo } from 'react';
import { mostrarNumero } from '../../plataforma/numero';

/** Barras horizontais de uma série só: o título diz o que é; cada barra tem o número escrito. */
export function Barras({ titulo, itens, unidade = '' }: { titulo: string; itens: { rotulo: string; valor: number }[]; unidade?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <figure className="barras" aria-label={titulo}>
      <figcaption>{titulo}</figcaption>
      {itens.length === 0 && <p className="dica">Sem dados no período.</p>}
      <ul>
        {itens.map((i) => (
          <li key={i.rotulo} title={`${i.rotulo}: ${mostrarNumero(i.valor)}${unidade}`}>
            <span className="barras-rotulo">{i.rotulo}</span>
            <span className="barras-trilho">
              <span className="barras-barra" style={{ width: `${(i.valor / max) * 100}%` }} />
            </span>
            <strong>
              {mostrarNumero(i.valor)}
              {unidade}
            </strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface PontoMapa {
  lat: number;
  lon: number;
  rotulo: string;
  /** tamanho relativo (ex.: mudas) */
  peso?: number;
  cor?: 'verde' | 'azul' | 'escuro';
}

const L = 360;
const A = 300;
const M = 18;

/** Mapa de pontos sem fundo (funciona sem internet). */
export function MapaPontos({ pontos, rotulo }: { pontos: PontoMapa[]; rotulo: string }) {
  const proj = useMemo(() => {
    if (!pontos.length) return null;
    const minLat = Math.min(...pontos.map((p) => p.lat));
    const maxLat = Math.max(...pontos.map((p) => p.lat));
    const minLon = Math.min(...pontos.map((p) => p.lon));
    const maxLon = Math.max(...pontos.map((p) => p.lon));
    const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const larg = Math.max((maxLon - minLon) * cos, 0.05);
    const alt = Math.max(maxLat - minLat, 0.05);
    const esc = Math.min((L - 2 * M) / larg, (A - 2 * M) / alt);
    return {
      x: (lon: number) => M + (lon - minLon) * cos * esc + (L - 2 * M - larg * esc) / 2,
      y: (lat: number) => A - M - (lat - minLat) * esc - (A - 2 * M - alt * esc) / 2,
      km80: Math.round(((80 / esc) * 111.32) * 10) / 10,
    };
  }, [pontos]);
  if (!proj) return <p className="dica">Nenhum ponto para mostrar.</p>;
  const maxPeso = Math.max(1, ...pontos.map((p) => p.peso ?? 1));
  const cor = { verde: 'var(--verde)', azul: 'var(--azul)', escuro: 'var(--azul-escuro)' };
  return (
    <svg className="mapa-rota mapa-pontos" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={rotulo}>
      <rect x="0" y="0" width={L} height={A} rx="12" fill="var(--azul-10)" />
      {pontos.map((p, i) => (
        <circle key={i} cx={proj.x(p.lon)} cy={proj.y(p.lat)} r={5 + 9 * Math.sqrt((p.peso ?? 1) / maxPeso)} fill={cor[p.cor ?? 'verde']} fillOpacity="0.8" stroke="var(--branco)" strokeWidth="2">
          <title>{p.rotulo}</title>
        </circle>
      ))}
      <g transform={`translate(${L - M - 80} ${A - 10})`}>
        <line x1="0" x2="80" y1="0" y2="0" stroke="var(--azul-escuro)" strokeWidth="2" />
        <text x="40" y="-5" textAnchor="middle" fontSize="11" fill="var(--azul-escuro)">
          {mostrarNumero(proj.km80)} km
        </text>
      </g>
    </svg>
  );
}
