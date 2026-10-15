/**
 * Retirada das mudas no viveiro (funciona sem internet): confere as
 * quantidades, quem recebeu, assinatura na tela e termo de doação em PDF.
 * Baixa o estoque pelos lotes reservados.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { bloqueioRetirada, planejarRetirada } from '@crads/dominio';
import { Assinatura } from '../../componentes/Assinatura';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { doacoesNoPrograma, itensDoPedido } from './dados';
import { abrirPdf, termoDoacao } from './pdf';

export function Retirada() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { db, repo, sessao } = useApp();
  const doacao = useLiveQuery(() => db.colecao('doacao').get(id!), [id]);
  const itens = useLiveQuery(() => itensDoPedido(db, id!), [id]) ?? [];
  const reservas = useLiveQuery(async () => {
    const ids = new Set(itens.map((i) => i.id));
    return (await db.colecao('reserva').toArray()).filter((r) => !r.excluido && ids.has(String(r.doacao_item_id)));
  }, [itens.length]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const pessoa = useLiveQuery(() => (doacao ? db.colecao('pessoa').get(String(doacao.solicitante_pessoa_id)) : undefined), [doacao?.solicitante_pessoa_id]);
  const viveiro = useLiveQuery(() => (doacao ? db.colecao('viveiro').get(String(doacao.viveiro_id)) : undefined), [doacao?.viveiro_id]);
  const instalacao = useLiveQuery(async () => (await db.colecao('instalacao').toArray())[0], [db]);
  const [entregas, setEntregas] = useState<Record<string, string>>({});
  const [recebedor, setRecebedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!doacao) return <Tela titulo="Retirada">{null}</Tela>;
  const bloqueio = bloqueioRetirada({ situacao: doacao.situacao, retirar_ate: doacao.retirar_ate }, new Date().toISOString());
  const reservado = (itemId: string) => reservas.filter((r) => r.doacao_item_id === itemId && r.situacao === 'ativa').reduce((s, r) => s + Number(r.quantidade), 0);
  const qtd = (itemId: string) => Number(entregas[itemId] ?? reservado(itemId));

  async function salvar() {
    setErro('');
    if (!recebedor.trim()) return setErro('Informe o nome de quem está recebendo.');
    if (!assinatura) return setErro('Peça para assinar na tela.');
    const plano = planejarRetirada(reservas as never, Object.fromEntries(itens.map((i) => [i.id, qtd(i.id)])));
    if ('erro' in plano) return setErro(plano.erro);
    setSalvando(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const base = { viveiro_id: doacao!.viveiro_id };
    for (const c of plano.consumos) {
      await repo.salvar('doacao_item_lote', { ...base, doacao_item_id: c.doacao_item_id, lote_mudas_id: c.lote_mudas_id, quantidade: c.quantidade });
      await repo.salvar('movimento_estoque_mudas', { ...base, lote_mudas_id: c.lote_mudas_id, tipo: 'saida_doacao', quantidade: c.quantidade, data: hoje, referencia: String(doacao!.codigo) });
      await repo.salvar('reserva', { situacao: 'consumida' }, c.reserva_id);
    }
    for (const r of plano.liberar) await repo.salvar('reserva', { situacao: 'cancelada' }, r);
    for (const i of itens) await repo.salvar('doacao_item', { qtd_entregue: qtd(i.id) }, i.id);
    let recebedorPessoa: string | null = null;
    if (documento.trim()) {
      const p = await repo.salvar('pessoa', { nome: recebedor.trim(), tipo: 'fisica' });
      await repo.salvar('dados_pessoais', { pessoa_id: p.id, documento: documento.trim() });
      recebedorPessoa = p.id;
    }
    const ret = await repo.salvar('retirada', { ...base, doacao_id: id, data: hoje, recebedor_nome: recebedor.trim(), recebedor_pessoa_id: recebedorPessoa, entregue_por: sessao?.id ?? null });
    const programa = (await doacoesNoPrograma(db)).has(doacao!.id);
    const termo = await termoDoacao({
      orgao: String(instalacao?.nome_orgao ?? 'Secretaria do Meio Ambiente e Recursos Hídricos do Tocantins'),
      codigo: String(doacao!.codigo),
      viveiro: String(viveiro?.nome ?? ''),
      solicitante: String(pessoa?.nome ?? ''),
      instituicao: String(doacao!.instituicao ?? ''),
      finalidade: String(doacao!.finalidade ?? ''),
      local: String(doacao!.local_plantio ?? ''),
      area_ha: (doacao!.area_ha as number) || null,
      data: new Date().toLocaleDateString('pt-BR'),
      programa: programa ? 'Plantando Água' : undefined,
      textoTermo: instalacao?.texto_termo_doacao ? String(instalacao.texto_termo_doacao) : undefined,
      itens: itens.map((i) => ({ especie: nomes?.get(String(i.especie_id)) ?? '', pedida: Number(i.qtd_pedida), aprovada: Number(i.qtd_aprovada ?? 0), entregue: qtd(i.id) })),
      recebedor: recebedor.trim(),
      assinatura,
      entreguePor: sessao?.nome,
    });
    await repo.anexarArquivo('retirada', ret.id, 'assinatura', assinatura, 'assinatura.png');
    await repo.anexarArquivo('retirada', ret.id, 'termo_pdf', termo, `termo-${String(doacao!.codigo)}.pdf`);
    await repo.salvar('doacao', { situacao: 'retirada' }, id);
    abrirPdf(termo, `termo-${String(doacao!.codigo)}.pdf`);
    navegar(`/doacao/${id}?retirado=1`, { replace: true });
  }

  if (bloqueio) {
    return (
      <Tela titulo="Retirada">
        <p className="mensagem alerta">{bloqueio}</p>
        <Link to={`/doacao/${id}`} className="botao-secundario">
          <Icone nome="voltar" /> Voltar ao pedido
        </Link>
      </Tela>
    );
  }

  return (
    <Tela titulo={`Retirada ${String(doacao.codigo)}`}>
      <section className="cartao formulario">
        <h2>Mudas entregues</h2>
        {itens.map((i) => (
          <label key={i.id}>
            {nomes?.get(String(i.especie_id)) ?? ''} · reservadas {reservado(i.id)}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={reservado(i.id)}
              step="1"
              aria-label={`Entregues de ${nomes?.get(String(i.especie_id)) ?? ''}`}
              value={entregas[i.id] ?? String(reservado(i.id))}
              onChange={(e) => setEntregas({ ...entregas, [i.id]: e.target.value })}
            />
          </label>
        ))}
      </section>
      <section className="cartao formulario">
        <h2>Quem recebeu</h2>
        <label>
          Nome
          <input value={recebedor} onChange={(e) => setRecebedor(e.target.value)} />
        </label>
        <label>
          Documento (RG ou CPF, opcional)
          <input inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </label>
        <p className="dica">O documento só é visto pelo gestor.</p>
        <Assinatura aoMudar={setAssinatura} />
      </section>
      {erro && <p className="erro">{erro}</p>}
      <button className="botao-principal" disabled={salvando} onClick={() => void salvar()}>
        <Icone nome="certo" /> Confirmar: as mudas saíram do viveiro
      </button>
    </Tela>
  );
}
