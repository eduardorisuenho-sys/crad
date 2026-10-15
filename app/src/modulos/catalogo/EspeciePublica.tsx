/** Ficha pública da espécie: fotos, como reconhecer, onde tem mudas e rastreio dos lotes. */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../../contexto';
import { NOMES_MESES, rotulo } from '../especies/rotulos';
import { lerEspecie, servidorPublico, urlFoto, type EspeciePublica as Dados } from './api';
import { Pagina } from './Pagina';
import { CadeiaLote } from './Rastreio';
import { CARACTERES } from './fichasPdf';


export function EspeciePublica() {
  const { id } = useParams();
  const { sessao } = useApp();
  const servidor = servidorPublico(sessao?.servidor);
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    lerEspecie(servidor, id!)
      .then((r) => setD(r.dados))
      .catch((e) => setErro((e as Error).message === 'Não encontrado.' ? 'Esta espécie não está no catálogo.' : (e as Error).message));
  }, [id, servidor]);

  const f = d?.ficha;
  const meses = (v: unknown) => (Array.isArray(v) ? (v as number[]).map((m) => NOMES_MESES[m - 1]).join(', ') : '');
  const porViveiro = new Map<string, number>();
  for (const l of d?.lotes ?? []) porViveiro.set(l.viveiro, (porViveiro.get(l.viveiro) ?? 0) + l.disponivel);

  return (
    <Pagina titulo={d?.nomes_populares[0] ?? f?.nome_cientifico ?? 'Espécie'}>
      {erro && <p className="erro">{erro}</p>}
      {d && f && (
        <>
          <p>
            <i>{String(f.nome_cientifico)}</i>
            {f.familia ? ` · ${String(f.familia)}` : ''}
          </p>
          {d.nomes_populares.length > 1 && <p className="dica">Também chamada de {d.nomes_populares.slice(1).join(', ')}.</p>}
          {d.fotos.length > 0 && (
            <div className="galeria">
              {d.fotos.map((ft) => (
                <figure key={ft.id}>
                  <a href={urlFoto(servidor, ft, true)} target="_blank" rel="noreferrer">
                    <img className="miniatura" src={urlFoto(servidor, ft)} alt={ft.parte} width={120} height={120} loading="lazy" />
                  </a>
                  <figcaption>
                    {ft.parte}
                    {ft.credito ? ` · ${ft.credito}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <section className="cartao" data-testid="onde-tem">
            <h2>Onde tem mudas prontas</h2>
            <ul className="historico">
              {[...porViveiro.entries()].map(([v, n]) => (
                <li key={v}>
                  {v}: <b>{n} mudas</b>
                </li>
              ))}
            </ul>
          </section>
          <dl className="ficha">
            {CARACTERES.filter((c) => f[c]).map((c) => (
              <div key={c}>
                <dt>{rotulo(c)}</dt>
                <dd>{String(f[c])}</dd>
              </div>
            ))}
            {f.meses_flor ? (
              <div>
                <dt>Flores</dt>
                <dd>{meses(f.meses_flor)}</dd>
              </div>
            ) : null}
            {f.meses_fruto ? (
              <div>
                <dt>Frutos</dt>
                <dd>{meses(f.meses_fruto)}</dd>
              </div>
            ) : null}
            {f.lorenzi_volume ? (
              <div>
                <dt>Referência</dt>
                <dd>
                  Lorenzi, Árvores Brasileiras, vol. {String(f.lorenzi_volume)}
                  {f.lorenzi_pagina ? `, p. ${String(f.lorenzi_pagina)}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          <section className="cartao">
            <h2>De onde vêm estas mudas</h2>
            {d.lotes.map((l) => (
              <div key={l.rastreio.lote_mudas.codigo} className="lote-publico">
                <CadeiaLote r={l.rastreio} />
                <small>{l.disponivel} mudas disponíveis neste lote</small>
              </div>
            ))}
          </section>
        </>
      )}
    </Pagina>
  );
}
