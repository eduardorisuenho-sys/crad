/** Ficha da matriz: plaqueta com QR, fotos, fenologia e validação do gestor. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { bloqueioAprovacao, FENOFASES, matrizesProximas, parametro, podeColetar, type MatrizResumo } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { EscolherEspecie } from '../especies/EscolherEspecie';
import { ROTULO_CERTEZA, ROTULO_VALIDACAO } from './ListaMatrizes';

const ROTULO_FASE: Record<string, string> = { folha: 'Só folhas', flor: 'Flor', fruto_verde: 'Fruto verde', fruto_maduro: 'Fruto maduro', sem_folha: 'Sem folhas' };

export function DetalheMatriz() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo, pode, viveiroId } = useApp();
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
  const bloqueio = bloqueioAprovacao(m as MatrizResumo);

  async function registrarFenologia() {
    await repo.salvar('fenologia', { matriz_id: id, data: new Date().toISOString().slice(0, 10), fases, viveiro_id: m!.viveiro_id });
    setFases([]);
    setMensagem('Fenologia registrada.');
  }

  async function validar(situacao: 'aprovada' | 'reprovada') {
    let nota = '';
    if (situacao === 'reprovada') {
      nota = prompt('Por que a matriz foi reprovada?') ?? '';
      if (!nota.trim()) return;
    }
    await repo.salvar('matriz', { situacao_validacao: situacao, validado_em: new Date().toISOString(), nota_validacao: nota || null }, id);
    setMensagem(situacao === 'aprovada' ? 'Matriz aprovada: já pode ser usada para coleta.' : 'Matriz reprovada.');
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

      {podeColetar(m as MatrizResumo) && (
        <Link to={`/coleta/nova?matriz=${m.id}`} className="botao-principal nao-imprimir">
          <Icone nome="semente" /> Registrar coleta
        </Link>
      )}

      <dl className="ficha nao-imprimir">
        <dt>Identificação</dt>
        <dd>
          {ROTULO_CERTEZA[String(m.grau_certeza)]}
          {m.metodo_identificacao === 'assistente' ? ' · pelo assistente' : ''}
        </dd>
        <dt>Validação</dt>
        <dd>
          {ROTULO_VALIDACAO[String(m.situacao_validacao ?? 'pendente')]}
          {m.nota_validacao ? ` · ${String(m.nota_validacao)}` : ''}
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
                <Miniatura fotoId={f.id} alt={String(f.parte)} />
                <figcaption>{String(f.parte)}</figcaption>
              </figure>
            ))}
          </div>
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
          <h2>Validação do gestor</h2>
          <button className="botao-secundario" onClick={() => setCorrigindo(true)}>
            {m.especie_id ? 'Confirmar ou corrigir a espécie' : 'Identificar a espécie'}
          </button>
          {bloqueio && <p className="dica">{bloqueio}</p>}
          <div className="acoes">
            <button className="botao-secundario" onClick={() => void validar('reprovada')}>
              Reprovar
            </button>
            <button className="botao-principal" disabled={!!bloqueio || m.situacao_validacao === 'aprovada'} onClick={() => void validar('aprovada')}>
              <Icone nome="certo" /> Aprovar
            </button>
          </div>
        </section>
      )}
    </Tela>
  );
}
