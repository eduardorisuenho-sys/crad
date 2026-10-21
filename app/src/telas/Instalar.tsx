/**
 * Página de download do app (o link que se manda pelo WhatsApp): instalar com um
 * toque quando o navegador deixa, e o passo a passo do aparelho da pessoa primeiro
 * (Android, iPhone ou computador).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from '../componentes/Icone';
import { Pagina as Tela } from '../modulos/catalogo/Pagina';
import { useInstalacao } from '../plataforma/instalacao';

type Aparelho = 'android' | 'iphone' | 'computador';

const PASSOS: Record<Aparelho, { titulo: string; passos: { icone: ReactNode; texto: ReactNode }[] }> = {
  android: {
    titulo: 'Celular Android',
    passos: [
      { icone: <Icone nome="configuracoes" tamanho={40} />, texto: <>Abra este link no <strong>Chrome</strong> e toque nos <strong>três pontinhos</strong>.</> },
      { icone: <Icone nome="mais" tamanho={40} />, texto: <>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</> },
      { icone: <img src="/icones/icone-192.png" alt="" width={40} height={40} />, texto: <>O <strong>ícone do CRAD</strong> aparece na tela do celular.</> },
    ],
  },
  iphone: {
    titulo: 'iPhone',
    passos: [
      { icone: <Icone nome="compartilhar" tamanho={40} />, texto: <>Abra este link no <strong>Safari</strong> e toque em <strong>Compartilhar</strong>.</> },
      { icone: <Icone nome="mais" tamanho={40} />, texto: <>Toque em <strong>Adicionar à Tela de Início</strong>.</> },
      { icone: <img src="/icones/icone-192.png" alt="" width={40} height={40} />, texto: <>Abra sempre pelo <strong>ícone do CRAD</strong>. Assim o iPhone não apaga o que você guardou sem internet.</> },
    ],
  },
  computador: {
    titulo: 'Computador',
    passos: [
      { icone: <Icone nome="baixar" tamanho={40} />, texto: <>Abra este link no <strong>Chrome</strong> ou no <strong>Edge</strong>.</> },
      { icone: <Icone nome="mais" tamanho={40} />, texto: <>Na barra de endereço, clique no ícone de <strong>instalar</strong> (ou nos três pontinhos → <strong>Instalar CRAD</strong>).</> },
      { icone: <img src="/icones/icone-192.png" alt="" width={40} height={40} />, texto: <>O CRAD abre numa janela própria e fica no menu Iniciar.</> },
    ],
  },
};

function aparelhoAtual(iphone: boolean): Aparelho {
  if (iphone) return 'iphone';
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) ? 'android' : 'computador';
}

/** Mensagem pronta para o WhatsApp, com o link desta página. */
export function linkWhatsApp(origem: string): string {
  const texto = `*CRAD* · Centro de Recuperação de Áreas Degradadas\nMudas nativas do Tocantins, da árvore matriz ao plantio.\n\nBaixe o app no celular ou no computador:\n${origem}/instalar`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function Instalar() {
  const { instalado, direto, iphone, instalar } = useInstalacao();
  const meu = aparelhoAtual(iphone);
  const outros = (['android', 'iphone', 'computador'] as Aparelho[]).filter((a) => a !== meu);

  return (
    <Tela titulo="Baixar o CRAD">
      <div className="marca-inicio">
        <img src="/marca/simbolo.png" alt="" width={120} height={128} />
        <strong>CRAD</strong>
        <small>Centro de Recuperação de Áreas Degradadas</small>
      </div>
      <p className="dica centro">Mudas nativas do Tocantins, da árvore matriz ao plantio. Funciona sem internet.</p>

      {instalado ? (
        <div className="mensagem">
          <Icone nome="certo" tamanho={22} /> O CRAD já está instalado neste aparelho.
        </div>
      ) : (
        <>
          {direto && (
            <button className="botao-principal" onClick={() => void instalar()}>
              <Icone nome="baixar" /> Instalar o CRAD
            </button>
          )}
          <section className="cartao" data-testid={`passos-${meu}`}>
            <h2>{direto ? 'Ou instale assim' : 'Como instalar'} · {PASSOS[meu].titulo}</h2>
            <ol className="passos">
              {PASSOS[meu].passos.map((p, k) => (
                <li key={k}>
                  {p.icone}
                  <span>{p.texto}</span>
                </li>
              ))}
            </ol>
          </section>
          {outros.map((a) => (
            <details key={a} className="cartao" data-testid={`passos-${a}`}>
              <summary>{PASSOS[a].titulo}</summary>
              <ol className="passos">
                {PASSOS[a].passos.map((p, k) => (
                  <li key={k}>
                    {p.icone}
                    <span>{p.texto}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </>
      )}

      <Link to="/" className="botao-secundario">
        Abrir o app agora
      </Link>
      <a className="botao-secundario" href={linkWhatsApp(window.location.origin)} target="_blank" rel="noopener noreferrer">
        <Icone nome="compartilhar" /> Enviar pelo WhatsApp
      </a>
    </Tela>
  );
}
