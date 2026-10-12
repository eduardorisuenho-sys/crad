import { Link } from 'react-router-dom';
import type { Perfil } from '@crads/dominio';
import { useLiveQuery } from 'dexie-react-hooks';
import { BotaoInstalar } from '../componentes/BotaoInstalar';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';

interface Bloco {
  rota: string;
  rotulo: string;
  icone: string;
  /** perfis que sempre veem o bloco */
  perfis: Perfil[] | 'todos';
  /** ou: quem tem alguma destas permissões (tabela de permissões) */
  permissoes?: string[];
}

// Os sete módulos, na ordem do caminho da muda.
export const BLOCOS: Bloco[] = [
  { rota: '/matrizes', rotulo: 'Matrizes', icone: 'arvore', perfis: ['coletor', 'gestor'], permissoes: ['cadastrar_matriz', 'validar_matriz'] },
  { rota: '/coleta', rotulo: 'Coleta e sementes', icone: 'semente', perfis: ['coletor', 'viveirista', 'gestor'] },
  { rota: '/viveiro', rotulo: 'Viveiro', icone: 'muda', perfis: ['viveirista', 'gestor'], permissoes: ['producao', 'inventario'] },
  { rota: '/catalogo', rotulo: 'Catálogo', icone: 'catalogo', perfis: 'todos' },
  { rota: '/doacao', rotulo: 'Doação de mudas', icone: 'doacao', perfis: ['viveirista', 'gestor', 'solicitante'], permissoes: ['pedir_mudas', 'aprovar_doacao', 'retirada'] },
  { rota: '/pos-plantio', rotulo: 'Pós-plantio', icone: 'plantio', perfis: 'todos' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'relatorio', perfis: [], permissoes: ['relatorios'] },
  { rota: '/identificar', rotulo: 'Identificar árvore', icone: 'lupa', perfis: ['coletor', 'viveirista', 'gestor'] },
  { rota: '/especies', rotulo: 'Espécies', icone: 'catalogo', perfis: ['coletor', 'viveirista', 'gestor'] },
  { rota: '/viveiros', rotulo: 'Viveiros', icone: 'viveiro', perfis: [], permissoes: ['viveiros'] },
  { rota: '/equipe', rotulo: 'Equipe', icone: 'pessoas', perfis: [], permissoes: ['equipe'] },
];

export function Inicio() {
  const { sessao, perfis, viveiroId, db, pode, sincronizar, estadoSync } = useApp();
  const viveiro = useLiveQuery(() => (viveiroId ? db.colecao('viveiro').get(viveiroId) : undefined), [viveiroId]);
  const visiveis = BLOCOS.filter((b) => b.perfis === 'todos' || b.perfis.some((p) => perfis.includes(p)) || (b.permissoes ?? []).some((k) => pode(k)));
  // Conta nova de coletor/viveirista: ainda sem viveiro, aguardando o gestor.
  const semAcesso = !!sessao && !sessao.gestorGeral && !sessao.solicitante && !Object.keys(sessao.perfisPorViveiro ?? {}).length;
  const pedido = sessao?.pedidos_acesso?.[0];

  return (
    <Tela titulo={`Olá, ${sessao?.nome?.split(' ')[0] || 'bem-vindo'}`} voltar={false}>
      <BotaoInstalar />
      {semAcesso && (
        <section className="cartao aguardando-acesso" data-testid="aguardando-acesso">
          {pedido?.situacao === 'recusado' ? (
            <p>
              O pedido para trabalhar como <b>{pedido.perfil}</b> no {pedido.viveiro} não foi aprovado.{pedido.motivo ? ` Motivo: ${pedido.motivo}` : ''}
            </p>
          ) : (
            <p>
              Seu pedido para trabalhar como <b>{pedido?.perfil ?? 'equipe'}</b>
              {pedido?.viveiro ? ` no ${pedido.viveiro}` : ''} está com o gestor. Quando ele aprovar, os módulos aparecem aqui.
            </p>
          )}
          <button className="botao-secundario" onClick={() => void sincronizar()} disabled={estadoSync === 'sincronizando'}>
            <Icone nome="sincronizar" /> Verificar agora
          </button>
        </section>
      )}
      {viveiro && (
        <Link to="/viveiro-atual" className="viveiro-atual">
          <Icone nome="viveiro" tamanho={22} /> {String(viveiro.nome)} <small>trocar</small>
        </Link>
      )}
      <nav className="grade-blocos">
        {visiveis.map((b) => (
          <Link key={b.rota} to={b.rota} className="bloco">
            <span className="circulo">
              <Icone nome={b.icone} tamanho={42} />
            </span>
            <span>{b.rotulo}</span>
          </Link>
        ))}
        <Link to="/configuracoes" className="bloco bloco-secundario">
          <span className="circulo">
            <Icone nome="configuracoes" tamanho={42} />
          </span>
          <span>Ajustes</span>
        </Link>
      </nav>
    </Tela>
  );
}
