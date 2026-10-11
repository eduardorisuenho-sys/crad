/** Portal da transparência: totais e mapa dos plantios, sem login e sem dados pessoais. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transparencia as Dados } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { lerTransparencia, servidorPublico } from '../catalogo/api';
import { Pagina } from '../catalogo/Pagina';
import { Barras, MapaPontos } from './Graficos';

export function Transparencia() {
  const { sessao } = useApp();
  const servidor = servidorPublico(sessao?.servidor);
  const [t, setT] = useState<Dados | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    lerTransparencia(servidor)
      .then((r) => {
        setT(r.dados);
        setGuardado(r.guardado ? r.em : null);
      })
      .catch((e) => setErro((e as Error).message));
  }, [servidor]);

  return (
    <Pagina titulo="Transparência">
      <p className="dica">Resultados das doações de mudas nativas do CRAD. Os pontos do mapa são aproximados (cerca de 1 km) para proteger as propriedades.</p>
      {guardado && (
        <p className="mensagem alerta">
          <Icone nome="semSinal" tamanho={20} /> Sem internet: mostrando os dados de {new Date(guardado).toLocaleString('pt-BR')}.
        </p>
      )}
      {erro && <p className="erro">{erro}</p>}
      {!t && !erro && <p className="vazio">Carregando…</p>}
      {t && (
        <>
          <ul className="indicadores" data-testid="transparencia">
            <li>
              <small>Mudas doadas</small>
              <strong>{mostrarNumero(t.mudas_doadas)}</strong>
              <span>{t.doacoes} doações</span>
            </li>
            <li>
              <small>Mudas plantadas</small>
              <strong>{mostrarNumero(t.mudas_plantadas)}</strong>
            </li>
            <li>
              <small>Sobrevivência</small>
              <strong>{t.sobrevivencia == null ? '—' : `${mostrarNumero(t.sobrevivencia)}%`}</strong>
              <span>nos plantios acompanhados</span>
            </li>
            <li>
              <small>Plantando Água</small>
              <strong>{mostrarNumero(t.plantando_agua.mudas_doadas)}</strong>
              <span>mudas em {t.plantando_agua.doacoes} doações</span>
            </li>
          </ul>
          <section className="cartao">
            <Barras titulo="Mudas doadas por ano" itens={t.por_ano.map((a) => ({ rotulo: a.ano || 'sem data', valor: a.mudas_doadas }))} />
          </section>
          <section className="cartao">
            <Barras titulo="Espécies mais doadas (mudas)" itens={t.especies_mais_distribuidas.map((e) => ({ rotulo: e.especie, valor: e.mudas }))} />
          </section>
          <section className="cartao">
            <h2>Onde as mudas foram plantadas</h2>
            <MapaPontos rotulo="Mapa aproximado dos plantios" pontos={t.plantios.map((p) => ({ lat: p.lat, lon: p.lon, peso: p.mudas, rotulo: `${p.mudas} mudas (${p.ano})` }))} />
          </section>
        </>
      )}
      <Link to="/catalogo" className="botao-secundario">
        Ver o catálogo de mudas
      </Link>
    </Pagina>
  );
}
