/** Módulo 7: painel do gestor com indicadores, filtros e exportações. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doacoesDoPrograma, escreverCsv, indicadores, type FiltroRelatorio } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { ROTULO_FASE } from '../viveiro/dados';
import { baixar, carregarDadosRelatorio } from './dados';
import { csvIndicadores, kml, pdfIndicadores, planilha, tabelas } from './exportacoes';
import { Barras } from './Graficos';

const PROGRAMA = 'plantandoagua01';
type Periodo = 'ano' | 'anterior' | 'tudo';

function datas(p: Periodo): Pick<FiltroRelatorio, 'inicio' | 'fim'> {
  const ano = new Date().getFullYear();
  if (p === 'ano') return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  if (p === 'anterior') return { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31` };
  return {};
}
const ROTULO_PERIODO: Record<Periodo, string> = { ano: 'Este ano', anterior: 'Ano passado', tudo: 'Tudo' };

export function PainelRelatorios() {
  const { db } = useApp();
  const dados = useLiveQuery(() => carregarDadosRelatorio(db), [db]);
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [viveiro, setViveiro] = useState('');
  const [soPrograma, setSoPrograma] = useState(false);
  const [gerando, setGerando] = useState('');

  const filtro: FiltroRelatorio = { ...datas(periodo), viveiros: viveiro ? [viveiro] : null, programaId: soPrograma ? PROGRAMA : undefined };
  const r = useMemo(() => (dados ? indicadores(dados, filtro) : null), [dados, periodo, viveiro, soPrograma]); // eslint-disable-line react-hooks/exhaustive-deps
  const porViveiro = useMemo(
    () => (dados && !viveiro ? dados.viveiros.map((v) => ({ v, r: indicadores(dados, { ...filtro, viveiros: [v.id] }) })) : []),
    [dados, periodo, viveiro, soPrograma], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!dados || !r) return <Tela titulo="Relatórios"><p className="vazio">Calculando…</p></Tela>;

  const nomeViveiro = viveiro ? String(dados.viveiros.find((v) => v.id === viveiro)?.nome ?? '') : 'Todos os viveiros';
  const recorte = `${ROTULO_PERIODO[periodo]} · ${nomeViveiro}${soPrograma ? ' · Plantando Água' : ''}`;
  const programa = soPrograma ? doacoesDoPrograma(dados.historicoProgramas, PROGRAMA) : undefined;
  const sufixo = `${periodo}${viveiro ? '-' + viveiro : ''}${soPrograma ? '-plantando-agua' : ''}`;

  async function exportar(tipo: 'pdf' | 'xlsx' | 'csv' | 'kml') {
    setGerando(tipo);
    try {
      if (tipo === 'pdf') baixar(await pdfIndicadores('Relatório do CRAD', recorte, r!, 'Secretaria de Meio Ambiente e Recursos Hídricos do Tocantins'), `crad-relatorio-${sufixo}.pdf`);
      if (tipo === 'xlsx') baixar(planilha(dados!, filtro, r!, programa), `crad-relatorio-${sufixo}.xlsx`);
      if (tipo === 'csv') {
        const [, , , doacoes] = tabelas(dados!, filtro, programa);
        baixar(csvIndicadores(r!), `crad-indicadores-${sufixo}.csv`);
        baixar(new Blob([escreverCsv(doacoes.linhas)], { type: 'text/csv;charset=utf-8' }), `crad-doacoes-${sufixo}.csv`);
      }
      if (tipo === 'kml') baixar(new Blob([kml(dados!, filtro, programa)], { type: 'application/vnd.google-earth.kml+xml' }), `crad-mapa-${sufixo}.kml`);
    } finally {
      setGerando('');
    }
  }

  const cartoes: [string, string | number, string?][] = [
    ['Matrizes', r.matrizes.total, `${r.matrizes.ativas} ativas · ${r.matrizes.especies} espécies`],
    ['Coletas', r.coletas.total, `${mostrarNumero(r.coletas.kg)} kg`],
    ['Sementes em estoque', `${mostrarNumero(Math.round(r.sementes.estoque_g) / 1000)} kg`, `${r.sementes.lotes} lotes`],
    ['Mudas prontas', r.mudas.prontas, `germinação ${r.mudas.taxa_germinacao == null ? '—' : mostrarNumero(r.mudas.taxa_germinacao) + '%'}${r.mudas.estoque_inicial ? ` · ${r.mudas.estoque_inicial} do estoque inicial` : ''}`],
    ['Mudas doadas', r.doacoes.mudas_entregues, `${r.doacoes.pedidos} pedidos · ${r.doacoes.em_analise} em análise`],
    ['Plantando Água', r.doacoes.programa, 'doações marcadas'],
    ['Mudas plantadas', r.plantio.plantadas, `${r.plantio.plantios} plantios`],
    ['Sobrevivência', r.plantio.sobrevivencia == null ? '—' : `${mostrarNumero(r.plantio.sobrevivencia)}%`, 'pelo último acompanhamento'],
  ];

  return (
    <Tela titulo="Relatórios">
      <div className="filtros" role="group" aria-label="Período">
        {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => (
          <button key={p} className={`chip ${periodo === p ? 'ativo' : ''}`} onClick={() => setPeriodo(p)}>
            {ROTULO_PERIODO[p]}
          </button>
        ))}
      </div>
      {dados.viveiros.length > 1 && (
        <div className="filtros" role="group" aria-label="Viveiro">
          <button className={`chip ${!viveiro ? 'ativo' : ''}`} onClick={() => setViveiro('')}>
            Todos somados
          </button>
          {dados.viveiros.map((v) => (
            <button key={v.id} className={`chip ${viveiro === v.id ? 'ativo' : ''}`} onClick={() => setViveiro(v.id)}>
              {String(v.nome)}
            </button>
          ))}
        </div>
      )}
      <button className={`botao-programa ${soPrograma ? 'ativo' : ''}`} onClick={() => setSoPrograma(!soPrograma)} aria-pressed={soPrograma}>
        <Icone nome="plantio" tamanho={32} />
        <span>
          <strong>Só Plantando Água</strong>
          <small>{soPrograma ? 'Mostrando só as doações do programa' : 'Toque para ver só o programa'}</small>
        </span>
      </button>

      <p className="dica" data-testid="recorte">{recorte}</p>
      <ul className="indicadores" data-testid="indicadores">
        {cartoes.map(([rotulo, valor, detalhe]) => (
          <li key={rotulo}>
            <small>{rotulo}</small>
            <strong>{valor}</strong>
            {detalhe && <span>{detalhe}</span>}
          </li>
        ))}
      </ul>

      <section className="cartao">
        <Barras titulo="Mudas no viveiro, por fase (agora)" itens={Object.keys(ROTULO_FASE).filter((f) => r.mudas.por_fase[f]).map((f) => ({ rotulo: ROTULO_FASE[f], valor: r.mudas.por_fase[f] }))} />
      </section>

      {porViveiro.length > 1 && (
        <section className="cartao">
          <h2>Por viveiro</h2>
          <div className="rolagem">
            <table className="tabela" data-testid="por-viveiro">
              <thead>
                <tr>
                  <th>Viveiro</th>
                  <th>Matrizes</th>
                  <th>Prontas</th>
                  <th>Doadas</th>
                  <th>Plantadas</th>
                </tr>
              </thead>
              <tbody>
                {porViveiro.map(({ v, r: x }) => (
                  <tr key={v.id}>
                    <td>{String(v.nome)}</td>
                    <td>{x.matrizes.total}</td>
                    <td>{x.mudas.prontas}</td>
                    <td>{x.doacoes.mudas_entregues}</td>
                    <td>{x.plantio.plantadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cartao">
        <h2>Baixar</h2>
        <p className="dica">Os arquivos são feitos no aparelho, com os dados já sincronizados. CPF e telefone não saem nos arquivos.</p>
        <div className="acoes">
          {(['pdf', 'xlsx', 'csv', 'kml'] as const).map((t) => (
            <button key={t} className="botao-secundario" onClick={() => void exportar(t)} disabled={!!gerando}>
              {gerando === t ? 'Gerando…' : { pdf: 'PDF', xlsx: 'Planilha', csv: 'CSV', kml: 'Mapa (KML)' }[t]}
            </button>
          ))}
        </div>
      </section>

      <div className="lista-grande">
        <Link to="/relatorios/rastreio" className="botao-grande">
          <Icone nome="lupa" /> Rastrear um código
        </Link>
        <Link to="/transparencia" className="botao-grande">
          <Icone nome="compartilhar" /> Ver o portal público
        </Link>
      </div>
    </Tela>
  );
}
