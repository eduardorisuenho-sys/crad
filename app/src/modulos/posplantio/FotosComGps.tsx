/** Fotos tiradas no local, cada uma com o ponto do GPS do momento. */
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { Icone } from '../../componentes/Icone';
import { MiniaturaBlob } from '../../componentes/Miniatura';
import type { PosicaoGps } from '../../plataforma/gps';
import { prepararFoto, type FotoPendente } from '../matrizes/fotos';

export function FotosComGps({ fotos, aoMudar, gps, parte = 'outro' }: { fotos: FotoPendente[]; aoMudar: (f: FotoPendente[]) => void; gps: PosicaoGps | null; parte?: string }) {
  return (
    <div className="assistente">
      <div className="galeria">
        {fotos.map((f, i) => (
          <figure key={i}>
            <MiniaturaBlob blob={f.miniatura} alt={`Foto ${i + 1}`} data={f.tirada_em} />
            <figcaption>{f.gps ? `GPS ±${f.gps.precisao_m} m` : 'sem GPS'}</figcaption>
          </figure>
        ))}
      </div>
      <BotaoFoto aoEscolher={async (arq) => aoMudar([...fotos, await prepararFoto(arq, parte, gps)])}>
        <Icone nome="mais" tamanho={36} />
        <span>{fotos.length ? 'Tirar mais uma foto' : 'Tirar foto'}</span>
      </BotaoFoto>
      <p className="dica">{gps ? `GPS ligado (±${gps.precisao_m} m): as fotos guardam o ponto.` : 'Procurando o GPS… as fotos sem GPS ficam marcadas para conferência.'}</p>
    </div>
  );
}
