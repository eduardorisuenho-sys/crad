/**
 * Cadastro de matriz em campo, uma coisa por tela. Funciona sem internet:
 * GPS, assistente, fotos e código saem do próprio aparelho.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { fotosFaltando, matrizesProximas, parametro, type Registro } from '@crads/dominio';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { MiniaturaBlob } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { Assistente, type GrauCerteza } from '../assistente/Assistente';
import { FiguraOpcao } from '../assistente/FiguraOpcao';
import { EscolherEspecie } from '../especies/EscolherEspecie';
import { gravarFoto, prepararFoto, type FotoPendente } from './fotos';

type Etapa = 'gps' | 'especie' | 'assistente' | 'busca' | 'certeza' | 'proximas' | 'fotos' | 'arvore' | 'proprietario' | 'conferir';
const ORDEM: Etapa[] = ['gps', 'especie', 'fotos', 'arvore', 'proprietario', 'conferir'];

interface Rascunho {
  gps?: PosicaoGps;
  especie_id?: string | null;
  grau_certeza?: GrauCerteza;
  metodo_identificacao?: 'assistente' | 'manual';
  respostas_assistente?: Record<string, string>;
  altura_m?: number | null;
  medida?: 'dap' | 'cap';
  diametro_cm?: number | null;
  estado_fitossanitario?: string;
  tipo_local?: string;
  descricao_local?: string;
  proprietario_nome?: string;
  proprietario_telefone?: string;
  autorizacao_proprietario?: boolean;
  observacao?: string;
}

const CHAVE_RASCUNHO = 'crads_rascunho_matriz';
const lerRascunho = (): Rascunho => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) ?? '{}');
  } catch {
    return {};
  }
};

export const PARTES_FOTO: { parte: string; rotulo: string; figura: string }[] = [
  { parte: 'arvore', rotulo: 'Árvore inteira', figura: 'arvore' },
  { parte: 'tronco', rotulo: 'Tronco e casca', figura: 'casca_rugosa' },
  { parte: 'folha', rotulo: 'Folhas', figura: 'folha_composta' },
  { parte: 'flor', rotulo: 'Flor', figura: 'flor_amarela' },
  { parte: 'fruto', rotulo: 'Fruto', figura: 'fruto_carnoso' },
];
const TIPOS_LOCAL = [
  { valor: 'mata', rotulo: 'Mata' },
  { valor: 'app', rotulo: 'Beira de rio (APP)' },
  { valor: 'propriedade_rural', rotulo: 'Propriedade rural' },
  { valor: 'praca', rotulo: 'Praça / cidade' },
  { valor: 'beira_estrada', rotulo: 'Beira de estrada' },
  { valor: 'outro', rotulo: 'Outro' },
];
const ESTADOS = [
  { valor: 'bom', rotulo: 'Boa, saudável' },
  { valor: 'regular', rotulo: 'Com alguns problemas' },
  { valor: 'ruim', rotulo: 'Doente ou muito danificada' },
];

export function NovaMatriz() {
  const { db, repo, viveiroId } = useApp();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>('gps');
  const [r, setR] = useState<Rascunho>(lerRascunho);
  const [fotos, setFotos] = useState<FotoPendente[]>([]);
  const [gpsAoVivo, setGpsAoVivo] = useState<PosicaoGps | null>(null);
  const [erroGps, setErroGps] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const precisaoMax = parametro<number>(parametros, 'precisao_gps_maxima_m', viveiroId);
  const distMin = parametro<number>(parametros, 'distancia_min_matrizes_m', viveiroId);
  const obrigatorias = parametro<string[]>(parametros, 'fotos_obrigatorias_matriz', viveiroId);
  const matrizes = useLiveQuery(() => repo.listar('matriz'), [repo]) ?? [];
  const especie = useLiveQuery(() => (r.especie_id ? db.colecao('especie').get(r.especie_id) : undefined), [r.especie_id]);
  const nomePopular = useLiveQuery(async () => (r.especie_id ? (await db.colecao('nome_popular').where('especie_id').equals(r.especie_id).first())?.nome : undefined), [r.especie_id]);

  const atualizar = (mudancas: Partial<Rascunho>) =>
    setR((atual) => {
      const novo = { ...atual, ...mudancas };
      try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(novo));
      } catch {
        /* sem espaço: segue só na memória */
      }
      return novo;
    });

  useEffect(() => {
    if (etapa !== 'gps') return;
    setErroGps('');
    return acompanharPosicao(setGpsAoVivo, setErroGps);
  }, [etapa]);

  const proximas = useMemo(
    () => (r.gps && r.especie_id ? matrizesProximas({ id: '', especie_id: r.especie_id, lat: r.gps.lat, lon: r.gps.lon }, matrizes as never, distMin) : []),
    [r.gps, r.especie_id, matrizes, distMin],
  );
  const faltam = fotosFaltando(
    fotos.map((f) => f.parte),
    obrigatorias,
  );
  const passo = Math.max(0, ORDEM.indexOf(['assistente', 'busca', 'certeza', 'proximas'].includes(etapa) ? 'especie' : etapa)) + 1;

  function depoisDaEspecie() {
    setEtapa(proximas.length ? 'proximas' : 'fotos');
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const codigo = await repo.proximoCodigo('MT');
      let proprietario: Registro | undefined;
      if (r.proprietario_nome?.trim()) {
        proprietario = await repo.salvar('pessoa', { nome: r.proprietario_nome.trim(), tipo: 'fisica' });
        // LGPD: o telefone vai para a tabela que só o gestor lê.
        if (r.proprietario_telefone?.trim()) await repo.salvar('dados_pessoais', { pessoa_id: proprietario.id, telefone: r.proprietario_telefone.trim() });
      }
      const m = await repo.salvar('matriz', {
        codigo,
        especie_id: r.especie_id ?? null,
        grau_certeza: r.especie_id ? r.grau_certeza ?? 'provavel' : 'a_identificar',
        metodo_identificacao: r.metodo_identificacao ?? null,
        respostas_assistente: r.respostas_assistente ?? null,
        lat: r.gps?.lat ?? null,
        lon: r.gps?.lon ?? null,
        precisao_m: r.gps?.precisao_m ?? null,
        altitude: r.gps?.altitude ?? null,
        altura_m: r.altura_m ?? null,
        dap_cm: r.medida !== 'cap' ? r.diametro_cm ?? null : r.diametro_cm ? Math.round((r.diametro_cm / Math.PI) * 10) / 10 : null,
        cap_cm: r.medida === 'cap' ? r.diametro_cm ?? null : null,
        estado_fitossanitario: r.estado_fitossanitario ?? null,
        tipo_local: r.tipo_local ?? null,
        descricao_local: r.descricao_local ?? null,
        proprietario_pessoa_id: proprietario?.id ?? null,
        autorizacao_proprietario: r.autorizacao_proprietario ?? false,
        observacao: r.observacao ?? null,
        situacao: 'ativa',
        situacao_validacao: 'pendente',
      });
      for (const f of fotos) await gravarFoto(db, repo, 'matriz', m.id, viveiroId, f);
      localStorage.removeItem(CHAVE_RASCUNHO);
      navegar(`/matrizes/${m.id}?nova=1`, { replace: true });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  const voltar = (para: Etapa) => (
    <button className="botao-secundario" onClick={() => setEtapa(para)}>
      <Icone nome="voltar" /> Voltar
    </button>
  );

  return (
    <Tela titulo="Nova matriz">
      <p className="passo">
        Passo {passo} de {ORDEM.length}
      </p>

      {etapa === 'gps' && (
        <div className="assistente">
          <h2 className="pergunta">Fique ao lado da árvore</h2>
          <div className="gps-caixa" data-testid="gps">
            <Icone nome="plantio" tamanho={56} />
            {gpsAoVivo ? (
              <>
                <strong className={gpsAoVivo.precisao_m <= precisaoMax ? 'bom' : 'ruim'}>±{gpsAoVivo.precisao_m} m</strong>
                <small>
                  {gpsAoVivo.lat.toFixed(5)}, {gpsAoVivo.lon.toFixed(5)}
                </small>
                {gpsAoVivo.precisao_m > precisaoMax && <small>Aguarde: a precisão vai melhorando em lugar aberto.</small>}
              </>
            ) : (
              <span>{erroGps || 'Procurando o GPS… (funciona sem internet)'}</span>
            )}
          </div>
          <button
            className="botao-principal"
            disabled={!gpsAoVivo}
            onClick={() => {
              if (gpsAoVivo && gpsAoVivo.precisao_m > precisaoMax && !confirm(`O GPS está com precisão de ${gpsAoVivo.precisao_m} m. Usar mesmo assim?`)) return;
              atualizar({ gps: gpsAoVivo! });
              setEtapa('especie');
            }}
          >
            <Icone nome="certo" /> Usar este ponto
          </button>
        </div>
      )}

      {etapa === 'especie' && (
        <div className="assistente">
          <h2 className="pergunta">Qual é a árvore?</h2>
          <div className="lista-grande">
            <button className="botao-grande" onClick={() => setEtapa('assistente')}>
              <FiguraOpcao nome="folha_composta" tamanho={48} />
              <span>Descobrir com perguntas</span>
            </button>
            <button className="botao-grande" onClick={() => setEtapa('busca')}>
              <Icone nome="catalogo" tamanho={48} />
              <span>Já sei o nome</span>
            </button>
            <button
              className="botao-grande"
              onClick={() => {
                atualizar({ especie_id: null, grau_certeza: 'a_identificar', metodo_identificacao: undefined });
                setEtapa('fotos');
              }}
            >
              <FiguraOpcao nome="nao_sei" tamanho={48} />
              <span>Não sei (a identificar)</span>
            </button>
          </div>
          {voltar('gps')}
        </div>
      )}

      {etapa === 'assistente' && (
        <Assistente
          contexto={{ mes: new Date().getMonth() + 1 }}
          onEscolher={(res) => {
            atualizar({ especie_id: res.especie_id, grau_certeza: res.grau_certeza, metodo_identificacao: 'assistente', respostas_assistente: res.respostas });
            if (res.especie_id) depoisDaEspecie();
            else setEtapa('fotos');
          }}
        />
      )}

      {etapa === 'busca' && (
        <>
          <EscolherEspecie
            aoEscolher={(id) => {
              atualizar({ especie_id: id, metodo_identificacao: 'manual', respostas_assistente: undefined });
              setEtapa('certeza');
            }}
          />
          {voltar('especie')}
        </>
      )}

      {etapa === 'certeza' && (
        <div className="assistente">
          <h2 className="pergunta">{nomePopular ? String(nomePopular) : String(especie?.nome_cientifico ?? '')}</h2>
          <h3>Você tem certeza?</h3>
          <div className="lista-grande">
            {(
              [
                ['certo', 'Tenho certeza', 'certo'],
                ['provavel', 'Acho que é (provável)', 'aviso'],
              ] as const
            ).map(([g, rot, ic]) => (
              <button
                key={g}
                className="botao-grande"
                onClick={() => {
                  atualizar({ grau_certeza: g });
                  depoisDaEspecie();
                }}
              >
                <Icone nome={ic} tamanho={40} />
                <span>{rot}</span>
              </button>
            ))}
          </div>
          {voltar('busca')}
        </div>
      )}

      {etapa === 'proximas' && (
        <div className="assistente">
          <p className="mensagem alerta">
            <Icone nome="aviso" tamanho={24} /> Já existe matriz desta espécie perto daqui. Árvores muito próximas podem ser parentes e diminuir a diversidade das
            sementes.
          </p>
          <ul className="lista">
            {proximas.map((p) => (
              <li key={p.id} className="item-lista">
                <strong>{p.codigo}</strong> <span>a {p.distancia_m} m</span>
              </li>
            ))}
          </ul>
          <p className="dica">O recomendado é pelo menos {distMin} m entre matrizes da mesma espécie.</p>
          <button className="botao-principal" onClick={() => setEtapa('fotos')}>
            Cadastrar mesmo assim
          </button>
          <button className="botao-secundario" onClick={() => navegar('/matrizes')}>
            Cancelar cadastro
          </button>
        </div>
      )}

      {etapa === 'fotos' && (
        <div className="assistente">
          <h2 className="pergunta">Tire as fotos</h2>
          <div className="grade-opcoes">
            {PARTES_FOTO.map((p) => {
              const tiradas = fotos.filter((f) => f.parte === p.parte);
              return (
                <BotaoFoto
                  key={p.parte}
                  className={`opcao ${tiradas.length ? 'ativa' : ''}`}
                  aoEscolher={async (arquivo) => {
                    // A compressão é assíncrona: junta à lista atual, não à de quando a foto foi tirada.
                    const nova = await prepararFoto(arquivo, p.parte, r.gps ?? null);
                    setFotos((atuais) => [...atuais, nova]);
                  }}
                >
                  {tiradas.length ? <MiniaturaBlob blob={tiradas[tiradas.length - 1].miniatura} alt={p.rotulo} tamanho={72} /> : <FiguraOpcao nome={p.figura} />}
                  <span>
                    {p.rotulo}
                    {obrigatorias.includes(p.parte) && !tiradas.length ? ' *' : ''}
                    {tiradas.length > 1 ? ` (${tiradas.length})` : ''}
                  </span>
                </BotaoFoto>
              );
            })}
          </div>
          {faltam.length > 0 && <p className="dica">* Obrigatórias. Faltam: {faltam.map((f) => PARTES_FOTO.find((p) => p.parte === f)?.rotulo ?? f).join(', ')}.</p>}
          <button className="botao-principal" disabled={faltam.length > 0} onClick={() => setEtapa('arvore')}>
            Continuar
          </button>
          {voltar('especie')}
        </div>
      )}

      {etapa === 'arvore' && (
        <div className="formulario">
          <h2 className="pergunta">Sobre a árvore</h2>
          <label>
            Altura (metros, aproximada)
            <input type="number" inputMode="decimal" value={r.altura_m ?? ''} onChange={(e) => atualizar({ altura_m: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <fieldset className="meses">
            <legend>Medida do tronco a 1,30 m do chão</legend>
            <button type="button" className={`chip ${r.medida !== 'cap' ? 'ativo' : ''}`} onClick={() => atualizar({ medida: 'dap' })}>
              Diâmetro (DAP)
            </button>
            <button type="button" className={`chip ${r.medida === 'cap' ? 'ativo' : ''}`} onClick={() => atualizar({ medida: 'cap' })}>
              Volta do tronco (CAP)
            </button>
          </fieldset>
          <label>
            {r.medida === 'cap' ? 'CAP' : 'DAP'} (centímetros)
            <input type="number" inputMode="decimal" value={r.diametro_cm ?? ''} onChange={(e) => atualizar({ diametro_cm: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <fieldset className="meses">
            <legend>Como está a árvore?</legend>
            {ESTADOS.map((s) => (
              <button type="button" key={s.valor} className={`chip ${r.estado_fitossanitario === s.valor ? 'ativo' : ''}`} onClick={() => atualizar({ estado_fitossanitario: s.valor })}>
                {s.rotulo}
              </button>
            ))}
          </fieldset>
          <fieldset className="meses">
            <legend>Onde ela está?</legend>
            {TIPOS_LOCAL.map((s) => (
              <button type="button" key={s.valor} className={`chip ${r.tipo_local === s.valor ? 'ativo' : ''}`} onClick={() => atualizar({ tipo_local: s.valor })}>
                {s.rotulo}
              </button>
            ))}
          </fieldset>
          <label>
            Como chegar (opcional)
            <input value={r.descricao_local ?? ''} onChange={(e) => atualizar({ descricao_local: e.target.value })} placeholder="Ex.: fazenda Boa Vista, perto da porteira" />
          </label>
          <button className="botao-principal" onClick={() => setEtapa('proprietario')}>
            Continuar
          </button>
          {voltar('fotos')}
        </div>
      )}

      {etapa === 'proprietario' && (
        <div className="formulario">
          <h2 className="pergunta">Dono da área</h2>
          <p className="dica">Deixe em branco se for área pública. O telefone só o gestor vê.</p>
          <label>
            Nome
            <input value={r.proprietario_nome ?? ''} onChange={(e) => atualizar({ proprietario_nome: e.target.value })} />
          </label>
          <label>
            Telefone
            <input type="tel" inputMode="tel" value={r.proprietario_telefone ?? ''} onChange={(e) => atualizar({ proprietario_telefone: e.target.value })} />
          </label>
          <label className="linha-check">
            <input type="checkbox" checked={!!r.autorizacao_proprietario} onChange={(e) => atualizar({ autorizacao_proprietario: e.target.checked })} /> O dono autorizou a
            entrada e a coleta
          </label>
          <button className="botao-principal" onClick={() => setEtapa('conferir')}>
            Continuar
          </button>
          {voltar('arvore')}
        </div>
      )}

      {etapa === 'conferir' && (
        <div className="assistente">
          <h2 className="pergunta">Confira</h2>
          <dl className="ficha">
            <dt>Espécie</dt>
            <dd>{r.especie_id ? `${nomePopular ?? ''} (${String(especie?.nome_cientifico ?? '')})` : 'a identificar'}</dd>
            <dt>Certeza</dt>
            <dd>{{ certo: 'certo', provavel: 'provável', a_identificar: 'a identificar' }[r.grau_certeza ?? 'a_identificar']}</dd>
            <dt>Local</dt>
            <dd>{r.gps ? `${r.gps.lat.toFixed(5)}, ${r.gps.lon.toFixed(5)} (±${r.gps.precisao_m} m)` : 'sem GPS'}</dd>
            <dt>Fotos</dt>
            <dd>{fotos.length}</dd>
          </dl>
          <label className="formulario">
            Observação (opcional)
            <input value={r.observacao ?? ''} onChange={(e) => atualizar({ observacao: e.target.value })} />
          </label>
          {erro && <p className="erro">{erro}</p>}
          <button className="botao-principal" disabled={salvando} onClick={() => void salvar()}>
            <Icone nome="certo" /> {salvando ? 'Salvando…' : 'Salvar matriz'}
          </button>
          {voltar('proprietario')}
        </div>
      )}
    </Tela>
  );
}

