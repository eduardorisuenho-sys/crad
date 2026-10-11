import { Link } from 'react-router-dom';
import type { Perfil } from '@crads/dominio';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';
import { ehIOS, estaInstalado } from '../plataforma/dispositivo';

interface Bloco {
  rota: string;
  rotulo: string;
  icone: string;
  perfis: Perfil[] | 'todos';
}

// Os sete módulos, na ordem do caminho da muda.
export const BLOCOS: Bloco[] = [
  { rota: '/matrizes', rotulo: 'Matrizes', icone: 'arvore', perfis: ['coletor', 'gestor'] },
  { rota: '/coleta', rotulo: 'Coleta e sementes', icone: 'semente', perfis: ['coletor', 'viveirista', 'gestor'] },
  { rota: '/viveiro', rotulo: 'Viveiro', icone: 'muda', perfis: ['viveirista', 'gestor'] },
  { rota: '/catalogo', rotulo: 'Catálogo', icone: 'catalogo', perfis: 'todos' },
  { rota: '/doacao', rotulo: 'Doação de mudas', icone: 'doacao', perfis: ['viveirista', 'gestor', 'solicitante'] },
  { rota: '/pos-plantio', rotulo: 'Pós-plantio', icone: 'plantio', perfis: 'todos' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'relatorio', perfis: ['gestor'] },
  { rota: '/especies', rotulo: 'Espécies', icone: 'catalogo', perfis: ['coletor', 'viveirista', 'gestor'] },
  { rota: '/viveiros', rotulo: 'Viveiros', icone: 'viveiro', perfis: ['gestor'] },
];

export function Inicio() {
  const { sessao, perfis, viveiroId, db } = useApp();
  const viveiro = useLiveQuery(() => (viveiroId ? db.colecao('viveiro').get(viveiroId) : undefined), [viveiroId]);
  const visiveis = BLOCOS.filter((b) => b.perfis === 'todos' || b.perfis.some((p) => perfis.includes(p)));

  return (
    <Tela titulo={`Olá, ${sessao?.nome?.split(' ')[0] || 'bem-vindo'}`} voltar={false}>
      {ehIOS() && !estaInstalado() && (
        <Link to="/instalar" className="faixa-instalar">
          <Icone nome="compartilhar" /> Instale o CRADS na tela de início para não perder dados
        </Link>
      )}
      {viveiro && (
        <Link to="/viveiro-atual" className="viveiro-atual">
          <Icone nome="viveiro" tamanho={22} /> {String(viveiro.nome)} <small>trocar</small>
        </Link>
      )}
      <nav className="grade-blocos">
        {visiveis.map((b) => (
          <Link key={b.rota} to={b.rota} className="bloco">
            <Icone nome={b.icone} tamanho={48} />
            <span>{b.rotulo}</span>
          </Link>
        ))}
        <Link to="/configuracoes" className="bloco bloco-secundario">
          <Icone nome="configuracoes" tamanho={48} />
          <span>Ajustes</span>
        </Link>
      </nav>
    </Tela>
  );
}
