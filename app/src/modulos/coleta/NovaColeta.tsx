/** Registro de coleta em campo, uma coisa por tela, sem internet. */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { coordenadaValida, distanciaMetros, normalizarBusca, podeColetar, type MatrizResumo } from '@crads/dominio';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { MiniaturaBlob } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { CAMPO_DECIMAL, lerNumero } from '../../plataforma/numero';
import { FiguraOpcao } from '../assistente/FiguraOpcao';
import { gravarFoto, prepararFoto, type FotoPendente } from '../matrizes/fotos';
import { nomesEspecies } from './dados';
import { EscolherEspecie } from '../especies/EscolherEspecie';

type Etapa = 'matriz' | 'especie' | 'quantidade' | 'material' | 'foto' | 'conferir';
const UNIDADES = [
  { valor: 'kg', rotulo: 'Quilos (kg)' },
  { valor: 'g', rotulo: 'Gramas (g)' },
  { valor: 'litros', rotulo: 'Litros' },
  { valor: 'unidades', rotulo: 'Unidades (contadas)' },
];

export function formatarDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function NovaColeta() {
  const { repo, db, sessao, viveiroId } = useApp();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [etapa, setEtapa] = useState<Etapa>(params.get('matriz') ? 'quantidade' : 'matriz');
  const [matrizId, setMatrizId] = useState<string | null>(params.get('matriz'));
  // árvore sem matriz cadastrada: só a espécie
  const [especieId, setEspecieId] = useState<string | null>(null);
  const [gps, setGps] = useState<PosicaoGps | null>(null);
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [material, setMaterial] = useState<'fruto' | 'semente'>('fruto');
  const [foto, setFoto] = useState<FotoPendente | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => acompanharPosicao(setGps, () => {}), []);
  const matrizes = useLiveQuery(() => repo.listar('matriz'), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const matriz = matrizes.find((m) => m.id === matrizId);

  const lista = useMemo(() => {
    const q = normalizarBusca(busca);
    return matrizes
      .filter((m) => podeColetar(m as MatrizResumo))
      .filter((m) => !q || normalizarBusca(`${m.codigo} ${nomes?.get(String(m.especie_id)) ?? ''}`).includes(q))
      .map((m) => ({
        m,
        dist: gps && coordenadaValida(m.lat, m.lon) ? distanciaMetros(gps, { lat: m.lat as number, lon: m.lon as number }) : null,
      }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
  }, [matrizes, busca, gps, nomes]);
  const naoAprovadas = matrizes.filter((m) => !podeColetar(m as MatrizResumo) && busca && normalizarBusca(String(m.codigo)).includes(normalizarBusca(busca)));

  async function salvar() {
    setSalvando(true);
    const c = await repo.salvar('coleta', {
      matriz_id: matrizId || null,
      especie_id: matrizId ? (matriz?.especie_id ?? null) : especieId,
      data: new Date().toISOString(),
      coletor_id: sessao?.id ?? null,
      material,
      quantidade: lerNumero(quantidade),
      unidade,
      lat: gps?.lat ?? null,
      lon: gps?.lon ?? null,
      observacao: observacao || null,
    });
    if (foto) await gravarFoto(db, repo, 'coleta', c.id, viveiroId, foto);
    navegar('/coleta?salva=1', { replace: true });
  }

  const voltar = (para: Etapa) => (
    <button className="botao-secundario" onClick={() => setEtapa(para)}>
      <Icone nome="voltar" /> Voltar
    </button>
  );
  const cabecalhoMatriz = matriz ? (
    <p className="contador">
      {String(matriz.codigo)} · {nomes?.get(String(matriz.especie_id)) ?? ''}
    </p>
  ) : especieId ? (
    <p className="contador">Árvore sem matriz · {nomes?.get(especieId) ?? ''}</p>
  ) : null;

  return (
    <Tela titulo="Nova coleta">
      {etapa === 'matriz' && (
        <div className="assistente">
          <h2 className="pergunta">De qual matriz?</h2>
          <Link to="/ler-qr?para=coleta" className="botao-grande">
            <Icone nome="catalogo" tamanho={40} />
            <span>Ler a plaqueta (QR)</span>
          </Link>
          <input className="campo-busca" type="search" placeholder="Código ou espécie" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar matriz" />
          {naoAprovadas.length > 0 && (
            <p className="mensagem alerta">
              <Icone nome="aviso" tamanho={20} /> {naoAprovadas.map((m) => String(m.codigo)).join(', ')} está morta, inativa ou foi excluída e não pode receber coleta.
            </p>
          )}
          <ul className="lista">
            {lista.map(({ m, dist }) => (
              <li key={m.id}>
                <button
                  className="item-lista botao-lista"
                  onClick={() => {
                    setMatrizId(m.id);
                    setEtapa('quantidade');
                  }}
                >
                  <Icone nome="arvore" />
                  <div>
                    <strong>{String(m.codigo)}</strong>
                    <small>{nomes?.get(String(m.especie_id)) ?? ''}</small>
                  </div>
                  {dist !== null && <span className="selo">{formatarDistancia(dist)}</span>}
                </button>
              </li>
            ))}
            {!lista.length && <li className="vazio">Nenhuma matriz cadastrada neste viveiro.</li>}
          </ul>
          <button
            className="botao-grande"
            onClick={() => {
              setMatrizId(null);
              setEtapa('especie');
            }}
          >
            <Icone nome="semente" tamanho={40} />
            <span>
              Registrar sementes<small className="dica-botao">De árvore sem matriz cadastrada: escolher só a espécie</small>
            </span>
          </button>
        </div>
      )}

      {etapa === 'especie' && (
        <div className="assistente">
          <h2 className="pergunta">De qual espécie é a árvore?</h2>
          <p className="dica">Use quando a árvore não tem matriz cadastrada. O ponto do GPS fica guardado na coleta.</p>
          <EscolherEspecie
            aoEscolher={(id) => {
              setEspecieId(id);
              setEtapa('quantidade');
            }}
          />
          {voltar('matriz')}
        </div>
      )}

      {etapa === 'quantidade' && (
        <div className="formulario">
          {cabecalhoMatriz}
          <h2 className="pergunta">Quanto foi colhido?</h2>
          <label>
            Quantidade
            <input {...CAMPO_DECIMAL} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} autoFocus />
          </label>
          <fieldset className="meses">
            <legend>Medida</legend>
            {UNIDADES.map((u) => (
              <button type="button" key={u.valor} className={`chip ${unidade === u.valor ? 'ativo' : ''}`} onClick={() => setUnidade(u.valor)}>
                {u.rotulo}
              </button>
            ))}
          </fieldset>
          <button className="botao-principal" disabled={!((lerNumero(quantidade) ?? 0) > 0)} onClick={() => setEtapa('material')}>
            Continuar
          </button>
          {voltar(matrizId ? 'matriz' : 'especie')}
        </div>
      )}

      {etapa === 'material' && (
        <div className="assistente">
          {cabecalhoMatriz}
          <h2 className="pergunta">O que foi colhido?</h2>
          <div className="grade-opcoes">
            <button
              className={`opcao ${material === 'fruto' ? 'ativa' : ''}`}
              onClick={() => {
                setMaterial('fruto');
                setEtapa('foto');
              }}
            >
              <FiguraOpcao nome="fruto_carnoso" />
              <span>Frutos</span>
            </button>
            <button
              className={`opcao ${material === 'semente' ? 'ativa' : ''}`}
              onClick={() => {
                setMaterial('semente');
                setEtapa('foto');
              }}
            >
              <FiguraOpcao nome="fruto_capsula" />
              <span>Sementes</span>
            </button>
          </div>
          {voltar('quantidade')}
        </div>
      )}

      {etapa === 'foto' && (
        <div className="assistente">
          {cabecalhoMatriz}
          <h2 className="pergunta">Foto do que foi colhido</h2>
          <BotaoFoto className={`opcao ${foto ? 'ativa' : ''}`} aoEscolher={async (f) => setFoto(await prepararFoto(f, material === 'fruto' ? 'fruto' : 'semente', gps))}>
            {foto ? <MiniaturaBlob blob={foto.miniatura} alt="Material colhido" tamanho={96} /> : <FiguraOpcao nome="fruto_carnoso" />}
            <span>{foto ? 'Trocar foto' : 'Tirar foto'}</span>
          </BotaoFoto>
          <button className="botao-principal" onClick={() => setEtapa('conferir')}>
            {foto ? 'Continuar' : 'Pular a foto'}
          </button>
          {voltar('material')}
        </div>
      )}

      {etapa === 'conferir' && (
        <div className="assistente">
          <h2 className="pergunta">Confira</h2>
          <dl className="ficha">
            <dt>Matriz</dt>
            <dd>{matriz ? `${String(matriz.codigo)} · ${nomes?.get(String(matriz.especie_id)) ?? ''}` : `sem matriz cadastrada · ${nomes?.get(String(especieId)) ?? ''}`}</dd>
            <dt>Colhido</dt>
            <dd>
              {quantidade} {UNIDADES.find((u) => u.valor === unidade)?.rotulo.toLowerCase()} de {material === 'fruto' ? 'frutos' : 'sementes'}
            </dd>
            <dt>Local</dt>
            <dd>{gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'sem GPS'}</dd>
          </dl>
          <label className="formulario">
            Observação (opcional)
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </label>
          {aviso && <p className="erro">{aviso}</p>}
          <button
            className="botao-principal"
            disabled={salvando}
            onClick={() =>
              void salvar().catch((e) => {
                setAviso((e as Error).message);
                setSalvando(false);
              })
            }
          >
            <Icone nome="certo" /> Salvar coleta
          </button>
          {voltar('foto')}
        </div>
      )}
    </Tela>
  );
}
