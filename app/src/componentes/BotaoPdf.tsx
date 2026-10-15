/** Botão que gera um PDF no aparelho e abre (ou baixa), mostrando o progresso. */
import { useState } from 'react';
import { abrirPdf } from '../modulos/doacao/pdf';
import { Icone } from './Icone';

export function BotaoPdf({ rotulo, nome, gerar, className = 'botao-secundario' }: { rotulo: string; nome: string; gerar: (progresso: (feitas: number, total: number) => void) => Promise<Blob>; className?: string }) {
  const [estado, setEstado] = useState('');
  const [erro, setErro] = useState('');
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={!!estado}
        onClick={async () => {
          setErro('');
          setEstado('Preparando o PDF…');
          try {
            abrirPdf(await gerar((f, t) => setEstado(t > 1 ? `Preparando o PDF… ${f} de ${t}` : 'Preparando o PDF…')), nome);
          } catch (e) {
            setErro(`Não foi possível gerar o PDF: ${(e as Error).message}`);
          } finally {
            setEstado('');
          }
        }}
      >
        <Icone nome="baixar" /> {estado || rotulo}
      </button>
      {erro && <p className="erro">{erro}</p>}
    </>
  );
}
