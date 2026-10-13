/**
 * Excluir um cadastro preenchido errado, direto na ficha. Vai para a lixeira
 * (o administrador pode restaurar ou apagar de vez). Aparece para o
 * administrador e para quem fez o cadastro. Não exclui se houver algo ativo
 * ligado a ele (ex.: lote com mudas reservadas para uma doação).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dependentesAtivos, mensagemDependentes, referenciasPara, rotuloRegistro, type Registro } from '@crads/dominio';
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

export function BotaoExcluir({ colecao, registro, voltarPara }: { colecao: string; registro: Registro; voltarPara: string }) {
  const { db, repo, sessao } = useApp();
  const navegar = useNavigate();
  const [erro, setErro] = useState('');
  if (!sessao || !(sessao.gestorGeral || registro.criado_por === sessao.id || registro.versao === 0)) return null;

  async function excluir() {
    setErro('');
    const rotulo = rotuloRegistro(colecao, registro);
    // O que está ligado a este cadastro (no aparelho) e ainda ativo?
    const bloqueio = await bloqueioExclusao(db, colecao, registro.id);
    if (bloqueio) return setErro(bloqueio);
    if (!confirm(`Excluir ${rotulo}? Ele vai para a lixeira.`)) return;
    try {
      await repo.excluir(colecao, registro.id);
      navegar(voltarPara, { replace: true });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="nao-imprimir">
      <button className="botao-secundario perigo" onClick={() => void excluir()}>
        <Icone nome="lixo" /> Excluir (preenchido errado)
      </button>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
