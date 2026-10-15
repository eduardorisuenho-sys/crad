/**
 * Rota de coleta: mapa com fundo híbrido (satélite + nomes e estradas), as
 * matrizes ativas, a posição do coletor e quem está com fruto maduro. Sem
 * internet, mostra os azulejos já vistos (ou só os pontos).
 * Ao escolher uma matriz, o mapa mostra só ela e o coletor, com a linha do
 * ponto onde ele está até a árvore, a distância e a direção. O caminho pelas
 * estradas abre no Google Maps.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { coordenadaValida, distanciaMetros, podeColetar, type MatrizResumo } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { azulejos, CREDITO_HIBRIDO, enquadrar, linkGoogleMaps, mundo, rumo } from '../../plataforma/mapa';
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
  const [params, setParams] = useSearchParams();
  const escolhidaId = params.get('matriz');
  const local = useLocation();
  const navegar = useNavigate();
  // escolher abre um passo novo (o Voltar do celular volta para a lista)
  const escolher = (id: string | null) => {
    if (!id && (local.state as { daLista?: boolean } | null)?.daLista) navegar(-1);
    else setParams(id ? { matriz: id } : {}, { replace: !!escolhidaId || !id, state: id ? { daLista: true } : null });
    window.scrollTo({ top: 0 });
  };
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

  const escolhida = pontos.find((p) => p.m.id === escolhidaId) ?? null;
  // no mapa: só a matriz escolhida, ou todas
  const noMapa = useMemo(() => (escolhida ? [escolhida] : pontos), [escolhida, pontos]);
  const direcao = escolhida && gps ? rumo(gps, escolhida) : null;

  // Projeção dos mapas da internet (Web Mercator), com o zoom que cabe os pontos e o coletor.
  const proj = useMemo(() => {
    const todos = [...noMapa.map((p) => ({ lat: p.lat, lon: p.lon })), ...(gps ? [gps] : [])];
    const v = enquadrar(todos, L, A, MARGEM);
    if (!v) return null;
    const x = (lon: number, lat: number) => mundo(lat, lon, v.z).x - v.ox;
    const y = (lat: number, lon: number) => mundo(lat, lon, v.z).y - v.oy;
    // barra de escala: quantos metros cabem em 80 px
    return { v, x, y, metros80: 80 * v.metrosPorPx };
  }, [noMapa, gps]);

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
          {escolhida && gps && (
            <line
              data-testid="linha-rota"
              x1={proj.x(gps.lon, gps.lat)}
              y1={proj.y(gps.lat, gps.lon)}
              x2={proj.x(escolhida.lon, escolhida.lat)}
              y2={proj.y(escolhida.lat, escolhida.lon)}
              stroke="var(--branco)"
              strokeWidth={5}
              strokeDasharray="10 7"
              strokeLinecap="round"
            />
          )}
          {escolhida && gps && (
            <line
              x1={proj.x(gps.lon, gps.lat)}
              y1={proj.y(gps.lat, gps.lon)}
              x2={proj.x(escolhida.lon, escolhida.lat)}
              y2={proj.y(escolhida.lat, escolhida.lon)}
              stroke="var(--azul)"
              strokeWidth={3}
              strokeDasharray="10 7"
              strokeLinecap="round"
            />
          )}
          {noMapa.map((p) => (
            <g key={p.m.id} onClick={() => escolher(p.m.id)} style={{ cursor: 'pointer' }}>
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
      {escolhida ? (
        <section className="cartao rota-escolhida" data-testid="rota-escolhida">
          <h2>
            Até {String(escolhida.m.codigo)} · {nomes?.get(String(escolhida.m.especie_id)) ?? ''}
          </h2>
          {gps && escolhida.dist !== null && direcao ? (
            <p className="contador">
              {formatarDistancia(escolhida.dist)} em linha reta, para o {direcao.direcao}
            </p>
          ) : (
            <p className="dica">Procurando o GPS para traçar a linha até a árvore…</p>
          )}
          <p className="dica">A linha é reta, do ponto onde você está até a árvore. O caminho pelas estradas abre no Google Maps (precisa de internet).</p>
          <a className="botao-principal" href={linkGoogleMaps(escolhida.lat, escolhida.lon)} target="_blank" rel="noreferrer">
            <Icone nome="plantio" /> Caminho pelas estradas (Google Maps)
          </a>
          <Link to={`/matrizes/${escolhida.m.id}`} className="botao-secundario">
            <Icone nome="arvore" /> Ficha da matriz
          </Link>
          <button className="botao-secundario" onClick={() => escolher(null)}>
            Ver todas as matrizes
          </button>
        </section>
      ) : (
        <>
          <p className="dica">
            <span className="ponto verde" /> fruto maduro nos últimos {DIAS_FRUTO} dias · <span className="ponto azul" /> outras matrizes · <span className="ponto escuro" /> você
          </p>
          <p className="pergunta">Toque na matriz para ver a rota até ela</p>
          <ul className="lista">
            {pontos.map((p) => (
              <li key={p.m.id}>
                <button className="item-lista botao-lista" onClick={() => escolher(p.m.id)}>
                  <Icone nome="arvore" />
                  <div>
                    <strong>{String(p.m.codigo)}</strong>
                    <small>{nomes?.get(String(p.m.especie_id)) ?? ''}</small>
                  </div>
                  {p.fruto && <span className="selo ok">fruto maduro</span>}
                  {p.dist !== null && <span className="selo">{formatarDistancia(p.dist)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tela>
  );
}
