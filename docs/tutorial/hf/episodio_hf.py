#!/usr/bin/env python3
"""
Episódio do manual em vídeo, versão HyperFrames (HTML animado com GSAP,
renderizado pelo HyperFrames). Gera um projeto HyperFrames completo:

  - index.html: uma composição vertical 1080x1920 com o celular fixo, as
    telas trocando com fusão, a "câmera" aproximando do botão, o resto da
    tela escurecendo, um dedo que toca o botão e legendas palavra a palavra;
  - assets/: telas do app, logo, fonte Inter, GSAP local e o áudio já
    masterizado (voz Kokoro + trilha própria abaixando sob a voz, -14 LUFS).

Uso:
  python3 episodio_hf.py --roteiro ../episodios/03-matriz.json --telas <pasta das telas> \
      --voz <pasta kokoro> --projeto <pasta do projeto>
  cd <pasta do projeto> && npx hyperframes check && npx hyperframes render . -o video.mp4
"""
import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
import montar_video as mv  # noqa: E402  (voz, pronúncia e trilha compartilhadas)

RAIZ = AQUI.parent.parent.parent
L, A, FPS = 1080, 1920, 30
# tela do celular na composição (as capturas são 1081x1999)
TELA_L = 660
VERDE, AZUL, AZUL_ESCURO = '#48672f', '#259ad4', '#33618d'


# ------------------------------------------------------------------ áudio

def frases_da(fala: str) -> list[str]:
    return [f for f in re.split(r'(?<=[.!?])\s+', fala.strip()) if f]


def gerar_voz(cenas, voz_dir, falante, velocidade):
    """Fala cena por cena, frase por frase: devolve o áudio (24 kHz) e, por cena, o início e a duração de cada frase."""
    import sherpa_onnx

    d = Path(voz_dir)
    modelo = sherpa_onnx.OfflineTtsKokoroModelConfig(model=str(d / 'model.onnx'), voices=str(d / 'voices.bin'), tokens=str(d / 'tokens.txt'),
                                                      data_dir=str(d / 'espeak-ng-data'), lexicon='', lang='pt-br')
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=modelo, num_threads=4)))
    taxa = 24000
    pausa = np.zeros(int(taxa * 0.18), dtype=np.float32)
    trechos, mapa = [], []
    for c in cenas:
        partes, tempos, t = [], [], 0.0
        for frase in frases_da(c['fala']):
            a = tts.generate(mv.para_falar(mv.sem_colchetes(frase)), sid=falante, speed=velocidade)
            s = np.array(a.samples, dtype=np.float32)
            # corta o silêncio do começo e do fim da frase (deixa o ritmo enxuto)
            vivo = np.where(np.abs(s) > 0.01)[0]
            if len(vivo):
                s = s[max(0, vivo[0] - 600): vivo[-1] + 1200]
            tempos.append((frase, t, len(s) / taxa))
            partes += [s, pausa]
            t += (len(s) + len(pausa)) / taxa
        trechos.append(np.concatenate(partes[:-1]))
        mapa.append(tempos)
    return trechos, mapa, taxa


def palavras_com_tempo(frase: str, ini: float, dur: float):
    """Tempo de cada palavra dentro da frase (proporcional ao tamanho); [Botão] conta como uma unidade."""
    unidades = []
    for parte in re.split(r'(\[[^\]]+\])', frase):
        if parte.startswith('['):
            unidades.append((parte[1:-1], True))
        else:
            for p in parte.split():
                if unidades and re.fullmatch(r'[.,:;!?]+', p):
                    u, b = unidades[-1]
                    unidades[-1] = (u + p, b) if not b else (u, b)
                    if b:
                        unidades.append((p, False))
                else:
                    unidades.append((p, False))
    pesos = [len(u) + 2 for u, _ in unidades]
    total = sum(pesos)
    t, out = ini, []
    for (u, botao), p in zip(unidades, pesos):
        out.append((u, botao, t))
        t += dur * p / total
    return out


