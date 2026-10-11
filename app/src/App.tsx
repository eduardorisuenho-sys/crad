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
      <Route path="/avisos" element={<Avisos />} />
      <Route path="/instalar" element={<Instalar />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      {BLOCOS.filter((b) => b.rota !== '/viveiros').map((b) => (
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
