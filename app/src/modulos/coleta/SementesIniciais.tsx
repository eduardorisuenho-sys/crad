/**
 * Sementes que já estavam no viveiro antes do app (sem coletas nem matrizes
 * registradas). Vira um lote de sementes com a origem "não registrada":
 * nada é inventado sobre de onde vieram.
 */
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CAMPO_DECIMAL, lerNumero } from '../../plataforma/numero';
import { EscolherEspecie } from '../especies/EscolherEspecie';
import { nomesEspecies } from './dados';

export function SementesIniciais() {
  const { repo, db } = useApp();
  const navegar = useNavigate();
  const [especie, setEspecie] = useState('');
  const [dados, setDados] = useState({ peso_g: '', sementes: '', origem: '', validade: '', endereco_id: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const enderecos = useLiveQuery(() => repo.listar('endereco_armazenamento', (e) => e.ativo !== false), [repo]) ?? [];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const peso = lerNumero(dados.peso_g);
    if (!peso || peso <= 0) return setErro('Informe o peso das sementes em gramas.');
    setSalvando(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const lote = await repo.salvar('lote_sementes', {
      codigo: await repo.proximoCodigo('LS'),
      especie_id: especie,
      origem: 'estoque_inicial',
      observacao_origem: dados.origem.trim() || 'Sementes que já estavam no viveiro antes do app (matrizes não registradas).',
      data_formacao: hoje,
      peso_g: peso,
      sementes_estimadas: Number(dados.sementes) || null,
      validade: dados.validade || null,
      endereco_id: dados.endereco_id || null,
      situacao: 'armazenado',
    });
    await repo.salvar('movimento_sementes', { lote_sementes_id: lote.id, tipo: 'entrada', quantidade_g: peso, quantidade_unid: Number(dados.sementes) || null, data: hoje, endereco_id: dados.endereco_id || null, observacao: 'sementes que já estavam no viveiro' });
    navegar(`/coleta/lotes/${lote.id}?novo=1`, { replace: true });
  }

  return (
    <Tela titulo="Sementes que já estavam aqui">
      {!especie ? (
        <>
          <p className="dica">Para sementes guardadas antes do app, sem matriz registrada. Elas viram um lote de sementes e podem ser semeadas normalmente.</p>
          <p className="pergunta">Qual é a espécie?</p>
          <EscolherEspecie aoEscolher={setEspecie} />
        </>
      ) : (
        <form className="formulario" onSubmit={(e) => void salvar(e)}>
          <p className="passo">{nomes?.get(especie)}</p>
          <label>
            Peso das sementes (gramas)
            <input {...CAMPO_DECIMAL} required autoFocus value={dados.peso_g} onChange={(e) => setDados({ ...dados, peso_g: e.target.value })} />
          </label>
          <label>
            Número de sementes (estimado, opcional)
            <input type="number" inputMode="numeric" min="0" value={dados.sementes} onChange={(e) => setDados({ ...dados, sementes: e.target.value })} />
          </label>
          <label>
            De onde vieram? (opcional: local, ano da coleta, quem coletou)
            <input value={dados.origem} onChange={(e) => setDados({ ...dados, origem: e.target.value })} />
          </label>
          <label>
            Validade (opcional)
            <input type="date" value={dados.validade} onChange={(e) => setDados({ ...dados, validade: e.target.value })} />
          </label>
          <label>
            Onde estão guardadas
            <select value={dados.endereco_id} onChange={(e) => setDados({ ...dados, endereco_id: e.target.value })}>
              <option value="">— escolher depois —</option>
              {enderecos.map((x) => (
                <option key={x.id} value={x.id}>
                  {String(x.codigo)}
                </option>
              ))}
            </select>
          </label>
          {erro && <p className="erro">{erro}</p>}
          <button className="botao-principal" disabled={salvando}>
            <Icone nome="certo" /> Criar lote
          </button>
          <button type="button" className="link" onClick={() => setEspecie('')}>
            Trocar a espécie
          </button>
        </form>
      )}
    </Tela>
  );
}
