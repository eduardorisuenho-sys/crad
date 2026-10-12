/** Relatório de serviço do coletor: comprova o trabalho no período (matrizes com fotos, coletas, flor e fruto). */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { servicoColetor } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { lerEquipe } from '../equipe/api';
import { fotoGuardadaOuBaixada } from '../../dados/arquivos';
import { baixar } from '../relatorios/dados';
import { nomesEspecies } from './dados';
import { pdfServicoColetor } from './pdfServico';

type Periodo = 'mes' | 'anterior' | 'ano' | 'outro';
const hoje = () => new Date().toISOString().slice(0, 10);
function datas(p: Periodo): [string, string] {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (p === 'mes') return [iso(new Date(Date.UTC(ano, mes, 1))), iso(new Date(Date.UTC(ano, mes + 1, 0)))];
  if (p === 'anterior') return [iso(new Date(Date.UTC(ano, mes - 1, 1))), iso(new Date(Date.UTC(ano, mes, 0)))];
  return [`${ano}-01-01`, `${ano}-12-31`];
}
const ROTULO: Record<Periodo, string> = { mes: 'Este mês', anterior: 'Mês passado', ano: 'Este ano', outro: 'Outras datas' };

export function RelatorioServico() {
  const { db, sessao, perfis, viveiroId, online } = useApp();
  const gestor = !!sessao?.gestorGeral || perfis.includes('gestor');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [inicio, setInicio] = useState(datas('mes')[0]);
  const [fim, setFim] = useState(datas('mes')[1]);
  const [coletorId, setColetorId] = useState(sessao?.id ?? '');
  const [nomesPessoas, setNomesPessoas] = useState<Map<string, string>>(new Map());
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (periodo !== 'outro') {
      const [a, b] = datas(periodo);
      setInicio(a);
      setFim(b);
    }
  }, [periodo]);

  // O gestor escolhe o coletor; os nomes vêm da equipe (com internet).
  useEffect(() => {
    if (!gestor || !sessao || !online) return;
    lerEquipe(sessao)
      .then((e) => setNomesPessoas(new Map(e.pessoas.map((p) => [p.usuario_id, p.nome || p.email]))))
      .catch(() => undefined);
  }, [gestor, sessao, online]);

  const dados = useLiveQuery(async () => {
    const [matrizes, coletas, fenologias, fotos, municipios, viveiro] = await Promise.all([
      db.colecao('matriz').toArray(),
      db.colecao('coleta').toArray(),
      db.colecao('fenologia').toArray(),
      db.colecao('foto').toArray(),
      db.colecao('municipio').toArray(),
      viveiroId ? db.colecao('viveiro').get(viveiroId) : undefined,
    ]);
    return { matrizes, coletas, fenologias, fotos, municipios, viveiro };
  }, [db, viveiroId]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);

  const pessoas = useMemo(() => {
    const ids = new Set<string>();
    for (const m of dados?.matrizes ?? []) if (m.coletor_id || m.criado_por) ids.add(String(m.coletor_id || m.criado_por));
    for (const c of dados?.coletas ?? []) if (c.coletor_id || c.criado_por) ids.add(String(c.coletor_id || c.criado_por));
    if (sessao) ids.add(sessao.id);
    return [...ids].map((id) => ({ id, nome: id === sessao?.id ? sessao.nome : nomesPessoas.get(id) ?? `Pessoa ${id.slice(0, 5)}` })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [dados, sessao, nomesPessoas]);

  const servico = useMemo(
    () => (dados && coletorId ? servicoColetor({ matrizes: dados.matrizes, coletas: dados.coletas, fenologias: dados.fenologias, fotos: dados.fotos }, { coletorId, inicio, fim, viveiroId }) : null),
    [dados, coletorId, inicio, fim, viveiroId],
  );
  const nomeColetor = pessoas.find((p) => p.id === coletorId)?.nome ?? '';
  const periodoTexto = `${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`;

  async function gerarPdf() {
    if (!servico || !dados) return;
    setGerando(true);
    try {
      const especie = (id: unknown) => (id ? nomes?.get(String(id)) ?? '' : '');
      const muni = new Map(dados.municipios.map((m) => [m.id, String(m.nome)]));
      const porId = new Map(dados.matrizes.map((m) => [m.id, m]));
      const blob = await pdfServicoColetor({
        orgao: 'Secretaria de Meio Ambiente e Recursos Hídricos do Tocantins',
        coletor: nomeColetor,
        periodo: periodoTexto,
        viveiro: String(dados.viveiro?.nome ?? 'todos os viveiros'),
        servico,
        nomeEspecie: especie,
        municipio: (id) => (id ? muni.get(String(id)) ?? '' : ''),
        matriz: (id) => porId.get(String(id)),
        foto: (id) => fotoGuardadaOuBaixada(db, sessao, id),
      });
      baixar(blob, `relatorio-coletor-${nomeColetor.split(' ')[0].toLowerCase() || 'coletor'}-${inicio}-a-${fim}.pdf`);
    } finally {
      setGerando(false);
    }
  }

  const t = servico?.totais;
  return (
    <Tela titulo="Relatório de serviço">
      <p className="dica">Comprova o trabalho de campo no período: matrizes cadastradas com fotos, coletas e registros de flor e fruto.</p>
      {gestor && pessoas.length > 1 && (
        <div className="filtros" role="group" aria-label="Coletor">
          {pessoas.map((p) => (
            <button key={p.id} className={`chip ${coletorId === p.id ? 'ativo' : ''}`} onClick={() => setColetorId(p.id)}>
              {p.nome}
            </button>
          ))}
        </div>
      )}
      <div className="filtros" role="group" aria-label="Período">
        {(Object.keys(ROTULO) as Periodo[]).map((p) => (
          <button key={p} className={`chip ${periodo === p ? 'ativo' : ''}`} onClick={() => setPeriodo(p)}>
            {ROTULO[p]}
          </button>
        ))}
      </div>
      {periodo === 'outro' && (
        <div className="linha-form">
          <input type="date" aria-label="De" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
          <input type="date" aria-label="Até" value={fim} min={inicio} max={hoje()} onChange={(e) => setFim(e.target.value)} />
        </div>
      )}

      {t && (
        <>
          <p className="dica" data-testid="recorte-servico">
            {nomeColetor} · {periodoTexto}
          </p>
          <ul className="indicadores" data-testid="resumo-servico">
            <li>
              <small>Dias de campo</small>
              <strong>{t.dias_de_campo}</strong>
            </li>
            <li>
              <small>Matrizes</small>
              <strong>{t.matrizes}</strong>
              <span>{t.especies} espécies</span>
            </li>
            <li>
              <small>Coletas</small>
              <strong>{t.coletas}</strong>
              <span>{t.quilos ? `${mostrarNumero(t.quilos)} kg` : ''}</span>
            </li>
            <li>
              <small>Flor e fruto</small>
              <strong>{t.registros_flor_fruto}</strong>
            </li>
          </ul>
          <button className="botao-principal" onClick={() => void gerarPdf()} disabled={gerando}>
            <Icone nome="relatorio" /> {gerando ? 'Gerando…' : 'Baixar relatório em PDF'}
          </button>
          {servico.matrizes.length > 0 && (
            <section className="cartao">
              <h2>Matrizes</h2>
              <ul className="lista">
                {servico.matrizes.map((m) => (
                  <li key={m.id} className="item-lista">
                    {(servico.fotosPorMatriz.get(m.id) ?? [])[0] ? <Miniatura fotoId={servico.fotosPorMatriz.get(m.id)![0].id} alt="" tamanho={56} /> : <Icone nome="arvore" />}
                    <div>
                      <strong>{String(m.codigo)}</strong>
                      <small>{nomes?.get(String(m.especie_id)) ?? 'a identificar'}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Tela>
  );
}
