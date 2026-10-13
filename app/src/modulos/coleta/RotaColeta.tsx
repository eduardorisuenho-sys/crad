/**
 * Rota de coleta: mapa simples (sem internet e sem mapa de fundo) com as
 * matrizes ativas, a posição do coletor e quem está com fruto maduro.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { coordenadaValida, distanciaMetros, podeColetar, type MatrizResumo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { nomesEspecies, ultimaFenologia } from './dados';
import { formatarDistancia } from './NovaColeta';

const DIAS_FRUTO = 45;
const L = 360;
const A = 300;
const MARGEM = 24;

export function RotaColeta() {
  const { repo, db } = useApp();
  const [gps, setGps] = useState<PosicaoGps | null>(null);
  const [soFruto, setSoFruto] = useState(false);
  useEffect(() => acompanharPosicao(setGps, () => {}), []);
  const matrizes = useLiveQuery(() => repo.listar('matriz'), [repo]) ?? [];
  const feno = useLiveQuery(() => ultimaFenologia(db), [db]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);

  const pontos = useMemo(() => {
    const limite = new Date(Date.now() - DIAS_FRUTO * 86_400_000).toISOString().slice(0, 10);
    return matrizes
      .filter((m) => podeColetar(m as MatrizResumo) && coordenadaValida(m.lat, m.lon))
      .map((m) => {
        const f = feno?.get(m.id);
        const fruto = !!f && String(f.data) >= limite && (f.fases as string[]).includes('fruto_maduro');
        const dist = gps ? distanciaMetros(gps, { lat: m.lat as number, lon: m.lon as number }) : null;
        return { m, fruto, dist, lat: m.lat as number, lon: m.lon as number };
      })
      .filter((p) => !soFruto || p.fruto)
      .sort((a, b) => Number(b.fruto) - Number(a.fruto) || (a.dist ?? Infinity) - (b.dist ?? Infinity));
  }, [matrizes, feno, gps, soFruto]);

  // Projeção simples (equiretangular) que cabe todos os pontos e o coletor.
  const proj = useMemo(() => {
    const todos = [...pontos.map((p) => ({ lat: p.lat, lon: p.lon })), ...(gps ? [gps] : [])];
    if (!todos.length) return null;
    const minLat = Math.min(...todos.map((p) => p.lat));
    const maxLat = Math.max(...todos.map((p) => p.lat));
    const minLon = Math.min(...todos.map((p) => p.lon));
    const maxLon = Math.max(...todos.map((p) => p.lon));
    const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const larg = Math.max((maxLon - minLon) * cos, 1e-4);
    const alt = Math.max(maxLat - minLat, 1e-4);
    const esc = Math.min((L - 2 * MARGEM) / larg, (A - 2 * MARGEM) / alt);
    const x = (lon: number) => MARGEM + (lon - minLon) * cos * esc + ((L - 2 * MARGEM) - larg * esc) / 2;
    const y = (lat: number) => A - MARGEM - (lat - minLat) * esc - ((A - 2 * MARGEM) - alt * esc) / 2;
    // barra de escala: quantos metros cabem em 80 px
    const metros80 = (80 / esc) * 111_320;
    return { x, y, metros80 };
  }, [pontos, gps]);

  return (
    <Tela titulo="Rota de coleta">
      <div className="filtros">
        <button className={`chip ${soFruto ? 'ativo' : ''}`} onClick={() => setSoFruto(!soFruto)}>
          Só com fruto maduro
        </button>
        <span>{gps ? `GPS ±${gps.precisao_m} m` : 'Procurando o GPS…'}</span>
      </div>
      {proj ? (
        <svg className="mapa-rota" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Mapa das matrizes">
          <rect width={L} height={A} rx={14} fill="var(--azul-10)" />
          {pontos.map((p) => (
            <g key={p.m.id}>
              <circle cx={proj.x(p.lon)} cy={proj.y(p.lat)} r={p.fruto ? 9 : 6} fill={p.fruto ? 'var(--verde)' : 'var(--azul)'} stroke="var(--branco)" strokeWidth={2} />
              <text x={proj.x(p.lon) + 11} y={proj.y(p.lat) + 4} fontSize={11} fill="var(--azul-escuro)" fontWeight={700}>
                {String(p.m.codigo).replace('MT-', '')}
              </text>
            </g>
          ))}
          {gps && (
            <g>
              <circle cx={proj.x(gps.lon)} cy={proj.y(gps.lat)} r={14} fill="var(--azul-escuro)" opacity={0.18} />
              <circle cx={proj.x(gps.lon)} cy={proj.y(gps.lat)} r={7} fill="var(--azul-escuro)" stroke="var(--branco)" strokeWidth={3} />
            </g>
          )}
          <line x1={MARGEM} x2={MARGEM + 80} y1={A - 10} y2={A - 10} stroke="var(--azul-escuro)" strokeWidth={3} />
          <text x={MARGEM + 86} y={A - 6} fontSize={11} fill="var(--azul-escuro)">
            {formatarDistancia(proj.metros80)}
          </text>
        </svg>
      ) : (
        <p className="vazio">Nenhuma matriz aprovada com GPS neste viveiro.</p>
      )}
      <p className="dica">
        <span className="ponto verde" /> fruto maduro nos últimos {DIAS_FRUTO} dias · <span className="ponto azul" /> outras matrizes · <span className="ponto escuro" /> você
      </p>
      <ul className="lista">
        {pontos.map((p) => (
          <li key={p.m.id}>
            <Link to={`/matrizes/${p.m.id}`} className="item-lista">
              <Icone nome="arvore" />
              <div>
                <strong>{String(p.m.codigo)}</strong>
                <small>{nomes?.get(String(p.m.especie_id)) ?? ''}</small>
              </div>
              {p.fruto && <span className="selo ok">fruto maduro</span>}
              {p.dist !== null && <span className="selo">{formatarDistancia(p.dist)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Tela>
  );
}
