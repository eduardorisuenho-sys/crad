/** Botão "Pesquisar no Google Lens": precisa de internet; a sugestão nunca vira espécie sozinha. */
import { useState } from 'react';
import { useApp } from '../contexto';
import { pesquisarNoLens } from '../plataforma/lens';
import { Icone } from './Icone';

export function BotaoLens({ obterFoto, nome }: { obterFoto: () => Promise<Blob | undefined>; nome?: string }) {
  const { online } = useApp();
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!online) return <p className="dica">Com internet, a foto pode ir para o Google Lens, que sugere o nome da árvore.</p>;
  return (
    <>
      <button
        type="button"
        className="botao-secundario"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setMsg('');
          try {
            const foto = await obterFoto();
            if (!foto) return setMsg('A foto não está neste aparelho nem no servidor.');
            const r = await pesquisarNoLens(foto, nome);
            if (r === 'compartilhado') setMsg('Escolha “Google Lens” (ou “Pesquisar com o Google”). Depois volte aqui e escolha a espécie sugerida.');
            if (r === 'computador') setMsg('A foto foi baixada e o Google Lens abriu em outra aba: arraste a foto para lá. Depois volte e escolha a espécie.');
          } finally {
            setOcupado(false);
          }
        }}
      >
        <Icone nome="lupa" /> Pesquisar no Google Lens
      </button>
      {msg && <p className="dica" data-testid="lens-msg">{msg}</p>}
      <p className="dica">O Lens só sugere nomes. Confira com a ficha da espécie antes de escolher.</p>
    </>
  );
}
