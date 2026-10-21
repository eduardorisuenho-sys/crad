/** Ajuda: os vídeos do manual, os do perfil da pessoa primeiro, e cada um pode ficar guardado para ver sem internet. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { EPISODIOS } from './episodios.gerado';
import { formatarDuracao, formatarTamanho, NOME_PERFIL, separarPorPerfil, type Episodio } from './episodios';
import { apagarVideo, guardarVideo, videosGuardados } from './guardar';

function useGuardados() {
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const recarregar = useCallback(() => void videosGuardados().then(setGuardados), []);
  useEffect(recarregar, [recarregar]);
  return { guardados, recarregar };
}

function Perfis({ episodio }: { episodio: Episodio }) {
  return (
    <span className="perfis-video">
      {episodio.perfis.map((p) => (
        <span key={p} className="selo">
          {NOME_PERFIL[p]}
        </span>
      ))}
    </span>
  );
}

function ItemVideo({ episodio, guardado }: { episodio: Episodio; guardado: boolean }) {
  return (
    <li>
      <Link to={`/ajuda/${episodio.numero}`} className="item-video" aria-label={`Episódio ${episodio.numero}: ${episodio.titulo}`}>
        <img src={episodio.capa} alt="" width={72} height={128} loading="lazy" />
        <div>
          <small>Episódio {episodio.numero}</small>
          <strong>{episodio.titulo}</strong>
          <Perfis episodio={episodio} />
          <small>
            {formatarDuracao(episodio.segundos)}
            {guardado && (
              <>
                {' · '}
                <Icone nome="certo" tamanho={14} /> guardado no celular
              </>
            )}
          </small>
        </div>
      </Link>
    </li>
  );
}

export function ListaAjuda() {
  const { sessao, perfis } = useApp();
  const { guardados } = useGuardados();
  const { paraVoce, outros } = separarPorPerfil(EPISODIOS, [...perfis, ...(sessao?.solicitante ? (['solicitante'] as const) : [])], !!sessao?.gestorGeral);
  return (
    <Tela titulo="Ajuda">
      <p className="dica">Vídeos curtos, passo a passo. Guarde no celular para ver sem internet.</p>
      <h2 className="subtitulo">{sessao ? 'Para você' : 'Para começar'}</h2>
      <ul className="lista lista-videos">
        {paraVoce.map((e) => (
          <ItemVideo key={e.numero} episodio={e} guardado={guardados.has(e.video)} />
        ))}
      </ul>
      {outros.length > 0 && (
        <>
          <h2 className="subtitulo">Outros vídeos</h2>
          <ul className="lista lista-videos">
            {outros.map((e) => (
              <ItemVideo key={e.numero} episodio={e} guardado={guardados.has(e.video)} />
            ))}
          </ul>
        </>
      )}
      <a className="botao-secundario" href="/ajuda/manual-crad.pdf" download>
        <Icone nome="baixar" /> Manual em PDF
      </a>
    </Tela>
  );
}

export function VideoAjuda() {
  const { numero } = useParams();
  const episodio = EPISODIOS.find((e) => e.numero === Number(numero));
  const proximo = EPISODIOS.find((e) => e.numero === Number(numero) + 1);
  const { guardados, recarregar } = useGuardados();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  if (!episodio) {
    return (
      <Tela titulo="Ajuda">
        <p className="vazio">Vídeo não encontrado.</p>
        <Link to="/ajuda" className="botao-secundario">
          Ver todos os vídeos
        </Link>
      </Tela>
    );
  }
  const guardado = guardados.has(episodio.video);
  async function alternar() {
    setOcupado(true);
    setErro('');
    try {
      await (guardado ? apagarVideo(episodio!.video) : guardarVideo(episodio!.video));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    recarregar();
    setOcupado(false);
  }
  return (
    <Tela titulo={`Episódio ${episodio.numero}`}>
      <h2 className="pergunta">{episodio.titulo}</h2>
      <Perfis episodio={episodio} />
      {/* key: troca o vídeo ao ir para o próximo episódio */}
      <video key={episodio.video} className="video-ajuda" src={episodio.video} poster={episodio.capa} controls playsInline preload="metadata" />
      <button className="botao-secundario" onClick={() => void alternar()} disabled={ocupado} data-testid="guardar-video">
        {ocupado ? (
          'Aguarde…'
        ) : guardado ? (
          <>
            <Icone nome="lixo" /> Tirar do celular
          </>
        ) : (
          <>
            <Icone nome="baixar" /> Guardar para ver sem internet ({formatarTamanho(episodio.bytes)})
          </>
        )}
      </button>
      {guardado && !ocupado && (
        <p className="mensagem">
          <Icone nome="certo" tamanho={20} /> Guardado no celular: abre mesmo sem internet.
        </p>
      )}
      {erro && <p className="mensagem alerta">{erro}</p>}
      {proximo && (
        <Link to={`/ajuda/${proximo.numero}`} className="botao-principal">
          Próximo: {proximo.titulo}
        </Link>
      )}
      <Link to="/ajuda" className="botao-secundario">
        Ver todos os vídeos
      </Link>
    </Tela>
  );
}
