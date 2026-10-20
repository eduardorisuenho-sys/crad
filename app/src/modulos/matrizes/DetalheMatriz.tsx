/** Ficha da matriz: plaqueta com QR, fotos, fenologia e espécie (não precisa de aprovação). */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FENOFASES, matrizesProximas, parametro, podeColetar, type MatrizResumo } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { BotaoLens } from '../../componentes/BotaoLens';
import { fotoGuardadaOuBaixada } from '../../dados/arquivos';
import { EscolherEspecie } from '../especies/EscolherEspecie';
import { ROTULO_CERTEZA } from './ListaMatrizes';
import { BotaoExcluir } from '../../componentes/BotaoExcluir';
import { EditarRegistro } from '../../componentes/EditarRegistro';
import { ESTADOS, TIPOS_LOCAL } from './NovaMatriz';
import { useMarcarVisto } from '../../dados/usePendencias';
import { rotuloParte } from '../especies/rotulos';

const ROTULO_FASE: Record<string, string> = { folha: 'Só folhas', flor: 'Flor', fruto_verde: 'Fruto verde', fruto_maduro: 'Fruto maduro', sem_folha: 'Sem folhas' };

export function DetalheMatriz() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo, pode, viveiroId, sessao } = useApp();
  // abrir esta tela tira a pendência do número vermelho
  useMarcarVisto(id && `matriz:${id}:`);
  const [escolhendoSugerida, setEscolhendoSugerida] = useState(false);
  const m = useLiveQuery(() => db.colecao('matriz').get(id!), [id]);
  const gestor = pode('validar_matriz', m?.viveiro_id);
  const especie = useLiveQuery(() => (m?.especie_id ? db.colecao('especie').get(String(m.especie_id)) : undefined), [m?.especie_id]);
  const popular = useLiveQuery(async () => (m?.especie_id ? (await db.colecao('nome_popular').where('especie_id').equals(String(m.especie_id)).first())?.nome : undefined), [m?.especie_id]);
  const fotos = useLiveQuery(async () => (await db.colecao('foto').where('registro_id').equals(id!).toArray()).filter((f) => !f.excluido), [id]) ?? [];
  const fenologia = useLiveQuery(async () => (await db.colecao('fenologia').where('matriz_id').equals(id!).toArray()).sort((a, b) => String(b.data).localeCompare(String(a.data))), [id]) ?? [];
  const todas = useLiveQuery(() => repo.listar('matriz'), [repo]) ?? [];
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const viveiro = useLiveQuery(() => (m?.viveiro_id ? db.colecao('viveiro').get(String(m.viveiro_id)) : undefined), [m?.viveiro_id]);
  const naFila = useLiveQuery(async () => (await db._fila.where('registro_id').equals(id!).count()) > 0, [id]);

  const [fases, setFases] = useState<string[]>([]);
  const [corrigindo, setCorrigindo] = useState(false);
  const [mensagem, setMensagem] = useState('');

  if (m === undefined) return <Tela titulo="Matriz">{null}</Tela>;
  const codigo = String(m.codigo);
  const proximas = matrizesProximas(m as MatrizResumo, todas as MatrizResumo[], parametro<number>(parametros, 'distancia_min_matrizes_m', viveiroId));

  async function registrarFenologia() {
    await repo.salvar('fenologia', { matriz_id: id, data: new Date().toISOString().slice(0, 10), fases, viveiro_id: m!.viveiro_id });
    setFases([]);
    setMensagem('Fenologia registrada.');
  }

  if (escolhendoSugerida) {
    return (
      <Tela titulo={`Espécie de ${codigo}`}>
        <p className="dica">Escolha a espécie que o Google Lens sugeriu (confira na ficha). Ela fica como “provável” até alguém confirmar.</p>
        <EscolherEspecie
          aoEscolher={async (especieId) => {
            await repo.salvar('matriz', { especie_id: especieId, grau_certeza: 'provavel', metodo_identificacao: 'foto_lens' }, id);
            setEscolhendoSugerida(false);
            setMensagem('Espécie sugerida registrada como provável.');
          }}
        />
        <button className="botao-secundario" onClick={() => setEscolhendoSugerida(false)}>
          Cancelar
        </button>
      </Tela>
    );
  }

  if (corrigindo) {
    return (
      <Tela titulo={`Identificação de ${codigo}`}>
        <p className="dica">Escolha a espécie confirmada. A identificação fica como “certo”.</p>
        <EscolherEspecie
          aoEscolher={async (especieId) => {
            await repo.salvar('matriz', { especie_id: especieId, grau_certeza: 'certo' }, id);
            setCorrigindo(false);
            setMensagem('Identificação confirmada.');
          }}
        />
        <button className="botao-secundario" onClick={() => setCorrigindo(false)}>
          Cancelar
        </button>
      </Tela>
    );
  }

  return (
    <Tela titulo={`Matriz ${codigo}`}>
      {params.get('nova') && (
        <p className="mensagem" data-testid="matriz-salva">
          <Icone nome="certo" tamanho={20} /> Matriz {codigo} salva{naFila ? ' no aparelho. Vai para o servidor quando houver sinal.' : '.'}
        </p>
      )}
      {mensagem && <p className="mensagem">{mensagem}</p>}

      <section className="plaqueta" data-testid="plaqueta">
        <CodigoQr texto={codigo} />
        <div>
          <strong className="codigo-grande">{codigo}</strong>
          <span>{popular ? String(popular) : m.especie_id ? '' : 'Espécie a identificar'}</span>
          <small>
            <i>{String(especie?.nome_cientifico ?? '')}</i>
          </small>
          <small>CRADS · {String(viveiro?.nome ?? '')}</small>
        </div>
      </section>
      <button className="botao-secundario nao-imprimir" onClick={() => window.print()}>
        Imprimir plaqueta
      </button>

      {podeColetar(m as MatrizResumo) && pode('registrar_coleta', m.viveiro_id) && (
        <Link to={`/coleta/nova?matriz=${m.id}`} className="botao-principal nao-imprimir">
          <Icone nome="semente" /> Registrar coleta
        </Link>
      )}

      <dl className="ficha nao-imprimir">
        <dt>Identificação</dt>
        <dd>
          {ROTULO_CERTEZA[String(m.grau_certeza)]}
          {m.metodo_identificacao === 'assistente' ? ' · pelo assistente' : m.metodo_identificacao === 'foto_lens' ? ' · com ajuda do Google Lens' : ''}
        </dd>
        <dt>Local</dt>
        <dd>{typeof m.lat === 'number' ? `${m.lat.toFixed(5)}, ${(m.lon as number).toFixed(5)} (±${String(m.precisao_m ?? '?')} m)` : 'sem GPS'}</dd>
        {m.altura_m ? (
          <>
            <dt>Altura</dt>
            <dd>{String(m.altura_m)} m</dd>
          </>
        ) : null}
        {m.dap_cm ? (
          <>
            <dt>DAP</dt>
            <dd>{String(m.dap_cm)} cm</dd>
          </>
        ) : null}
        {m.descricao_local ? (
          <>
            <dt>Como chegar</dt>
            <dd>{String(m.descricao_local)}</dd>
          </>
        ) : null}
      </dl>

      {proximas.length > 0 && (
        <p className="mensagem alerta nao-imprimir">
          <Icone nome="aviso" tamanho={20} /> Perto de outra matriz da mesma espécie: {proximas.map((p) => `${p.codigo} (${p.distancia_m} m)`).join(', ')}.
        </p>
      )}

      {fotos.length > 0 && (
        <section className="cartao nao-imprimir">
          <h2>Fotos</h2>
          <div className="galeria">
            {fotos.map((f) => (
              <figure key={f.id}>
                <Miniatura fotoId={f.id} alt={rotuloParte(f.parte)} data={f} />
                <figcaption>{rotuloParte(f.parte)}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {fotos.length > 0 && m.grau_certeza !== 'certo' && pode('cadastrar_matriz', m.viveiro_id) && (
        <section className="cartao nao-imprimir" data-testid="ajuda-lens">
          <h2>Ajuda para identificar</h2>
          <BotaoLens
            nome={`${codigo}.jpg`}
            obterFoto={async () => {
              const ordem = ['arvore', 'folha', 'flor', 'fruto', 'tronco', 'casca'];
              const posicao = (f: Record<string, unknown>) => (ordem.includes(String(f.parte)) ? ordem.indexOf(String(f.parte)) : 99);
              const melhor = [...fotos].sort((a, b) => posicao(a) - posicao(b))[0];
              const local = await db._miniaturas.get(melhor.id);
              return local?.blob ?? (await fotoGuardadaOuBaixada(db, sessao, melhor.id));
            }}
          />
          <button className="botao-secundario" onClick={() => setEscolhendoSugerida(true)}>
            Escolher a espécie sugerida
          </button>
        </section>
      )}

      <section className="cartao nao-imprimir">
        <h2>O que a árvore tem hoje?</h2>
        <div className="meses">
          {FENOFASES.map((f) => (
            <button key={f} type="button" className={`chip ${fases.includes(f) ? 'ativo' : ''}`} onClick={() => setFases(fases.includes(f) ? fases.filter((x) => x !== f) : [...fases, f])}>
              {ROTULO_FASE[f]}
            </button>
          ))}
        </div>
        <button className="botao-principal" disabled={!fases.length} onClick={() => void registrarFenologia()}>
          Registrar visita
        </button>
        {fenologia.length > 0 && (
          <ul className="historico">
            {fenologia.slice(0, 6).map((f) => (
              <li key={f.id}>
                {new Date(String(f.data) + 'T12:00').toLocaleDateString('pt-BR')}: {(f.fases as string[]).map((x) => ROTULO_FASE[x]).join(', ')}
              </li>
            ))}
          </ul>
        )}
      </section>

      {gestor && (
        <section className="cartao nao-imprimir">
          <h2>Espécie</h2>
          <button className="botao-secundario" onClick={() => setCorrigindo(true)}>
            {m.especie_id ? 'Confirmar ou corrigir a espécie' : 'Identificar a espécie'}
          </button>
        </section>
      )}
      <EditarRegistro
        colecao="matriz"
        registro={m}
        rotulo="Editar a matriz"
        podeEditar={!!sessao && (sessao.gestorGeral || pode('cadastrar_matriz', m.viveiro_id) || m.criado_por === sessao.id)}
        campos={[
          { nome: 'especie_id', rotulo: 'Espécie', tipo: 'especie' },
          { nome: 'grau_certeza', rotulo: 'Certeza da espécie', tipo: 'opcao', opcoes: Object.entries(ROTULO_CERTEZA).map(([valor, rotulo]) => ({ valor, rotulo })) },
          { nome: 'situacao', rotulo: 'Situação da árvore', tipo: 'opcao', opcoes: [{ valor: 'ativa', rotulo: 'Viva (ativa)' }, { valor: 'inativa', rotulo: 'Inativa (não coletar)' }, { valor: 'morta', rotulo: 'Morta' }] },
          { nome: 'gps', rotulo: 'Local (GPS)', tipo: 'gps' },
          { nome: 'descricao_local', rotulo: 'Como chegar / referência do local', tipo: 'textoLongo' },
          { nome: 'tipo_local', rotulo: 'Tipo de local', tipo: 'opcao', opcoes: TIPOS_LOCAL },
          { nome: 'altura_m', rotulo: 'Altura (m)', tipo: 'numero' },
          { nome: 'dap_cm', rotulo: 'DAP (cm)', tipo: 'numero' },
          { nome: 'cap_cm', rotulo: 'CAP (cm)', tipo: 'numero' },
          { nome: 'estado_fitossanitario', rotulo: 'Saúde da árvore', tipo: 'opcao', opcoes: ESTADOS },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textoLongo' },
        ]}
      />
      <BotaoExcluir colecao="matriz" registro={m} voltarPara="/matrizes" />
    </Tela>
  );
}