def masterizar(voz: np.ndarray, taxa_voz: int, total_s: float, pasta: Path) -> Path:
    """Voz + trilha (que abaixa sob a fala) num só arquivo, masterizado a -14 LUFS / -1 dBTP (duas passadas)."""
    bruta, pronta = pasta / 'voz-bruta.wav', pasta / 'voz.wav'
    with wave.open(str(bruta), 'w') as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(taxa_voz)
        w.writeframes((np.clip(voz, -1, 1) * 32767).astype(np.int16).tobytes())
    mv.preparar_voz(bruta, pronta)
    fala = mv.ler_wav(pronta)
    n = int(total_s * mv.TAXA)
    fala = np.pad(fala, (0, max(0, n - len(fala))))[:n]
    fala = fala / (np.max(np.abs(fala)) + 1e-9) * 0.8
    musica = mv.trilha(n)
    falando = np.clip(mv.suavizar((np.abs(fala) > 0.02).astype(np.float32), 0.6) * 4, 0, 1)
    mix = fala + musica * (0.16 - 0.11 * falando)
    mix = np.clip(mix / max(1.0, np.max(np.abs(mix)) / 0.95), -1, 1)
    crua = pasta / 'mix.wav'
    with wave.open(str(crua), 'w') as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(mv.TAXA)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    med = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(crua), '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = json.loads(med[med.rindex('{'): med.rindex('}') + 1])
    final = pasta / 'trilha.wav'
    filtro = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
              f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=44100")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(crua), '-af', filtro, '-ac', '2', str(final)], check=True)
    for f in (bruta, pronta, crua):
        f.unlink()
    return final


# ------------------------------------------------------------------ HTML

def legenda_html(cid: str, frase_tempos, base: float) -> tuple[str, list[str]]:
    """Spans da legenda e os tweens que acendem cada palavra no tempo da fala."""
    spans, tweens, k = [], [], 0
    for frase, ini, dur in frase_tempos:
        for palavra, botao, t in palavras_com_tempo(frase, ini, dur):
            pid = f'{cid}-p{k}'
            k += 1
            cls = 'pal botao' if botao else 'pal'
            spans.append(f'<span id="{pid}" class="{cls}">{html.escape(palavra)}</span>')
            tweens.append(f'tl.to("#{pid}", {{opacity: 1, duration: 0.12, ease: "power1.out"}}, {base + t:.3f});')
    texto = ' '.join(spans)
    texto = re.sub(r'</span> (<span id="[^"]+" class="pal">[.,:;!?]+</span>)', r'</span>\1', texto)
    return texto, tweens


DEDO = """<svg viewBox="0 0 120 150" width="120" height="150" aria-hidden="true">
  <path d="M47 10c-7 0-12 5-12 12v62l-9-10c-5-6-14-6-19-1s-5 13 0 18l32 38c6 7 15 11 24 11h22c18 0 31-14 31-31V69c0-6-5-11-11-11s-11 5-11 11v-6c0-6-5-11-11-11s-11 5-11 11v-3c0-6-5-11-11-11-3 0-6 1-8 3V22c0-7-5-12-12-12z"
    fill="#ffffff" stroke="#33618d" stroke-width="6" stroke-linejoin="round"/>
</svg>"""


