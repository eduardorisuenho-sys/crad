import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { codigosRestantes } from '@crads/dominio';
import { Icone } from '../componentes/Icone';
import { Tela } from '../componentes/Tela';
import { useApp } from '../contexto';
import { idDispositivo, reservarFaixas, sair } from '../dados/sessao';
import { espacoUsado, formatarBytes } from '../plataforma/armazenamento';

export function Configuracoes() {
  const { sessao, db, pendentes, ultimaSync, sincronizar, estadoSync, definirSessao, online } = useApp();
  const navegar = useNavigate();
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const faixas = useLiveQuery(() => db._faixas.toArray(), [db]) ?? [];
  const ano = new Date().getFullYear();

  useEffect(() => {
    void espacoUsado().then(setEspaco);
  }, []);

  async function prepararCampo() {
    if (!sessao) return;
    setMsg('');
    try {
      await reservarFaixas(db, sessao, await idDispositivo(db));
      await sincronizar();
      setMsg('Pronto para ir a campo.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function aoSair() {
    if (pendentes && !confirm(`Há ${pendentes} item(ns) ainda não enviados. Eles continuam guardados neste aparelho. Sair mesmo assim?`)) return;
    await sair(db);
    definirSessao(null);
    navegar('/');
  }

  return (
    <Tela titulo="Ajustes">
      <dl className="ficha">
        <dt>Usuário</dt>
        <dd>
          {sessao?.nome} <small>{sessao?.email}</small>
        </dd>
        <dt>Última sincronização</dt>
        <dd>{ultimaSync ? new Date(ultimaSync).toLocaleString('pt-BR') : 'nunca'}</dd>
        <dt>Guardado no aparelho, sem enviar</dt>
        <dd data-testid="pendentes">{pendentes}</dd>
        <dt>Códigos de matriz reservados</dt>
        <dd>{codigosRestantes(faixas, 'MT', ano)}</dd>
        {espaco && (
          <>
            <dt>Espaço usado</dt>
            <dd>
              {formatarBytes(espaco.usado)} de {formatarBytes(espaco.total)}
            </dd>
          </>
        )}
      </dl>
      {msg && <p className="mensagem">{msg}</p>}
      <div className="lista-grande">
        <button className="botao-grande" onClick={() => void sincronizar()} disabled={!online || estadoSync === 'sincronizando'}>
          <Icone nome="sincronizar" tamanho={40} />
          <span>Sincronizar agora</span>
        </button>
        <button className="botao-grande" onClick={() => void prepararCampo()} disabled={!online}>
          <Icone nome="arvore" tamanho={40} />
          <span>Preparar para ir a campo</span>
        </button>
        <button className="botao-grande" onClick={() => navegar('/instalar')}>
          <Icone nome="compartilhar" tamanho={40} />
          <span>Instalar no aparelho</span>
        </button>
        <button className="botao-grande perigo" onClick={() => void aoSair()}>
          <Icone nome="sair" tamanho={40} />
          <span>Sair</span>
        </button>
      </div>
    </Tela>
  );
}
