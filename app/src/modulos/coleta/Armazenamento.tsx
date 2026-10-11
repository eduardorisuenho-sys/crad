/** Endereços do armazenamento de sementes ("como numa farmácia"). */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { codigoEndereco, normalizarBusca } from '@crads/dominio';
import { CodigoQr } from '../../componentes/CodigoQr';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from './dados';

export function Armazenamento() {
  const { repo, db, viveiroId } = useApp();
  const [params] = useSearchParams();
  const [busca, setBusca] = useState(params.get('endereco') ?? '');
  const [novo, setNovo] = useState(false);
  const [partes, setPartes] = useState({ local: '', estante: '', prateleira: '', caixa: '' });
  const [erro, setErro] = useState('');
  const viveiro = useLiveQuery(() => (viveiroId ? db.colecao('viveiro').get(viveiroId) : undefined), [viveiroId]);
  const enderecos = useLiveQuery(async () => (await repo.listar('endereco_armazenamento')).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))), [repo]) ?? [];
  const lotes = useLiveQuery(() => repo.listar('lote_sementes', (l) => l.situacao !== 'esgotado' && l.situacao !== 'descartado'), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const codigo = codigoEndereco(String(viveiro?.sigla ?? ''), partes);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (enderecos.some((x) => x.codigo === codigo)) return setErro(`O endereço ${codigo} já existe.`);
    await repo.salvar('endereco_armazenamento', { codigo, ...partes, ativo: true });
    setNovo(false);
    setPartes({ local: '', estante: '', prateleira: '', caixa: '' });
    setBusca(codigo);
  }

  const q = normalizarBusca(busca);
  const filtrados = enderecos.filter((en) => {
    if (!q) return true;
    const aqui = lotes.filter((l) => l.endereco_id === en.id);
    return normalizarBusca(`${en.codigo} ${aqui.map((l) => `${l.codigo} ${nomes?.get(String(l.especie_id)) ?? ''}`).join(' ')}`).includes(q);
  });

  if (novo) {
    return (
      <Tela titulo="Novo endereço">
        <form className="formulario" onSubmit={salvar}>
          <label>
            Local (ex.: Câmara fria 1, Sala seca)
            <input required value={partes.local} onChange={(e) => setPartes({ ...partes, local: e.target.value })} />
          </label>
          <label>
            Estante
            <input value={partes.estante} onChange={(e) => setPartes({ ...partes, estante: e.target.value })} />
          </label>
          <label>
            Prateleira
            <input value={partes.prateleira} onChange={(e) => setPartes({ ...partes, prateleira: e.target.value })} />
          </label>
          <label>
            Caixa ou posição
            <input value={partes.caixa} onChange={(e) => setPartes({ ...partes, caixa: e.target.value })} />
          </label>
          <p className="contador" data-testid="codigo-endereco">
            {codigo}
          </p>
          {erro && <p className="erro">{erro}</p>}
          <button className="botao-principal">
            <Icone nome="certo" /> Salvar endereço
          </button>
          <button type="button" className="botao-secundario" onClick={() => setNovo(false)}>
            Cancelar
          </button>
        </form>
      </Tela>
    );
  }

  return (
    <Tela titulo="Armazenamento">
      <input className="campo-busca" type="search" placeholder="Buscar por código, lote ou espécie" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no armazenamento" />
      <button className="botao-secundario" onClick={() => setNovo(true)}>
        <Icone nome="mais" /> Novo endereço
      </button>
      <ul className="lista">
        {filtrados.map((en) => {
          const aqui = lotes.filter((l) => l.endereco_id === en.id);
          return (
            <li key={en.id} className="cartao">
              <div className="plaqueta" style={{ border: 0, padding: 0 }}>
                <CodigoQr texto={String(en.codigo)} tamanho={84} />
                <div>
                  <strong>{String(en.codigo)}</strong>
                  <small>{aqui.length} lote(s)</small>
                </div>
              </div>
              <ul className="lista" style={{ marginTop: 8 }}>
                {aqui.map((l) => (
                  <li key={l.id}>
                    <Link to={`/coleta/lotes/${l.id}`} className="item-lista">
                      <Icone nome="semente" />
                      <div>
                        <strong>{String(l.codigo)}</strong>
                        <small>{nomes?.get(String(l.especie_id)) ?? ''}</small>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        {!filtrados.length && <li className="vazio">Nenhum endereço encontrado.</li>}
      </ul>
    </Tela>
  );
}
