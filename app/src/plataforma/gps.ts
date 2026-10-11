/**
 * GPS do aparelho. Funciona sem internet (usa o satélite); só demora mais
 * para achar o primeiro ponto. Vai melhorando a precisão por alguns segundos.
 */
export interface PosicaoGps {
  lat: number;
  lon: number;
  precisao_m: number;
  altitude: number | null;
  em: string;
}

export function gpsDisponivel(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Acompanha a posição e chama `aoAtualizar` a cada leitura melhor.
 * Devolve uma função para parar.
 */
export function acompanharPosicao(aoAtualizar: (p: PosicaoGps) => void, aoErro: (mensagem: string) => void): () => void {
  if (!gpsDisponivel()) {
    aoErro('Este aparelho não tem GPS disponível no navegador.');
    return () => {};
  }
  let melhor = Infinity;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      if (pos.coords.accuracy > melhor) return;
      melhor = pos.coords.accuracy;
      aoAtualizar({
        lat: Number(pos.coords.latitude.toFixed(7)),
        lon: Number(pos.coords.longitude.toFixed(7)),
        precisao_m: Math.round(pos.coords.accuracy),
        altitude: pos.coords.altitude === null ? null : Math.round(pos.coords.altitude),
        em: new Date(pos.timestamp).toISOString(),
      });
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) aoErro('O GPS está bloqueado para o CRADS. Libere a localização nas configurações do navegador.');
      else if (err.code === err.TIMEOUT) aoErro('O GPS está demorando. Vá para um lugar mais aberto, longe da copa das árvores.');
      else aoErro('Não foi possível ler o GPS. Confira se a localização do aparelho está ligada.');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 60_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Uma leitura só (para foto): a melhor em até `ms` milissegundos. */
export function lerPosicao(ms = 8_000): Promise<PosicaoGps | null> {
  return new Promise((ok) => {
    let ultima: PosicaoGps | null = null;
    const parar = acompanharPosicao(
      (p) => (ultima = p),
      () => {},
    );
    setTimeout(() => {
      parar();
      ok(ultima);
    }, ms);
  });
}
