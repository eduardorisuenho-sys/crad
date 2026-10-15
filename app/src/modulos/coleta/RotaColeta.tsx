/**
 * Rota de coleta: mapa com fundo híbrido (satélite + nomes e estradas), as
 * matrizes ativas, a posição do coletor e quem está com fruto maduro. Sem
 * internet, mostra os azulejos já vistos (ou só os pontos).
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { coordenadaValida, distanciaMetros, podeColetar, type MatrizResumo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { azulejos, CREDITO_HIBRIDO, enquadrar, linkGoogleMaps, mundo } from '../../plataforma/mapa';
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
  const [satelite, setSatelite] = useState(true);
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

  // Projeção dos mapas da internet (Web Mercator), com o zoom que cabe todos os pontos e o coletor.
  const proj = useMemo(() => {
    const todos = [...pontos.map((p) => ({ lat: p.lat, lon: p.lon })), ...(gps ? [gps] : [])];
    const v = enquadrar(todos, L, A, MARGEM);
    if (!v) return null;
    const x = (lon: number, lat: number) => mundo(lat, lon, v.z).x - v.ox;
    const y = (lat: number, lon: number) => mundo(lat, lon, v.z).y - v.oy;
    // barra de escala: quantos metros cabem em 80 px
    return { v, x, y, metros80: 80 * v.metrosPorPx };
  }, [pontos, gps]);

  return (
    <Tela titulo="Rota de coleta">
      <div className="filtros">
        <button className={`chip ${soFruto ? 'ativo' : ''}`} onClick={() => setSoFruto(!soFruto)}>
          Só com fruto maduro
        </button>
        <button className={`chip ${satelite ? 'ativo' : ''}`} onClick={() => setSatelite(!satelite)} aria-pressed={satelite}>
          Satélite
        </button>
        <span>{gps ? `GPS ±${gps.precisao_m} m` : 'Procurando o GPS…'}</span>
      </div>
      {proj ? (
        <svg className="mapa-rota" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Mapa das matrizes">
          <defs>
            <clipPath id="recorte-mapa">
              <rect width={L} height={A} rx={14} />
            </clipPath>
          </defs>
          <rect width={L} height={A} rx={14} fill="var(--azul-10)" />
          {satelite && (
            <g clipPath="url(#recorte-mapa)" data-testid="fundo-hibrido">
              {azulejos(proj.v).map((t) => t.urls.map((u) => <image key={u} href={u} x={t.x} y={t.y} width={256} height={256} preserveAspectRatio="none" />))}
            </g>
          )}
          {pontos.map((p) => (
            <g key={p.m.id}>
              <circle cx={proj.x(p.lon, p.lat)} cy={proj.y(p.lat, p.lon)} r={p.fruto ? 9 : 6} fill={p.fruto ? 'var(--verde)' : 'var(--azul)'} stroke="var(--branco)" strokeWidth={2} />
              <text x={proj.x(p.lon, p.lat) + 11} y={proj.y(p.lat, p.lon) + 4} fontSize={11} fill={satelite ? 'var(--branco)' : 'var(--azul-escuro)'} stroke={satelite ? 'rgba(0,0,0,0.6)' : 'none'} strokeWidth={satelite ? 3 : 0} paintOrder="stroke" fontWeight={700}>
                {String(p.m.codigo).replace('MT-', '')}
              </text>
            </g>
          ))}
          {gps && (
            <g>
              <circle cx={proj.x(gps.lon, gps.lat)} cy={proj.y(gps.lat, gps.lon)} r={14} fill="var(--azul-escuro)" opacity={0.18} />
              <circle cx={proj.x(gps.lon, gps.lat)} cy={proj.y(gps.lat, gps.lon)} r={7} fill="var(--azul-escuro)" stroke="var(--branco)" strokeWidth={3} />
            </g>
          )}
          <line x1={MARGEM} x2={MARGEM + 80} y1={A - 10} y2={A - 10} stroke={satelite ? 'var(--branco)' : 'var(--azul-escuro)'} strokeWidth={3} />
          <text x={MARGEM + 86} y={A - 6} fontSize={11} fill={satelite ? 'var(--branco)' : 'var(--azul-escuro)'} stroke={satelite ? 'rgba(0,0,0,0.6)' : 'none'} strokeWidth={satelite ? 3 : 0} paintOrder="stroke">
            {formatarDistancia(proj.metros80)}
          </text>
          {satelite && (
            <text x={L - 6} y={A - 6} fontSize={8} textAnchor="end" fill="var(--branco)" stroke="rgba(0,0,0,0.6)" strokeWidth={2} paintOrder="stroke">
              {CREDITO_HIBRIDO}
            </text>
          )}
        </svg>
      ) : (
        <p className="vazio">Nenhuma matriz ativa com GPS neste viveiro.</p>
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
            <a className="link" href={linkGoogleMaps(p.lat, p.lon)} target="_blank" rel="noreferrer">
              Como chegar (Google Maps)
            </a>
          </li>
        ))}
      </ul>
    </Tela>
  );
}