def montar(roteiro, telas: Path, alvos: dict, mapa, duracoes, inicios, total: float, ep_rotulo: str) -> str:
    escala = TELA_L / 1081
    tela_a = round(1999 * escala)
    cenas_html, tl = [], []
    sobrepor = 0.35  # fusão entre telas
    for n, c in enumerate(roteiro['cenas']):
        cid = f'c{n:02d}'
        ini, dur = inicios[n], duracoes[n]
        fala_ini = 0.35 if c['tipo'] != 'tela' else 0.2
        if c['tipo'] in ('abertura', 'fim'):
            ini_v = max(0, ini - (sobrepor if n else 0))
            titulo = html.escape(c['titulo'])
            sub = html.escape(c.get('subtitulo', ''))
            cenas_html.append(f'''
      <section id="{cid}" class="clip cartao" data-start="{ini_v:.3f}" data-duration="{dur + (ini - ini_v):.3f}" data-track-index="{2 + n % 2}">
        <div id="{cid}-fundo" class="cartao-fundo">
          <img id="{cid}-logo" class="logo" src="assets/logo-completa.png" alt="" />
          <h1 id="{cid}-titulo" class="cartao-titulo">{titulo}</h1>
          <p id="{cid}-sub" class="cartao-sub">{sub}</p>
          <div class="ondas"><div class="onda1"></div><div class="onda2"></div></div>
        </div>
      </section>''')
            t0 = ini_v
            tl += [
                f'tl.fromTo("#{cid}-fundo", {{opacity: 0}}, {{opacity: 1, duration: 0.35, ease: "power1.out"}}, {t0:.3f});',
                f'tl.fromTo("#{cid}-logo", {{scale: 0.6, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.6)"}}, {t0 + 0.1:.3f});',
                f'tl.fromTo("#{cid}-titulo", {{y: 60, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.6, ease: "power3.out"}}, {t0 + 0.45:.3f});',
                f'tl.fromTo("#{cid}-sub", {{y: 40, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.6, ease: "power3.out"}}, {t0 + 0.7:.3f});',
            ]
            continue

        # --- cena com tela do app
        ini_v = ini - sobrepor
        imagem = c['imagem']
        alvo = alvos.get(imagem)
        legenda, tweens_leg = legenda_html(cid, mapa[n], ini + fala_ini)
        spot = dedo = ''
        tx = ty = None
        if alvo:
            ax, ay, aw, ah = (alvo[k] * escala for k in ('x', 'y', 'w', 'h'))
            # caixa do destaque (com folga), dentro da tela
            x0, y0 = max(4, ax - 10), max(4, ay - 10)
            x1, y1 = min(TELA_L - 4, ax + aw + 10), min(tela_a - 4, ay + ah + 10)
            tx, ty = (x0 + x1) / 2, (y0 + y1) / 2
            # o dedo toca o lado direito de botões largos (não cobre o texto); nos redondos, o centro
            dx = tx + min(0.25 * (x1 - x0), 120) if (x1 - x0) > 300 else tx
            spot = f'<div id="{cid}-spot" class="spot" style="left:{x0:.0f}px;top:{y0:.0f}px;width:{x1 - x0:.0f}px;height:{y1 - y0:.0f}px"></div>'
            dedo = (f'<div id="{cid}-onda" class="onda-toque" style="left:{dx - 60:.0f}px;top:{ty - 60:.0f}px"></div>'
                    f'<div id="{cid}-dedo" class="dedo" style="left:{dx - 47:.0f}px;top:{ty - 12:.0f}px">{DEDO}</div>')
        cenas_html.append(f'''
      <section id="{cid}" class="clip cena" data-start="{ini_v:.3f}" data-duration="{dur + sobrepor:.3f}" data-track-index="{2 + n % 2}">
        <div id="{cid}-entra" class="entra">
          <h2 id="{cid}-titulo" class="titulo" data-layout-allow-overlap>{html.escape(c['titulo'])}</h2>
          <div class="celular"><div class="tela" data-layout-allow-overflow>
            <div id="{cid}-cam" class="cam">
              <img src="assets/telas/{imagem}" alt="" class="captura" />
              {spot}{dedo}
            </div>
          </div></div>
          <p id="{cid}-leg" class="legenda" data-layout-allow-overlap>{legenda}</p>
        </div>
      </section>''')
        tl.append(f'tl.fromTo("#{cid}-entra", {{opacity: 0}}, {{opacity: 1, duration: {sobrepor}, ease: "power1.inOut"}}, {ini_v:.3f});')
        tl.append(f'tl.fromTo("#{cid}-titulo", {{y: 24, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.45, ease: "power3.out"}}, {ini_v + 0.1:.3f});')
        tl += tweens_leg
        if alvo:
            # câmera aproxima do botão; o resto escurece; o dedo entra e toca
            # quanto mais largo o alvo, menos zoom (não corta o texto do item)
            larg = x1 - x0
            zoom = 1.06 if larg > 500 or (y1 - y0) > 400 else 1.15 if larg > 300 else 1.32
            tl.append(f'tl.fromTo("#{cid}-cam", {{scale: 1}}, {{scale: {zoom}, transformOrigin: "{tx:.0f}px {ty:.0f}px", duration: 0.9, ease: "power2.inOut"}}, {ini + 0.15:.3f});')
            tl.append(f'tl.fromTo("#{cid}-spot", {{opacity: 0}}, {{opacity: 1, duration: 0.4, ease: "power1.out"}}, {ini + 0.35:.3f});')
            tl.append(f'tl.fromTo("#{cid}-dedo", {{x: 260, y: 380, opacity: 0, rotation: -12}}, {{x: 0, y: 0, opacity: 1, rotation: 0, duration: 0.7, ease: "power3.out"}}, {ini + 0.55:.3f});')
            toque = ini + 1.3
            tl.append(f'tl.to("#{cid}-dedo", {{scale: 0.88, duration: 0.12, ease: "power1.in", yoyo: true, repeat: 1, transformOrigin: "40% 10%"}}, {toque:.3f});')
            tl.append(f'tl.fromTo("#{cid}-onda", {{scale: 0.2, opacity: 0.85}}, {{scale: 1.6, opacity: 0, duration: 0.7, ease: "power2.out"}}, {toque + 0.08:.3f});')
            tl.append(f'tl.to("#{cid}-dedo", {{x: 160, y: 260, opacity: 0, duration: 0.5, ease: "power2.in"}}, {max(toque + 0.9, ini + dur - 0.7):.3f});')

    # barra de progresso e rótulo do episódio (fixos)
    tl.append(f'tl.fromTo("#progresso", {{scaleX: 0}}, {{scaleX: 1, duration: {total:.3f}, ease: "none", transformOrigin: "0 50%"}}, 0);')
    corpo = '\n'.join(cenas_html)
    script = '\n      '.join(tl)
    return f'''<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={L}, height={A}" />
    <title>{html.escape(roteiro['titulo'])}</title>
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Inter"; src: url("assets/inter.woff2") format("woff2"); font-weight: 100 900; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {L}px; height: {A}px; overflow: hidden; background: #eef6fb; font-family: "Inter", sans-serif; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: linear-gradient(180deg, #f6fbfe 0%, #e3f0f9 100%); }}
      .topo {{ position: absolute; left: 0; right: 0; top: 0; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
      .barra {{ position: absolute; left: 0; right: 0; top: 0; height: 12px; background: #cde1ee; }}
      #progresso {{ display: block; width: 100%; height: 100%; background: {VERDE}; }}
      .rotulo {{ font-size: 30px; font-weight: 800; letter-spacing: 0.04em; color: {AZUL}; text-transform: uppercase; margin-top: 18px; }}
      .clip {{ position: absolute; inset: 0; }}
      .entra {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 120px; }}
      .titulo {{ height: 150px; display: flex; align-items: center; font-size: 72px; font-weight: 900; color: {AZUL_ESCURO}; letter-spacing: -0.01em; text-align: center; max-width: 960px; line-height: 1.05; }}
      .celular {{ width: {TELA_L + 32}px; height: {tela_a + 32}px; padding: 16px; border-radius: 64px; background: {AZUL_ESCURO}; box-shadow: 0 30px 60px rgba(31, 60, 90, 0.28); }}
      .tela {{ position: relative; width: {TELA_L}px; height: {tela_a}px; border-radius: 48px; overflow: hidden; background: #fff; }}
      .cam {{ position: absolute; left: 0; top: 0; width: {TELA_L}px; height: {tela_a}px; }}
      .captura {{ display: block; width: {TELA_L}px; height: {tela_a}px; }}
      .spot {{ position: absolute; border-radius: 22px; box-shadow: 0 0 0 6px #fff, 0 0 0 14px {VERDE}, 0 0 0 2400px rgba(10, 25, 40, 0.45); }}
      .dedo {{ position: absolute; width: 120px; height: 150px; filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.3)); }}
      .onda-toque {{ position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 8px solid #fff; background: rgba(255, 255, 255, 0.25); }}
      .legenda {{ margin-top: 40px; max-width: 980px; text-align: center; font-size: 46px; font-weight: 600; line-height: 1.42; color: {AZUL_ESCURO}; }}
      .pal {{ display: inline-block; opacity: 0.22; }}
      .pal.botao {{ background: {VERDE}; color: #fff; border-radius: 40px; padding: 0 20px; font-weight: 700; }}
      .cartao-fundo {{ position: absolute; inset: 0; background: #fff; display: flex; flex-direction: column; align-items: center; padding-top: 300px; }}
      .logo {{ display: block; height: 620px; width: auto; }}
      .cartao-titulo {{ margin-top: 70px; font-size: 104px; font-weight: 900; color: {VERDE}; text-align: center; max-width: 960px; line-height: 1.05; }}
      .cartao-sub {{ margin-top: 30px; font-size: 50px; font-weight: 600; color: {AZUL_ESCURO}; text-align: center; max-width: 920px; }}
      .ondas {{ position: absolute; left: 0; right: 0; bottom: 0; height: 120px; }}
      .onda1 {{ position: absolute; left: 0; right: 0; bottom: 60px; height: 60px; background: {AZUL}; }}
      .onda2 {{ position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: {AZUL_ESCURO}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="{L}" data-height="{A}">
      <audio id="trilha" src="assets/trilha.wav" data-start="0" data-duration="{total:.3f}" data-track-index="0" data-volume="1"></audio>
      <div class="topo"><div class="barra"><div id="progresso"></div></div><div class="rotulo">{html.escape(ep_rotulo)}</div></div>
{corpo}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      {script}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--roteiro', required=True, type=Path)
    p.add_argument('--telas', required=True, type=Path)
    p.add_argument('--voz', required=True)
    p.add_argument('--projeto', required=True, type=Path)
    p.add_argument('--falante', type=int, default=42)
    p.add_argument('--velocidade', type=float, default=1.0)
    a = p.parse_args()
    roteiro = json.loads(a.roteiro.read_text(encoding='utf-8'))
    alvos = {c['imagem']: c['alvo'] for c in json.loads((a.telas / 'cenas.json').read_text())['cenas']}
    proj = a.projeto
    (proj / 'assets' / 'telas').mkdir(parents=True, exist_ok=True)

    # voz, cena por cena; a duração de cada cena acompanha a fala (mínimo 2,6 s para o toque)
    trechos, mapa, taxa = gerar_voz(roteiro['cenas'], a.voz, a.falante, a.velocidade)
    duracoes, inicios, t = [], [], 0.0
    for c, tr in zip(roteiro['cenas'], trechos):
        antes = 0.35 if c['tipo'] != 'tela' else 0.2
        depois = 1.1 if c['tipo'] == 'fim' else 0.45
        d = max(antes + len(tr) / taxa + depois, 2.6 if c['tipo'] == 'tela' else 2.2)
        inicios.append(t)
        duracoes.append(d)
        t += d
    total = t
    voz = np.zeros(int(total * taxa) + taxa, dtype=np.float32)
    for c, tr, ini in zip(roteiro['cenas'], trechos, inicios):
        k = int((ini + (0.35 if c['tipo'] != 'tela' else 0.2)) * taxa)
        voz[k:k + len(tr)] += tr
    masterizar(voz, taxa, total, proj / 'assets')

    # arquivos da composição
    for c in roteiro['cenas']:
        if c.get('imagem'):
            shutil.copy(a.telas / c['imagem'], proj / 'assets' / 'telas' / c['imagem'])
    shutil.copy(RAIZ / 'app/public/marca/logo-completa.png', proj / 'assets' / 'logo-completa.png')
    shutil.copy(RAIZ / 'app/src/fontes/inter-latin-wght-normal.woff2', proj / 'assets' / 'inter.woff2')
    gsap = AQUI / 'node_modules/gsap/dist/gsap.min.js'
    if not gsap.exists():
        sys.exit('Falta o GSAP: rode npm install em docs/tutorial/hf')
    shutil.copy(gsap, proj / 'assets' / 'gsap.min.js')
    (proj / 'index.html').write_text(montar(roteiro, a.telas, alvos, mapa, duracoes, inicios, total, roteiro.get('rotulo', '')), encoding='utf-8')
    (proj / 'hyperframes.json').write_text(json.dumps({'name': a.roteiro.stem}, indent=2))
    print(f'Projeto pronto: {proj} ({total:.1f} s, {len(roteiro["cenas"])} cenas)')


if __name__ == '__main__':
    main()
