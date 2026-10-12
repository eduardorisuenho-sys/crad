/** Estado global do app: banco local, sessão, viveiro atual e sincronização. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { matrizDe, temPermissao, type MatrizPermissoes, type Perfil } from '@crads/dominio';
import { BancoCrads } from './dados/db';
import { Repositorio } from './dados/repositorio';
import { idDispositivo, perfisNoViveiro, renovar, sessaoSalva, type Sessao } from './dados/sessao';
import { SemConexao, SessaoExpirada, Sincronizador } from './dados/sincronizador';
import { TransporteHttp } from './dados/transporte-http';
import { pedirArmazenamentoPersistente } from './plataforma/armazenamento';

export type EstadoSync = 'parado' | 'sincronizando' | 'sem_sinal' | 'entrar_de_novo' | 'erro';

interface ValorApp {
  db: BancoCrads;
  repo: Repositorio;
  sessao: Sessao | null;
  carregando: boolean;
  definirSessao(s: Sessao | null): void;
  viveiroId: string | undefined;
  escolherViveiro(id: string): Promise<void>;
  perfis: Perfil[];
  /** tabela de permissões em vigor */
  matriz: MatrizPermissoes;
  /** pode fazer isso (no viveiro informado ou no atual)? */
  pode(chave: string, viveiroId?: unknown): boolean;
  online: boolean;
  estadoSync: EstadoSync;
  mensagemSync: string;
  pendentes: number;
  avisosAbertos: number;
  ultimaSync: string | null;
  sincronizar(): Promise<void>;
}

const Contexto = createContext<ValorApp | null>(null);
const db = new BancoCrads();

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dispositivo, setDispositivo] = useState('');
  const [viveiroId, setViveiroId] = useState<string | undefined>();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('parado');
  const [mensagemSync, setMensagemSync] = useState('');

  const sessaoRef = useRef<Sessao | null>(null);
  // Falhas seguidas: espera cada vez mais antes de tentar de novo (não fica piscando).
  const tentativasRef = useRef(0);
  sessaoRef.current = sessao;
  const dispRef = useRef('');
  dispRef.current = dispositivo;
  const viveiroRef = useRef<string | undefined>(undefined);
  viveiroRef.current = viveiroId;

  const repo = useMemo(() => new Repositorio(db, () => ({ dispositivoId: dispRef.current, viveiroId: viveiroRef.current })), []);
  const sync = useMemo(
    () =>
      new Sincronizador(
        db,
        new TransporteHttp(
          () => sessaoRef.current?.servidor ?? '',
          () => sessaoRef.current?.token ?? null,
        ),
        () => dispRef.current,
      ),
    [],
  );

  const pendentes = useLiveQuery(async () => (await db._fila.count()) + (await db._arquivos.filter((a) => !a.falhou).count()), [], 0);
  const avisosAbertos = useLiveQuery(() => db._avisos.filter((a) => !a.resolvido).count(), [], 0);
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [], []);
  const matriz = useMemo(() => matrizDe(parametros ?? []), [parametros]);
  const ultimaSync = useLiveQuery(() => db.lerMeta<string | null>('ultima_sincronizacao', null), [], null);

  // Abre com a sessão guardada no aparelho (funciona sem internet).
  useEffect(() => {
    (async () => {
      setDispositivo(await idDispositivo(db));
      const s = await sessaoSalva(db);
      setSessao(s);
      setViveiroId(await db.lerMeta<string | undefined>('viveiro_atual', undefined));
      setCarregando(false);
      void pedirArmazenamentoPersistente();
    })();
  }, []);

  const sincronizar = useCallback(async () => {
    if (!sessaoRef.current || !dispRef.current) return;
    setEstadoSync('sincronizando');
    try {
      const s = await renovar(db, sessaoRef.current);
      if (s !== sessaoRef.current) setSessao(s);
      const r = await sync.sincronizar();
      tentativasRef.current = 0;
      setEstadoSync('parado');
      setMensagemSync(r.avisos ? `${r.avisos} aviso(s) para revisar` : '');
    } catch (err) {
      if (err instanceof SemConexao) setEstadoSync('sem_sinal');
      else if (err instanceof SessaoExpirada) setEstadoSync('entrar_de_novo');
      else {
        setEstadoSync('erro');
        setMensagemSync(String((err as Error).message ?? err));
        tentativasRef.current++;
      }
    }
  }, [sync]);

  // Sincroniza ao abrir, quando o sinal volta, a cada minuto e logo depois de gravar.
  useEffect(() => {
    if (!sessao) return;
    const aoMudarRede = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sincronizar();
    };
    window.addEventListener('online', aoMudarRede);
    window.addEventListener('offline', aoMudarRede);
    const t = window.setInterval(() => navigator.onLine && void sincronizar(), 60_000);
    void sincronizar();
    return () => {
      window.removeEventListener('online', aoMudarRede);
      window.removeEventListener('offline', aoMudarRede);
      window.clearInterval(t);
    };
  }, [sessao?.id, sincronizar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessao || !pendentes || !navigator.onLine) return;
    // Depois de gravar, envia logo; se falhou, só tenta de novo com o intervalo de 1 minuto (ou no botão Enviar).
    if (tentativasRef.current > 0) return;
    const t = window.setTimeout(() => void sincronizar(), 2_000);
    return () => window.clearTimeout(t);
  }, [pendentes, sessao?.id, sincronizar]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherViveiro = useCallback(async (id: string) => {
    await db.gravarMeta('viveiro_atual', id);
    setViveiroId(id);
  }, []);

  const valor: ValorApp = {
    db,
    repo,
    sessao,
    carregando,
    definirSessao: setSessao,
    viveiroId,
    escolherViveiro,
    perfis: sessao ? perfisNoViveiro(sessao, viveiroId) : [],
    matriz,
    pode: (chave, viveiro) => !!sessao && temPermissao({ ...sessao, permissoes: matriz }, chave, viveiro === undefined ? viveiroId : viveiro),
    online,
    estadoSync,
    mensagemSync,
    pendentes: pendentes ?? 0,
    avisosAbertos: avisosAbertos ?? 0,
    ultimaSync: ultimaSync ?? null,
    sincronizar,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): ValorApp {
  const v = useContext(Contexto);
  if (!v) throw new Error('useApp fora do ProvedorApp');
  return v;
}
