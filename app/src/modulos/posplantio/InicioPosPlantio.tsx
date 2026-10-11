/** Módulo 6: doações retiradas e o acompanhamento de cada plantio. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { resumoPlantio } from './dados';
import { mostrarNumero } from '../../plataforma/numero';

export function InicioPosPlantio() {
  const { db, perfis, sessao, viveiroId } = useApp();
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const linhas = useLiveQuery(async () => {
    const doacoes = (await db.colecao('doacao').toArray()).filter(
      (d) => !d.excluido && d.situacao === 'retirada' && (equipe ? !viveiroId || d.viveiro_id === viveiroId : d.solicitante_usuario_id === sessao?.id),
    );
    const plantios = (await db.colecao('plantio').toArray()).filter((p) => !p.excluido);
    const pessoas = new Map((await db.colecao('pessoa').toArray()).map((p) => [p.id, String(p.nome)]));
    const out = [];
    for (const d of doacoes) {
      const p = plantios.find((x) => x.doacao_id === d.id);
      out.push({ doacao: d, plantio: p, solicitante: pessoas.get(String(d.solicitante_pessoa_id)) ?? '', resumo: p ? await resumoPlantio(db, p.id) : null });
    }
    return out.sort((a, b) => Number(!!a.plantio) - Number(!!b.plantio) || String(b.doacao.codigo).localeCompare(String(a.doacao.codigo)));
  }, [db, viveiroId, equipe]);

  return (
    <Tela titulo="Pós-plantio">
      <p className="dica">{equipe ? 'Plantios das doações retiradas neste viveiro.' : 'Conte como foi o plantio das mudas que você recebeu.'}</p>
      <ul className="lista">
        {(linhas ?? []).map(({ doacao, plantio, solicitante, resumo }) => (
          <li key={doacao.id}>
            <Link to={plantio ? `/pos-plantio/${plantio.id}` : `/pos-plantio/novo/${doacao.id}`} className="item-lista">
              <Icone nome="plantio" />
              <div>
                <strong>{String(doacao.codigo)}</strong>
                <small>
                  {solicitante}
                  {plantio ? ` · ${resumo?.sobrevivencia.plantadas ?? 0} plantadas` : ''}
                </small>
              </div>
              {!plantio && <span className="selo">registrar plantio</span>}
              {resumo?.sobrevivencia.taxa != null && <span className="selo ok">{mostrarNumero(resumo.sobrevivencia.taxa)}% vivas</span>}
            </Link>
          </li>
        ))}
        {linhas && !linhas.length && <li className="vazio">Nenhuma doação retirada ainda.</li>}
      </ul>
    </Tela>
  );
}
