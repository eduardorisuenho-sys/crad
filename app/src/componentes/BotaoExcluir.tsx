/**
 * Excluir um cadastro preenchido errado, direto na ficha. Vai para a lixeira
 * (o administrador pode restaurar ou apagar de vez). Aparece para o
 * administrador e para quem fez o cadastro. Não exclui se houver algo ativo
 * ligado a ele (ex.: lote com mudas reservadas para uma doação).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colecao as buscarColecao, dependentesAtivos, mensagemDependentes, planoExclusao, podeEscrever, referenciasPara, resumoExclusao, rotuloRegistro, type PlanoExclusao, type Registro } from '@crads/dominio';
import { useApp } from '../contexto';
import type { BancoCrads } from '../dados/db';
import { Icone } from './Icone';

/** Motivo para não excluir (algo ativo ligado no aparelho), ou null. */
export async function bloqueioExclusao(db: BancoCrads, colecao: string, id: string): Promise<string | null> {
  const ligados: Record<string, Registro[]> = {};
  for (const nome of new Set(referenciasPara(colecao).map((r) => r.colecao.nome))) ligados[nome] = await db.colecao(nome).toArray();
  const deps = dependentesAtivos(colecao, id, (c, campo, valor) => (ligados[c] ?? []).filter((r) => r[campo] === valor));
  return deps.length ? mensagemDependentes(deps) : null;
}

/** O que vai para a lixeira com o registro (coletas, lotes, mudas que vieram dele) e o que impede. */
export async function planoNoAparelho(db: BancoCrads, colecao: string, id: string): Promise<PlanoExclusao> {
  const nomes = new Set([colecao, 'coleta', 'lote_sementes_coleta', 'lote_sementes', 'lote_mudas', 'sugestao_identificacao']);
  for (const n of [...nomes]) for (const r of referenciasPara(n)) nomes.add(r.colecao.nome);
  const dados: Record<string, Registro[]> = {};
  for (const n of nomes) dados[n] = await db.colecao(n).toArray();
  return planoExclusao(
    colecao,
    id,
    (c, campo, valor) => (dados[c] ?? []).filter((r) => r[campo] === valor),
    (c, i) => (dados[c] ?? []).find((r) => r.id === i),
  );
}

export function BotaoExcluir({ colecao, registro, voltarPara }: { colecao: string; registro: Registro; voltarPara: string }) {
  const { db, repo, sessao, matriz } = useApp();
  const navegar = useNavigate();
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  if (!sessao || !(sessao.gestorGeral || registro.criado_por === sessao.id || registro.versao === 0)) return null;

  async function excluir() {
    setErro('');
    const rotulo = rotuloRegistro(colecao, registro);
    // O que veio deste cadastro vai junto (coleta, lote, mudas); o que não pode sumir sem aviso impede.
    const plano = await planoNoAparelho(db, colecao, registro.id);
    if (plano.bloqueios.length) return setErro(mensagemDependentes(plano.bloqueios));
    const ctx = { ...sessao!, permissoes: matriz };
    const semPermissao = plano.apagar.filter((a) => a.id !== registro.id).find((a) => !podeEscrever(ctx, buscarColecao(a.colecao), { id: a.id, viveiro_id: a.viveiro_id }));
    if (semPermissao) return setErro(`Para excluir junto ${semPermissao.rotulo}, peça ao gestor ou ao administrador.`);
    const junto = resumoExclusao(plano, colecao, registro.id);
    const pergunta = junto
      ? `Excluir ${rotulo} e o que foi feito a partir dele?\n\nVai junto: ${junto}.\n\nTudo vai para a lixeira; o administrador pode restaurar.`
      : `Excluir ${rotulo}? Ele vai para a lixeira.`;
    if (!confirm(pergunta)) return;
    setExcluindo(true);
    try {
      for (const a of plano.apagar) await repo.excluir(a.colecao, a.id);
      navegar(voltarPara, { replace: true });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="nao-imprimir">
      <button className="botao-secundario perigo" onClick={() => void excluir()} disabled={excluindo}>
        <Icone nome="lixo" /> {excluindo ? 'Excluindo…' : 'Excluir (preenchido errado)'}
      </button>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
