/** Rastreio público de um lote: de onde vieram as sementes. */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RastreioPublico } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { ROTULO_FASE } from '../viveiro/dados';
import { lerRastreio, servidorPublico } from './api';
import { Pagina } from './Pagina';

const data = (s?: string) => (s ? new Date(s.slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') : '?');

/** Cadeia do lote em linguagem simples. */
export function CadeiaLote({ r }: { r: RastreioPublico }) {
  return (
    <ol className="cadeia" data-testid="cadeia">
      {r.lote_sementes && (
        <li>
          <Icone nome="arvore" tamanho={28} />
          <span>
            Sementes de <b>{r.lote_sementes.matrizes} árvore(s) matriz(es)</b>
            {r.lote_sementes.municipios.length ? ` em ${r.lote_sementes.municipios.join(', ')}` : ''}
          </span>
        </li>
      )}
      {r.lote_sementes && (
        <li>
          <Icone nome="semente" tamanho={28} />
          <span>
            Lote de sementes <b>{r.lote_sementes.codigo}</b>, formado em {data(r.lote_sementes.data_formacao)}
          </span>
        </li>
      )}
      <li>
        <Icone nome="muda" tamanho={28} />
        <span>
          Lote de mudas <b>{r.lote_mudas.codigo}</b>, semeado em {data(r.lote_mudas.data_semeadura)} no {r.lote_mudas.viveiro} · {ROTULO_FASE[r.lote_mudas.fase] ?? r.lote_mudas.fase}
        </span>
      </li>
    </ol>
  );
}

export function RastreioLote() {
  const { codigo } = useParams();
  const { sessao } = useApp();
  const [r, setR] = useState<RastreioPublico | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    lerRastreio(servidorPublico(sessao?.servidor), codigo!)
      .then((x) => setR(x.dados))
      .catch((e) => setErro((e as Error).message === 'Não encontrado.' ? `Não achei o lote ${codigo}.` : (e as Error).message));
  }, [codigo, sessao?.servidor]);
  return (
    <Pagina titulo={`Lote ${codigo}`}>
      {erro && <p className="erro">{erro}</p>}
      {r && <CadeiaLote r={r} />}
      <p className="dica">Para proteger os proprietários, o local exato das árvores não é mostrado.</p>
    </Pagina>
  );
}
