/**
 * Protege as telas que não são do perfil da pessoa (mesmo digitando o
 * endereço): mostra um aviso em vez da tela. O servidor também recusa.
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../contexto';
import { Icone } from './Icone';
import { Tela } from './Tela';

type Pode = (chave: string) => boolean;

/** null = pode abrir; texto = por que não pode. */
export function bloqueioDaRota(caminho: string, equipe: boolean, administrador: boolean, pode: Pode): string | null {
  const algum = (...chaves: string[]) => chaves.some((c) => pode(c));
  const comeca = (...prefixos: string[]) => prefixos.some((p) => caminho === p || caminho.startsWith(p + '/'));
  if (administrador) return null;
  if (comeca('/relatorios/rastreio')) return equipe ? null : 'Esta parte é da equipe do viveiro.';
  if (comeca('/relatorios')) return algum('relatorios') ? null : 'Os relatórios são do gestor.';
  if (comeca('/viveiros', '/municipios')) return algum('viveiros') ? null : 'Só o gestor cadastra viveiros e municípios.';
  if (comeca('/equipe')) return algum('equipe') ? null : 'Só o gestor cuida da equipe.';
  if (comeca('/lixeira')) return 'Só o administrador usa a lixeira.';
  if (comeca('/viveiro/semeadura')) return algum('producao') ? null : 'Você não tem permissão para semear.';
  if (comeca('/viveiro/inventario')) return algum('inventario') ? null : 'Você não tem permissão para fazer inventário.';
  if (comeca('/viveiro/estoque-inicial')) return algum('estoque_inicial') ? null : 'Você não tem permissão para cadastrar o estoque inicial.';
  if (comeca('/coleta/lotes/novo', '/coleta/lotes/sementes-iniciais')) return algum('lotes_sementes') ? null : 'Você não tem permissão para formar lotes de sementes.';
  if (comeca('/coleta/nova')) return algum('registrar_coleta') ? null : 'Você não tem permissão para registrar coletas.';
  if (comeca('/matrizes/nova')) return algum('cadastrar_matriz') ? null : 'Você não tem permissão para cadastrar matrizes.';
  if (comeca('/matrizes', '/coleta', '/viveiro', '/ler-qr', '/identificar', '/especies') && !caminho.startsWith('/viveiro-atual')) {
    return equipe ? null : 'Esta parte é da equipe do viveiro (coletores, viveiristas e gestores).';
  }
  return null;
}

export function Guarda({ children }: { children: ReactNode }) {
  const { sessao, pode } = useApp();
  const { pathname } = useLocation();
  const equipe = !!sessao && (sessao.gestorGeral || Object.values(sessao.perfisPorViveiro ?? {}).some((ps) => ps.length > 0));
  const motivo = bloqueioDaRota(pathname, equipe, !!sessao?.gestorGeral, (c) => pode(c, null));
  if (!motivo) return <>{children}</>;
  return (
    <Tela titulo="Sem acesso">
      <div className="vazio" data-testid="sem-acesso">
        <Icone nome="cadeado" tamanho={64} />
        <p>{motivo}</p>
        <Link to="/" className="botao-principal">
          Voltar ao início
        </Link>
      </div>
    </Tela>
  );
}
