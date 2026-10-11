import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './contexto';
import { Avisos } from './telas/Avisos';
import { Configuracoes } from './telas/Configuracoes';
import { EmBreve } from './telas/EmBreve';
import { Entrar } from './telas/Entrar';
import { EscolherViveiro, useViveirosDoUsuario } from './telas/EscolherViveiro';
import { BLOCOS, Inicio } from './telas/Inicio';
import { Instalar } from './telas/Instalar';
import { Viveiros } from './telas/Viveiros';
import { FichaEspecie } from './modulos/especies/FichaEspecie';
import { ImportarEspecies } from './modulos/especies/ImportarEspecies';
import { ListaEspecies } from './modulos/especies/ListaEspecies';
import { TelaIdentificar } from './modulos/assistente/TelaIdentificar';
import { DetalheMatriz } from './modulos/matrizes/DetalheMatriz';
import { LerQr } from './modulos/matrizes/LerQr';
import { ListaMatrizes } from './modulos/matrizes/ListaMatrizes';
import { NovaMatriz } from './modulos/matrizes/NovaMatriz';
import { Armazenamento } from './modulos/coleta/Armazenamento';
import { DetalheLote } from './modulos/coleta/DetalheLote';
import { InicioColeta } from './modulos/coleta/InicioColeta';
import { ListaLotes, NovoLote } from './modulos/coleta/Lotes';
import { NovaColeta } from './modulos/coleta/NovaColeta';
import { RotaColeta } from './modulos/coleta/RotaColeta';

function Rotas() {
  const { sessao, carregando, viveiroId, escolherViveiro } = useApp();
  const viveiros = useViveirosDoUsuario();

  // Com um viveiro só, escolhe sozinho.
  useEffect(() => {
    if (sessao && !viveiroId && viveiros?.length === 1) void escolherViveiro(viveiros[0].id);
  }, [sessao, viveiroId, viveiros, escolherViveiro]);

  if (carregando) return <div className="carregando">Abrindo…</div>;
  if (!sessao) return <Entrar />;
  const precisaEscolher = !viveiroId && (viveiros?.length ?? 0) > 1;

  return (
    <Routes>
      <Route path="/" element={precisaEscolher ? <Navigate to="/viveiro-atual" replace /> : <Inicio />} />
      <Route path="/viveiro-atual" element={<EscolherViveiro />} />
      <Route path="/viveiros" element={<Viveiros />} />
      <Route path="/especies" element={<ListaEspecies />} />
      <Route path="/identificar" element={<TelaIdentificar />} />
      <Route path="/matrizes" element={<ListaMatrizes />} />
      <Route path="/matrizes/nova" element={<NovaMatriz />} />
      <Route path="/matrizes/:id" element={<DetalheMatriz />} />
      <Route path="/ler-qr" element={<LerQr />} />
      <Route path="/coleta" element={<InicioColeta />} />
      <Route path="/coleta/nova" element={<NovaColeta />} />
      <Route path="/coleta/rota" element={<RotaColeta />} />
      <Route path="/coleta/lotes" element={<ListaLotes />} />
      <Route path="/coleta/lotes/novo" element={<NovoLote />} />
      <Route path="/coleta/lotes/:id" element={<DetalheLote />} />
      <Route path="/coleta/armazenamento" element={<Armazenamento />} />
      <Route path="/especies/importar" element={<ImportarEspecies />} />
      <Route path="/especies/:id" element={<FichaEspecie />} />
      <Route path="/avisos" element={<Avisos />} />
      <Route path="/instalar" element={<Instalar />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      {BLOCOS.filter((b) => !['/viveiros', '/especies', '/identificar', '/matrizes', '/coleta'].includes(b.rota)).map((b) => (
        <Route key={b.rota} path={`${b.rota}/*`} element={<EmBreve titulo={b.rotulo} icone={b.icone} />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Rotas />
    </BrowserRouter>
  );
}
