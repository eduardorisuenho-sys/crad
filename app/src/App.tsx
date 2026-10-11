import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Catalogo } from './modulos/catalogo/Catalogo';
import { EspeciePublica } from './modulos/catalogo/EspeciePublica';
import { RastreioLote } from './modulos/catalogo/Rastreio';
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
import { DetalheLoteMudas } from './modulos/viveiro/DetalheLoteMudas';
import { InicioViveiro } from './modulos/viveiro/InicioViveiro';
import { Inventario } from './modulos/viveiro/Inventario';
import { NovaSemeadura } from './modulos/viveiro/NovaSemeadura';
import { DetalhePedido } from './modulos/doacao/DetalhePedido';
import { InicioDoacao } from './modulos/doacao/InicioDoacao';
import { NovoPedido } from './modulos/doacao/NovoPedido';
import { Retirada } from './modulos/doacao/Retirada';
import { DetalhePlantio } from './modulos/posplantio/DetalhePlantio';
import { InicioPosPlantio } from './modulos/posplantio/InicioPosPlantio';
import { NovoAcompanhamento } from './modulos/posplantio/NovoAcompanhamento';
import { RegistrarPlantio } from './modulos/posplantio/RegistrarPlantio';
import { PainelRelatorios } from './modulos/relatorios/Painel';
import { RastreioInterno } from './modulos/relatorios/RastreioInterno';
import { Transparencia } from './modulos/relatorios/Transparencia';

function Rotas() {
  const { sessao, carregando, viveiroId, escolherViveiro } = useApp();
  const viveiros = useViveirosDoUsuario();

  // Com um viveiro só, escolhe sozinho.
  useEffect(() => {
    if (sessao && !viveiroId && viveiros?.length === 1) void escolherViveiro(viveiros[0].id);
  }, [sessao, viveiroId, viveiros, escolherViveiro]);

  if (carregando) return <div className="carregando">Abrindo…</div>;
  // Catálogo e rastreio são públicos: abrem sem login.
  const publicas = (
    <>
      <Route path="/catalogo" element={<Catalogo />} />
      <Route path="/catalogo/:id" element={<EspeciePublica />} />
      <Route path="/rastreio/:codigo" element={<RastreioLote />} />
      <Route path="/transparencia" element={<Transparencia />} />
    </>
  );
  if (!sessao) {
    return (
      <Routes>
        {publicas}
        <Route path="*" element={<Entrar />} />
      </Routes>
    );
  }
  const precisaEscolher = !viveiroId && (viveiros?.length ?? 0) > 1;

  return (
    <Routes>
      {publicas}
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
      <Route path="/viveiro" element={<InicioViveiro />} />
      <Route path="/viveiro/semeadura" element={<NovaSemeadura />} />
      <Route path="/viveiro/lotes/:id" element={<DetalheLoteMudas />} />
      <Route path="/viveiro/inventario" element={<Inventario />} />
      <Route path="/doacao" element={<InicioDoacao />} />
      <Route path="/doacao/novo" element={<NovoPedido />} />
      <Route path="/doacao/:id" element={<DetalhePedido />} />
      <Route path="/doacao/:id/retirada" element={<Retirada />} />
      <Route path="/pos-plantio" element={<InicioPosPlantio />} />
      <Route path="/pos-plantio/novo/:doacaoId" element={<RegistrarPlantio />} />
      <Route path="/pos-plantio/:id" element={<DetalhePlantio />} />
      <Route path="/pos-plantio/:id/acompanhamento" element={<NovoAcompanhamento />} />
      <Route path="/relatorios" element={<PainelRelatorios />} />
      <Route path="/relatorios/rastreio" element={<RastreioInterno />} />
      <Route path="/especies/importar" element={<ImportarEspecies />} />
      <Route path="/especies/:id" element={<FichaEspecie />} />
      <Route path="/avisos" element={<Avisos />} />
      <Route path="/instalar" element={<Instalar />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      {BLOCOS.filter((b) => !['/viveiros', '/especies', '/identificar', '/matrizes', '/coleta', '/viveiro', '/catalogo', '/doacao', '/pos-plantio', '/relatorios'].includes(b.rota)).map((b) => (
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
