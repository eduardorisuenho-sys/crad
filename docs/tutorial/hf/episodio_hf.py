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
TELA_L = 800
VERDE, AZUL, AZUL_ESCURO = '#48672f', '#259ad4', '#33618d'
# nomes dos perfis como aparecem no app (Equipe)
PERFIL = {'todos': 'Todos', 'coletor': 'Coletor', 'viveirista': 'Viveirista', 'gestor': 'Gestor', 'solicitante': 'Solicitante'}


# ------------------------------------------------------------------ áudio

def frases_da(fala: str) -> list[str]:
    return [f for f in re.split(r'(?<=[.!?])\s+', fala.strip()) if f]


def carregar_voz(voz_dir, falante, velocidade):
    """Voz neural de código aberto pelo sherpa-onnx; o motor sai da pasta do modelo (Supertonic, Piper ou Kokoro).
    Devolve uma função texto -> (amostras, taxa)."""
    import sherpa_onnx

    d = Path(voz_dir)
    if (d / 'tts.json').exists():
        m = sherpa_onnx.OfflineTtsModelConfig(supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
            duration_predictor=str(d / 'duration_predictor.int8.onnx'), text_encoder=str(d / 'text_encoder.int8.onnx'),
            vector_estimator=str(d / 'vector_estimator.int8.onnx'), vocoder=str(d / 'vocoder.int8.onnx'), tts_json=str(d / 'tts.json'),
            unicode_indexer=str(d / 'unicode_indexer.bin'), voice_style=str(d / 'voice.bin')), num_threads=4)
    elif (d / 'voices.bin').exists():
        m = sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=str(d / 'model.onnx'), voices=str(d / 'voices.bin'), tokens=str(d / 'tokens.txt'),
            data_dir=str(d / 'espeak-ng-data'), lexicon='', lang='pt-br'), num_threads=4)
    else:
        m = sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=str(next(d.glob('*.onnx'))), tokens=str(d / 'tokens.txt'), data_dir=str(d / 'espeak-ng-data')), num_threads=4)
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=m))

    def falar(texto):
        g = sherpa_onnx.GenerationConfig()
        g.sid, g.speed = falante, velocidade
        if m.supertonic.vocoder:
            g.num_steps = 32
            g.extra['lang'] = 'pt'
        a = tts.generate(texto, g)
        return np.array(a.samples, dtype=np.float32), a.sample_rate
    return falar


def _ler_audio(arq: Path):
    with wave.open(str(arq)) as w:
        taxa, dados = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return dados.astype(np.float32) / 32768, taxa


CACHE_VOZ = Path.home() / '.cache' / 'crads-voz'


def _chave(ref, texto: str) -> Path:
    import hashlib

    h = hashlib.sha1(Path(ref).read_bytes() + texto.encode('utf-8')).hexdigest()[:20]
    return CACHE_VOZ / f'{h}.wav'


def _clonar(textos, ref, python_voz, whisper):
    """Chatterbox (ambiente próprio): uma chamada para todas as frases. Com --whisper, confere cada frase
    com o reconhecedor de fala e refaz (outra semente) a que sair diferente do texto, até duas vezes.
    Frase aprovada fica guardada (mesma referência + mesmo texto = mesmo áudio): ajustar o vídeo não refaz a voz."""
    import tempfile

    CACHE_VOZ.mkdir(parents=True, exist_ok=True)
    pasta = Path(tempfile.mkdtemp(prefix='voz-'))
    prontas = {k: _ler_audio(_chave(ref, t)) for k, t in enumerate(textos) if _chave(ref, t).exists()}
    pendentes = {f'f{k:03d}': (t, 1) for k, t in enumerate(textos) if k not in prontas}
    conferir = mv.reconhecedor(whisper) if whisper and pendentes else None
    melhor: dict[str, tuple[float, Path]] = {}  # a tentativa com menos erro de cada frase
    for rodada in range(4):
        if not pendentes:
            break
        pedido = pasta / 'pedido.json'
        pedido.write_text(json.dumps([{'id': i, 'texto': t, 'semente': sem} for i, (t, sem) in pendentes.items()], ensure_ascii=False))
        subprocess.run([python_voz, str(AQUI / 'voz_chatterbox.py'), '--ref', str(ref), '--pedido', str(pedido), '--saida', str(pasta)], check=True)
        refazer = {}
        for i, (t, sem) in pendentes.items():
            tentativa = pasta / f'{i}-{sem}.wav'
            shutil.move(pasta / f'{i}.wav', tentativa)
            erro = mv.taxa_de_erro(t, conferir(*_ler_audio(tentativa))) if conferir else 0.0
            if i not in melhor or erro < melhor[i][0]:
                melhor[i] = (erro, tentativa)
            if erro > 0.2:
                print(f'  refazendo ({erro:.0%} diferente): {t}')
                refazer[i] = (t, sem + 1)
        pendentes = refazer
    for i, (erro, arq) in melhor.items():
        t = textos[int(i[1:])]
        if erro > 0.2:
            print(f'  ATENÇÃO, ficou {erro:.0%} diferente (ouça): {t}')
        prontas[int(i[1:])] = _ler_audio(arq)
        shutil.copy(arq, _chave(ref, t))
    return [prontas[k] for k in range(len(textos))]


