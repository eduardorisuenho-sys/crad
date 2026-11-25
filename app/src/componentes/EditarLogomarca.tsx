/**
 * Administrador: a logomarca da instituição que usa o app. Depois de escolhida,
 * vai sozinha para o cabeçalho de todos os documentos em PDF, para o termo de
 * compromisso e para o rodapé das telas, em todos os aparelhos.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../contexto';
import { CHAVE_LOGOMARCA, definirLogomarca, ehLogomarca, prepararLogomarca } from '../plataforma/logomarca';
import { Icone } from './Icone';

export function EditarLogomarca() {
  const { db, repo } = useApp();
  const atual = useLiveQuery(async () => (await db.colecao('parametro').toArray()).find((p) => p.chave === CHAVE_LOGOMARCA && !p.viveiro_id), [db]);
  const logo = atual && !atual.excluido && ehLogomarca(atual.valor) ? atual.valor : null;
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function gravar(valor: unknown, aviso: string) {
    await repo.salvar('parametro', { chave: CHAVE_LOGOMARCA, valor, descricao: 'Logomarca da instituição (documentos, termo e rodapé)' }, atual?.id);
    definirLogomarca(ehLogomarca(valor) ? valor : null);
    setMsg(aviso);
  }

  async function escolher(arquivo: File) {
    setErro('');
    setMsg('');
    setOcupado(true);
    try {
      await gravar(await prepararLogomarca(arquivo), 'Logomarca salva. Já aparece nos documentos, no termo e no rodapé.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  return (
    <section className="cartao" data-testid="editar-logomarca">
      <h2>Logomarca da instituição</h2>
      <p className="dica">A logomarca de quem usa o app vai sozinha para o cabeçalho dos documentos em PDF, para o termo de compromisso e para o rodapé das telas. Use PNG (de preferência com fundo transparente) ou JPG.</p>
      {logo ? (
        <div className="previa-logomarca">
          <img src={logo.imagem} alt="Logomarca da instituição" data-testid="previa-logomarca" />
        </div>
      ) : (
        <p className="vazio">Nenhuma logomarca ainda.</p>
      )}
      {msg && <p className="mensagem">{msg}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <label className="botao-principal botao-arquivo">
        <Icone nome="mais" /> {ocupado ? 'Aguarde…' : logo ? 'Trocar a logomarca' : 'Escolher a imagem da logomarca'}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={ocupado} aria-label="Imagem da logomarca" onChange={(e) => e.target.files?.[0] && void escolher(e.target.files[0])} />
      </label>
      {logo && (
        <div className="acoes">
          <a className="botao-secundario" href={logo.imagem} download={logo.nome || `logomarca.${logo.imagem.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`}>
            <Icone nome="baixar" /> Baixar a logomarca
          </a>
          <button type="button" className="botao-secundario" onClick={() => void gravar(null, 'Logomarca retirada.')}>
            <Icone nome="lixo" /> Tirar a logomarca
          </button>
        </div>
      )}
    </section>
  );
}