def _enxugar(s: np.ndarray, taxa: int, pausa_max: float = 0.3, ritmo: float = 1.08) -> np.ndarray:
    """Voz clonada: encurta pausas internas longas (vírgulas) e acelera um pouco sem mudar o tom."""
    n = int(taxa * 0.02)
    energia = np.sqrt((s[: len(s) // n * n].reshape(-1, n) ** 2).mean(1))
    quieto = energia < 0.005
    manter = np.ones(len(s), dtype=bool)
    k, limite = 0, int(pausa_max / 0.02)
    while k < len(quieto):
        if quieto[k]:
            j = k
            while j < len(quieto) and quieto[j]:
                j += 1
            if j - k > limite:
                corte = (j - k - limite) * n
                ini = k * n + (limite // 2) * n
                manter[ini: ini + corte] = False
            k = j
        else:
            k += 1
    s = s[manter]
    if abs(ritmo - 1) < 1e-3:
        return s
    r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(taxa), '-ac', '1', '-i', '-', '-af', f'atempo={ritmo}',
                        '-f', 'f32le', '-'], input=s.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def gerar_voz(cenas, voz, falante, velocidade, python_voz='python3', whisper=None):
    """Fala cena por cena, frase por frase: devolve o áudio e, por cena, o início e a duração de cada frase.
    `voz` é a pasta de um modelo do sherpa-onnx ou uma gravação .wav de referência (voz clonada pelo Chatterbox)."""
    frases = [[f for f in frases_da(c['fala'])] for c in cenas]
    textos = [mv.para_falar(mv.sem_colchetes(f)) for fs in frases for f in fs]
    if str(voz).endswith('.wav'):
        audios = [(_enxugar(a, t), t) for a, t in _clonar(textos, voz, python_voz, whisper)]
    else:
        falar = carregar_voz(voz, falante, velocidade)
        audios = [falar(t) for t in textos]
    taxa = audios[0][1]
    pausa = np.zeros(int(taxa * 0.18), dtype=np.float32)
    trechos, mapa, k = [], [], 0
    for fs in frases:
        partes, tempos, t = [], [], 0.0
        for frase in fs:
            s = audios[k][0]
            k += 1
            # corta o silêncio do começo e do fim da frase (deixa o ritmo enxuto)
            vivo = np.where(np.abs(s) > 0.01)[0]
            if len(vivo):
                s = s[max(0, vivo[0] - int(taxa * 0.025)): vivo[-1] + int(taxa * 0.05)]
            tempos.append((frase, t, len(s) / taxa))
            partes += [s, pausa]
            t += (len(s) + len(pausa)) / taxa
        trechos.append(np.concatenate(partes[:-1]))
        mapa.append(tempos)
    return trechos, mapa, taxa


def palavras_com_tempo(frase: str, ini: float, dur: float):
    """Tempo de cada palavra dentro da frase (proporcional ao tamanho); [Botão] conta como uma unidade.
    {texto} marca um toque que não é nome de botão (ex.: "{a matriz da lista}"): aparece como texto comum."""
    unidades = []
    for parte in re.split(r'(\[[^\]]+\]|\{[^}]+\})', frase):
        if parte.startswith('['):
            unidades.append((parte[1:-1], True))
        elif parte.startswith('{'):
            unidades.append((parte[1:-1], 'alvo'))
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


def masterizar(voz: np.ndarray, taxa_voz: int, total_s: float, pasta: Path, limpar: bool = True) -> Path:
    """Voz + trilha (que abaixa sob a fala) num só arquivo, masterizado a -14 LUFS / -1 dBTP (duas passadas)."""
    bruta, pronta = pasta / 'voz-bruta.wav', pasta / 'voz.wav'
    with wave.open(str(bruta), 'w') as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(taxa_voz)
        w.writeframes((np.clip(voz, -1, 1) * 32767).astype(np.int16).tobytes())
    mv.preparar_voz(bruta, pronta, limpar)
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
    def medir(arq):
        med = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(arq), '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
        return json.loads(med[med.rindex('{'): med.rindex('}') + 1])
    # sobe o volume até perto do alvo segurando os picos num limitador; a passada linear depois só acerta o detalhe
    ganho = -14 - float(medir(crua)['input_i'])
    limitada = pasta / 'mix-lim.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(crua), '-af',
                    f'aresample=176400,volume={ganho:.2f}dB,alimiter=limit=0.8:attack=2:release=60:level=false,aresample={mv.TAXA}',
                    '-c:a', 'pcm_s16le', str(limitada)], check=True)
    crua.unlink()
    crua = limitada
    m = medir(crua)
    final = pasta / 'trilha.wav'
    filtro = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
              f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=44100")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(crua), '-af', filtro, '-ac', '2', str(final)], check=True)
    for f in (bruta, pronta, crua):
        f.unlink()
    return final


# ------------------------------------------------------------------ HTML

def legenda_html(cid: str, frase_tempos, base: float):
    """Spans da legenda, os tweens que acendem cada palavra no tempo da fala e o tempo de cada [Botão] dito."""
    unidades = []
    for frase, ini, dur in frase_tempos:
        unidades += palavras_com_tempo(frase, ini, dur)
    spans, tweens, botoes = [], [], []
    for k, (palavra, botao, t) in enumerate(unidades):
        pid = f'{cid}-p{k}'
        cls = 'pal botao' if botao is True else 'pal'
        spans.append(f'<span id="{pid}" class="{cls}">{html.escape(palavra)}</span>')
        quando = base + t
        if botao == 'alvo':
            botoes.append(quando)
        if botao is True:
            botoes.append(quando)
            tweens.append(f'tl.fromTo("#{pid}", {{scale: 1}}, {{scale: 1.08, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out"}}, {quando:.3f});')
        else:
            prox = base + unidades[k + 1][2] if k + 1 < len(unidades) else quando + 0.5
            # a palavra da vez acende em azul; depois fica no azul-escuro
            tweens.append(f'tl.to("#{pid}", {{opacity: 1, backgroundColor: "rgba(37, 154, 212, 0.22)", duration: 0.08}}, {quando:.3f});')
            tweens.append(f'tl.to("#{pid}", {{backgroundColor: "rgba(37, 154, 212, 0)", duration: 0.15}}, {max(quando + 0.1, prox):.3f});')
    texto = ' '.join(spans)
    texto = re.sub(r'</span> (<span id="[^"]+" class="pal">[.,:;!?]+</span>)', r'</span>\1', texto)
    # a pontuação depois de um botão não pode cair sozinha no começo da linha
    texto = re.sub(r'(<span id="[^"]+" class="pal botao">[^<]*</span>)(<span id="[^"]+" class="pal">[.,:;!?]+</span>)',
                   r'<span class="junto">\1\2</span>', texto)
    return texto, tweens, botoes


DEDO = """<svg viewBox="0 0 120 150" width="120" height="150" aria-hidden="true">
  <path d="M47 10c-7 0-12 5-12 12v62l-9-10c-5-6-14-6-19-1s-5 13 0 18l32 38c6 7 15 11 24 11h22c18 0 31-14 31-31V69c0-6-5-11-11-11s-11 5-11 11v-6c0-6-5-11-11-11s-11 5-11 11v-3c0-6-5-11-11-11-3 0-6 1-8 3V22c0-7-5-12-12-12z"
    fill="#ffffff" stroke="#33618d" stroke-width="6" stroke-linejoin="round"/>
</svg>"""

BEZEL = 16
CEL_X, CEL_Y = None, 230  # x calculado pelo tamanho


def caixa_tela(alvo, escala, tela_a):
    ax, ay, aw, ah = (alvo[k] * escala for k in ('x', 'y', 'w', 'h'))
    x0, y0 = max(4, ax - 12), max(4, ay - 12)
    x1, y1 = min(TELA_L - 4, ax + aw + 12), min(tela_a - 4, ay + ah + 12)
    return x0, y0, x1, y1


def ponta_do_dedo(x0, y0, x1, y1):
    """Onde a ponta do dedo toca: terço esquerdo de botões largos, o ícone de blocos altos, senão o centro (nunca em cima do texto)."""
    w, h = x1 - x0, y1 - y0
    if w > 300:
        return x0 + 0.3 * w, (y0 + y1) / 2
    if h > 0.8 * w and h > 150:
        # à direita do ícone: o corpo do dedo desce para a direita, longe do nome embaixo
        return (x0 + x1) / 2 + 0.22 * w, y0 + 0.3 * h
    return (x0 + x1) / 2, (y0 + y1) / 2


def montar(roteiro, telas: Path, alvos: dict, mapa, duracoes, inicios, total: float, ep_rotulo: str) -> str:
    escala = TELA_L / 1081
    tela_a = round(1999 * escala)
    cel_w, cel_h = TELA_L + 2 * BEZEL, tela_a + 2 * BEZEL
    cel_x = (L - cel_w) // 2
    n_ep = int(re.search(r'Episódio (\d+)', ep_rotulo).group(1)) if re.search(r'Episódio (\d+)', ep_rotulo) else None
    cenas_html, textos_html, tl = [], [], []
    TROCA = 0.3  # sobreposição entre cenas (saída + entrada)
    for n, c in enumerate(roteiro['cenas']):
        cid = f'c{n:02d}'
        ini, dur = inicios[n], duracoes[n]
        fim = ini + dur
        ini_v = ini - TROCA if n else 0.0
        ultima = n == len(roteiro['cenas']) - 1
        anterior_cartao = n > 0 and roteiro['cenas'][n - 1]['tipo'] in ('abertura', 'fim')
        fala_ini = 0.35 if c['tipo'] != 'tela' else 0.2
        if c['tipo'] in ('abertura', 'fim'):
            titulo = html.escape(c['titulo'])
            sub = c.get('subtitulo', '')
            if c['tipo'] == 'fim' and sub.startswith('Próximo:') and n_ep:
                extra = (f'<p id="{cid}-prox" class="prox">PRÓXIMO · EPISÓDIO {n_ep + 1}</p>'
                         f'<p id="{cid}-sub" class="prox-nome">{html.escape(sub.split(":", 1)[1].strip())}</p>')
            else:
                extra = f'<p id="{cid}-sub" class="cartao-sub">{html.escape(sub)}</p>'
                if c['tipo'] == 'abertura' and roteiro.get('perfis'):
                    extra += (f'<div id="{cid}-perfis" class="perfis"><span class="perfis-rot">PERFIL</span>'
                              + ''.join(f'<span class="perfil">{PERFIL[k]}</span>' for k in roteiro['perfis']) + '</div>')
            classe_logo = 'logo' if c['tipo'] == 'abertura' else 'logo logo-fim'
            cenas_html.append(f"""
      <section id="{cid}" class="clip cartao" data-start="{ini_v:.3f}" data-duration="{fim - ini_v:.3f}" data-track-index="{2 + n % 2}">
        <div id="{cid}-fundo" class="cartao-fundo">
          <img id="{cid}-logo" class="{classe_logo}" src="assets/logo-completa.png" alt="" />
          <h1 id="{cid}-titulo" class="cartao-titulo">{titulo}</h1>
          {extra}
          <div class="ondas"><div class="onda1"></div><div class="onda2"></div></div>
        </div>
      </section>""")
            if n == 0:
                # primeiro quadro já pronto (miniatura e prévia não pegam tela vazia)
                tl += [
                    f'tl.fromTo("#{cid}-logo", {{scale: 0.94}}, {{scale: 1, duration: 0.6, ease: "power2.out"}}, 0);',
                    f'tl.fromTo("#{cid}-titulo", {{y: 16}}, {{y: 0, duration: 0.4, ease: "power2.out"}}, 0);',
                    f'tl.fromTo("#{cid}-sub", {{opacity: 0}}, {{opacity: 1, duration: 0.3}}, 0.2);',
                ]
            else:
                tl += [
                    f'tl.fromTo("#{cid}-fundo", {{opacity: 0}}, {{opacity: 1, duration: 0.3, ease: "power1.out"}}, {ini_v:.3f});',
                    f'tl.fromTo("#{cid}-logo", {{scale: 0.85, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.6)"}}, {ini_v + 0.1:.3f});',
                    f'tl.fromTo("#{cid}-titulo", {{y: 40, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.45, ease: "power3.out"}}, {ini_v + 0.3:.3f});',
                ]
                if c['tipo'] == 'fim' and sub.startswith('Próximo:') and n_ep:
                    tl.append(f'tl.fromTo("#{cid}-prox", {{y: 30, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.45, ease: "power3.out"}}, {ini_v + 0.7:.3f});')
                tl.append(f'tl.fromTo("#{cid}-sub", {{y: 30, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.45, ease: "power3.out"}}, {ini_v + 0.85:.3f});')
            if not ultima:
                # o cartão sobe e sai
                tl.append(f'tl.to("#{cid}-fundo", {{y: -220, opacity: 0, duration: 0.35, ease: "power2.in"}}, {fim - 0.35:.3f});')
            continue

        # --- cena com tela do app
        imagem = c['imagem']
        info = alvos.get(imagem) or {}
        caixas = [caixa_tela(a, escala, tela_a) for a in (info.get('alvos') or ([info['alvo']] if info.get('alvo') else []))]
        if c.get('destaque') == 'uniao' and caixas:
            caixas = [(min(b[0] for b in caixas), min(b[1] for b in caixas), max(b[2] for b in caixas), max(b[3] for b in caixas))]
        # o dedo só toca quando a fala cita um botão [..] ou um toque {..}; senão, só o destaque
        com_dedo = c.get('dedo', bool(re.search(r'\[[^\]]+\]|\{[^}]+\}', c['fala']))) and bool(caixas)
        legenda, tweens_leg, botoes = legenda_html(cid, mapa[n], ini + fala_ini)
        spot = dedo = ''
        if caixas:
            # um destaque por alvo; passam de um para o outro com fusão (sem animar posição)
            spot = ''.join(
                f'<div id="{cid}-spot{k}" class="spot" style="left:{BEZEL + b[0]:.0f}px;top:{BEZEL + b[1]:.0f}px;width:{b[2] - b[0]:.0f}px;height:{b[3] - b[1]:.0f}px"></div>'
                for k, b in enumerate(caixas))
            if com_dedo:
                px, py = ponta_do_dedo(*caixas[0])
                dedo = (f'<div id="{cid}-onda" class="onda-toque" style="left:{BEZEL + px - 60:.0f}px;top:{BEZEL + py - 60:.0f}px"></div>'
                        f'<div id="{cid}-dedo" class="dedo" style="left:{BEZEL + px - 59:.0f}px;top:{BEZEL + py - 15:.0f}px">{DEDO}</div>')
        cenas_html.append(f"""
      <section id="{cid}" class="clip cena" data-start="{ini_v:.3f}" data-duration="{fim - ini_v:.3f}" data-track-index="{2 + n % 2}">
        <div id="{cid}-cam" class="cam" style="left:{cel_x}px;top:{CEL_Y}px;width:{cel_w}px;height:{cel_h}px" data-layout-allow-overflow>
          <div class="celular"><div class="tela" data-layout-allow-overflow><img src="assets/telas/{imagem}" alt="" class="captura" /></div></div>
          {spot}{dedo}
        </div>
      </section>""")
        textos_html.append(f"""
      <section id="{cid}-t" class="clip textos" data-start="{ini_v:.3f}" data-duration="{fim - ini_v:.3f}" data-track-index="{4 + n % 2}">
        <h2 id="{cid}-titulo" class="titulo" data-layout-allow-overlap>{html.escape(c['titulo'])}</h2>
        <div id="{cid}-leg" class="legenda" data-layout-allow-overlap><p class="legenda-txt">{legenda}</p></div>
      </section>""")
        # entrada: o celular desliza da direita (ou sobe, depois de um cartão); título e legenda só depois que os anteriores saíram
        if anterior_cartao:
            tl.append(f'tl.fromTo("#{cid}-cam", {{y: 80, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.35, ease: "power2.out"}}, {ini_v + 0.05:.3f});')
        else:
            tl.append(f'tl.fromTo("#{cid}-cam", {{x: 120, opacity: 0}}, {{x: 0, opacity: 1, duration: 0.3, ease: "power2.out"}}, {ini_v + 0.1:.3f});')
        tl.append(f'tl.fromTo("#{cid}-titulo", {{opacity: 0}}, {{opacity: 1, duration: 0.2}}, {ini - 0.15:.3f});')
        tl.append(f'tl.fromTo("#{cid}-leg", {{opacity: 0}}, {{opacity: 1, duration: 0.2}}, {ini - 0.15:.3f});')
        tl += tweens_leg
        if caixas:
            ux0, uy0 = min(b[0] for b in caixas), min(b[1] for b in caixas)
            ux1, uy1 = max(b[2] for b in caixas), max(b[3] for b in caixas)
            larg = ux1 - ux0
            zoom = 1.03 if larg > 560 or (uy1 - uy0) > 500 else 1.1 if larg > 300 else 1.2
            ox, oy = BEZEL + (ux0 + ux1) / 2, BEZEL + (uy0 + uy1) / 2
            tl.append(f'tl.fromTo("#{cid}-cam", {{scale: 1}}, {{scale: {zoom}, transformOrigin: "{ox:.0f}px {oy:.0f}px", duration: 0.9, ease: "power2.inOut"}}, {ini + 0.1:.3f});')
            tl.append(f'tl.fromTo("#{cid}-spot0", {{opacity: 0}}, {{opacity: 1, duration: 0.35, ease: "power1.out"}}, {ini + 0.25:.3f});')
            for k in range(1, len(caixas)):
                tl.append(f'tl.set("#{cid}-spot{k}", {{opacity: 0}}, {ini_v:.3f});')
            # quando tocar: no nome do botão dito (um toque por alvo), senão logo no começo
            tempos = [max(ini + 0.9, t - 0.05) for t in botoes[: len(caixas)]] if len(botoes) >= len(caixas) else []
            if not tempos:
                tempos = [ini + 1.0 + 1.3 * k for k in range(len(caixas))]
            if com_dedo:
                bx, by = ponta_do_dedo(*caixas[0])
                tl.append(f'tl.fromTo("#{cid}-dedo", {{x: 260, y: 420, opacity: 0, rotation: 30}}, {{x: 0, y: 0, opacity: 1, rotation: 30, duration: 0.45, ease: "power2.out"}}, {tempos[0] - 0.5:.3f});')
            for k, (caixa, quando) in enumerate(zip(caixas, tempos)):
                x0, y0, x1, y1 = caixa
                if k:
                    tl.append(f'tl.to("#{cid}-spot{k - 1}", {{opacity: 0, duration: 0.3, ease: "power1.inOut"}}, {quando - 0.4:.3f});')
                    tl.append(f'tl.to("#{cid}-spot{k}", {{opacity: 1, duration: 0.3, ease: "power1.inOut"}}, {quando - 0.4:.3f});')
                if com_dedo:
                    px, py = ponta_do_dedo(*caixa)
                    if k:
                        tl.append(f'tl.to("#{cid}-dedo", {{x: {px - bx:.0f}, y: {py - by:.0f}, duration: 0.35, ease: "power2.inOut"}}, {quando - 0.4:.3f});')
                        tl.append(f'tl.set("#{cid}-onda", {{x: {px - bx:.0f}, y: {py - by:.0f}}}, {quando:.3f});')
                    tl.append(f'tl.to("#{cid}-dedo", {{scale: 0.9, duration: 0.12, ease: "power1.in", yoyo: true, repeat: 1, transformOrigin: "40% 10%"}}, {quando:.3f});')
                    tl.append(f'tl.fromTo("#{cid}-onda", {{scale: 0.2, opacity: 0.9}}, {{scale: 1.6, opacity: 0, duration: 0.6, ease: "power2.out"}}, {quando + 0.08:.3f});')
            if com_dedo:
                # depois do último toque o dedo sai para baixo e para a direita (não fica em cima de nada)
                ultimo = tempos[-1]
                px, py = ponta_do_dedo(*caixas[-1])
                tl.append(f'tl.to("#{cid}-dedo", {{x: {px - bx + 260:.0f}, y: {py - by + 520:.0f}, opacity: 0, duration: 0.45, ease: "power2.in"}}, {ultimo + 0.5:.3f});')
            else:
                # sem toque: o destaque pulsa de leve
                tl.append(f'tl.to("#{cid}-spot0", {{scale: 1.04, duration: 0.45, yoyo: true, repeat: 1, ease: "sine.inOut"}}, {ini + 0.8:.3f});')
        # saída: título e legenda somem antes; o celular desliza para a esquerda
        if not ultima:
            tl.append(f'tl.to("#{cid}-titulo", {{opacity: 0, duration: 0.12}}, {fim - TROCA:.3f});')
            tl.append(f'tl.to("#{cid}-leg", {{opacity: 0, duration: 0.12}}, {fim - TROCA:.3f});')
            proximo_cartao = roteiro['cenas'][n + 1]['tipo'] in ('abertura', 'fim')
            if not proximo_cartao:
                tl.append(f'tl.to("#{cid}-cam", {{x: -120, opacity: 0, duration: 0.25, ease: "power2.in"}}, {fim - TROCA:.3f});')

    # o topo (progresso e episódio) só aparece fora dos cartões de abertura e fim
    tipos = [c['tipo'] for c in roteiro['cenas']]
    tl.append('tl.set("#topo", {opacity: 0}, 0);')
    for n, tipo in enumerate(tipos):
        if tipo in ('abertura', 'fim') and n + 1 < len(tipos) and tipos[n + 1] == 'tela':
            tl.append(f'tl.to("#topo", {{opacity: 1, duration: 0.3}}, {inicios[n] + duracoes[n] - 0.2:.3f});')
        if tipo == 'fim':
            tl.append(f'tl.to("#topo", {{opacity: 0, duration: 0.25}}, {inicios[n] - 0.3:.3f});')
    tl.append(f'tl.fromTo("#progresso", {{scaleX: 0}}, {{scaleX: 1, duration: {total:.3f}, ease: "none", transformOrigin: "0 50%"}}, 0);')
    corpo = '\n'.join(cenas_html + textos_html)
    chip_perfil = ''.join(f'<span class="perfil perfil-topo">{PERFIL[k]}</span>' for k in roteiro.get('perfis', [])[:1])
    script = '\n      '.join(tl)
    return f"""<!doctype html>
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
      .topo {{ position: absolute; left: 0; right: 0; top: 0; height: 64px; z-index: 6; display: flex; justify-content: center; background: rgba(255, 255, 255, 0.95); }}
      .barra {{ position: absolute; left: 0; right: 0; top: 0; height: 12px; background: #cde1ee; }}
      #progresso {{ display: block; width: 100%; height: 100%; background: {VERDE}; }}
      .rotulo {{ margin-top: 22px; font-size: 26px; font-weight: 800; letter-spacing: 0.04em; color: {AZUL_ESCURO}; text-transform: uppercase; }}
      .clip {{ position: absolute; inset: 0; }}
      .cam {{ position: absolute; z-index: 1; }}
      .celular {{ position: absolute; inset: 0; padding: {BEZEL}px; border-radius: 68px; background: {AZUL_ESCURO}; box-shadow: 0 30px 60px rgba(31, 60, 90, 0.28); }}
      .tela {{ position: relative; width: 100%; height: 100%; border-radius: 52px; overflow: hidden; background: #fff; }}
      .captura {{ display: block; width: 100%; height: 100%; }}
      .spot {{ position: absolute; border-radius: 22px; box-shadow: 0 0 0 6px #fff, 0 0 0 8px {VERDE}, 0 0 0 4000px rgba(10, 25, 40, 0.55); }}
      .dedo {{ position: absolute; width: 120px; height: 150px; filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.3)); }}
      .onda-toque {{ position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 8px solid #fff; background: rgba(255, 255, 255, 0.25); }}
      .titulo {{ position: absolute; left: 50%; top: 78px; transform: translateX(-50%); z-index: 5; max-width: 980px; white-space: nowrap; padding: 14px 40px 18px; border-radius: 28px; background: rgba(255, 255, 255, 0.95); box-shadow: 0 10px 30px rgba(31, 60, 90, 0.18); font-size: 68px; font-weight: 900; color: {AZUL_ESCURO}; text-align: center; line-height: 1.1; }}
      .legenda {{ position: absolute; left: 40px; right: 40px; bottom: 34px; z-index: 5; display: flex; justify-content: center; }}
      .legenda-txt {{ max-width: 1000px; padding: 24px 30px; border-radius: 24px; background: rgba(255, 255, 255, 0.94); box-shadow: 0 10px 30px rgba(31, 60, 90, 0.18); text-align: center; text-wrap: balance; font-size: 52px; font-weight: 700; line-height: 1.25; color: {AZUL_ESCURO}; }}
      .pal {{ display: inline-block; opacity: 0.62; border-radius: 12px; padding: 0 4px; margin: 0 -4px; background-color: rgba(37, 154, 212, 0); }}
      .junto {{ white-space: nowrap; }}
      .pal.botao {{ opacity: 1; background: {VERDE}; color: #fff; border-radius: 40px; padding: 0 20px; white-space: nowrap; }}
      .cartao-fundo {{ position: absolute; inset: 0; z-index: 7; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 160px; }}
      .logo {{ display: block; height: 640px; width: auto; }}
      .logo-fim {{ height: 460px; }}
      .cartao-titulo {{ margin-top: 60px; font-size: 104px; font-weight: 900; color: {VERDE}; text-align: center; max-width: 960px; line-height: 1.05; }}
      .cartao-sub {{ margin-top: 30px; font-size: 50px; font-weight: 600; color: {AZUL_ESCURO}; text-align: center; max-width: 920px; }}
      .perfis {{ margin-top: 40px; display: flex; align-items: center; gap: 18px; }}
      .perfis-rot {{ font-size: 34px; font-weight: 800; letter-spacing: 0.06em; color: {AZUL_ESCURO}; }}
      .perfil {{ padding: 10px 34px 14px; border-radius: 60px; background: {VERDE}; color: #fff; font-size: 52px; font-weight: 800; }}
      .perfil-topo {{ position: absolute; right: 20px; top: 16px; padding: 4px 18px 6px; font-size: 26px; letter-spacing: 0.02em; }}
      .prox {{ margin-top: 70px; font-size: 44px; font-weight: 800; letter-spacing: 0.04em; color: {AZUL}; }}
      .prox-nome {{ margin-top: 12px; font-size: 64px; font-weight: 900; color: {VERDE}; text-align: center; max-width: 960px; }}
      .ondas {{ position: absolute; left: 0; right: 0; bottom: 0; height: 120px; }}
      .onda1 {{ position: absolute; left: 0; right: 0; bottom: 60px; height: 60px; background: {AZUL}; }}
      .onda2 {{ position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: {AZUL_ESCURO}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="{L}" data-height="{A}">
      <audio id="trilha" src="assets/trilha.wav" data-start="0" data-duration="{total:.3f}" data-track-index="0" data-volume="1"></audio>
{corpo}
      <div id="topo" class="topo"><div class="barra"><div id="progresso"></div></div><div class="rotulo">{html.escape(ep_rotulo)}</div>{chip_perfil}</div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      {script}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--roteiro', required=True, type=Path)
    p.add_argument('--telas', required=True, type=Path)
    p.add_argument('--voz', required=True)
    p.add_argument('--projeto', required=True, type=Path)
    p.add_argument('--falante', type=int, default=42)
    p.add_argument('--velocidade', type=float, default=1.0)
    p.add_argument('--python-voz', default='python3', help='Python com o Chatterbox (quando --voz é uma gravação .wav)')
    p.add_argument('--whisper', help='pasta do Whisper (sherpa-onnx) para conferir cada frase da voz clonada')
    a = p.parse_args()
    roteiro = json.loads(a.roteiro.read_text(encoding='utf-8'))
    alvos = {c['imagem']: c for c in json.loads((a.telas / 'cenas.json').read_text())['cenas']}
    proj = a.projeto
    (proj / 'assets' / 'telas').mkdir(parents=True, exist_ok=True)

    # voz, cena por cena; a duração de cada cena acompanha a fala (mínimo 2,6 s para o toque)
    trechos, mapa, taxa = gerar_voz(roteiro['cenas'], a.voz, a.falante, a.velocidade, a.python_voz, a.whisper)
    duracoes, inicios, t = [], [], 0.0
    for c, tr in zip(roteiro['cenas'], trechos):
        antes = 0.35 if c['tipo'] != 'tela' else 0.2
        depois = 2.0 if c['tipo'] == 'fim' else 0.45
        d = max(antes + len(tr) / taxa + depois, 2.6 if c['tipo'] == 'tela' else 2.2)
        inicios.append(t)
        duracoes.append(d)
        t += d
    total = t
    voz = np.zeros(int(total * taxa) + taxa, dtype=np.float32)
    for c, tr, ini in zip(roteiro['cenas'], trechos, inicios):
        k = int((ini + (0.35 if c['tipo'] != 'tela' else 0.2)) * taxa)
        voz[k:k + len(tr)] += tr
    masterizar(voz, taxa, total, proj / 'assets', limpar=not str(a.voz).endswith('.wav'))

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
