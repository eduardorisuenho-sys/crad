#!/usr/bin/env python3
"""
Monta o vídeo-tutorial (vertical 1080x1920, para celular) a partir de:
  - roteiro.json (capítulos, cenas e narração);
  - as telas do app geradas por app/e2e/tutorial.spec.ts (pasta com cenas.json);
  - a narração: voz neural Kokoro (código aberto, sem internet) ou gravações
    de uma pessoa (cena-01.wav, cena-02.wav... na pasta --gravacoes, na ordem
    das cenas do roteiro).

Linguagem visual: capítulos numerados, barra de progresso, título curto,
legenda grande com os nomes dos botões em pílulas verdes (como no app),
destaque do botão a tocar (o resto da tela escurece) com animação de toque,
transições suaves e trilha sonora própria (gerada aqui, sem direitos
autorais), que abaixa quando a narração fala.

Uso:
  python3 montar_video.py --telas <pasta das telas> --voz <pasta kokoro-multi-lang-v1_0>
  python3 montar_video.py --telas <pasta> --gravacoes <pasta com cena-NN.wav>

Precisa de: Python 3 com Pillow e numpy, ffmpeg e (para a voz sintética) sherpa-onnx.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
FONTE = RAIZ / 'app/src/fontes/inter-latin-wght-normal.woff2'
LOGO = RAIZ / 'app/public/marca/logo-completa.png'

# cores da logomarca do CRAD
VERDE = (72, 103, 47)
AZUL = (37, 154, 212)
AZUL_ESCURO = (51, 97, 141)
BRANCO = (255, 255, 255)
FUNDO = (238, 246, 251)
TRILHO = (205, 225, 238)

L, A, FPS = 1080, 1920, 30
TAXA = 44100
TRANSICAO = 6  # quadros de fusão entre cenas


# ---------------------------------------------------------------- texto

def fonte(tamanho: int, peso: str = 'Bold') -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTE), tamanho)
    f.set_variation_by_name(peso)
    return f


def sem_colchetes(t: str) -> str:
    return re.sub(r'\[([^\]]+)\]|\{([^}]+)\}', lambda m: m.group(1) or m.group(2), t)


def quebrar(d, texto, f, largura):
    linhas, atual = [], ''
    for palavra in texto.split():
        teste = f'{atual} {palavra}'.strip()
        if d.textlength(teste, font=f) <= largura or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    return linhas + [atual] if atual else linhas


def centro(d, texto, f, y, cor, largura=L - 140, entre=1.16):
    for linha in quebrar(d, texto, f, largura):
        d.text(((L - d.textlength(linha, font=f)) / 2, y), linha, font=f, fill=cor)
        y += int(f.size * entre)
    return y


def legenda_rica(d, texto, f, y, largura=L - 110, entre=1.42):
    """Legenda centrada; [Botão] vira pílula verde com letra branca."""
    pedacos = []  # (texto, é_botão)
    for parte in re.split(r'(\[[^\]]+\])', texto):
        if not parte:
            continue
        if parte.startswith('['):
            pedacos.append((parte[1:-1], True))
        else:
            pedacos += [(p, False) for p in parte.split()]
    pad, esp = 18, d.textlength(' ', font=f)
    larg = lambda p: d.textlength(p[0], font=f) + (2 * pad if p[1] else 0)
    linhas, atual, w = [], [], 0.0
    for p in pedacos:
        extra = larg(p) + (esp if atual else 0)
        # pontuação colada no botão anterior fica na mesma linha
        if atual and w + extra > largura and not re.fullmatch(r'[.,:;!?]+', p[0]):
            linhas.append(atual)
            atual, w = [p], larg(p)
        else:
            atual.append(p)
            w += extra
    if atual:
        linhas.append(atual)
    alto = int(f.size * entre)
    for linha in linhas:
        total = sum(larg(p) for p in linha) + esp * (len(linha) - 1)
        x = (L - total) / 2
        for i, p in enumerate(linha):
            if i and re.fullmatch(r'[.,:;!?]+', p[0]):
                x -= esp  # "[Salvar]." sem espaço antes do ponto
            if p[1]:
                wp = larg(p)
                d.rounded_rectangle([x, y - 6, x + wp, y + f.size + 14], radius=(f.size + 20) // 2, fill=VERDE)
                d.text((x + pad, y), p[0], font=f, fill=BRANCO)
            else:
                d.text((x, y), p[0], font=f, fill=AZUL_ESCURO)
            x += larg(p) + esp
        y += alto
    return y


# ---------------------------------------------------------------- quadros

def ondas(d):
    d.rectangle([0, A - 110, L, A], fill=AZUL)
    d.rectangle([0, A - 55, L, A], fill=AZUL_ESCURO)


def colar_logo(img, alto, y):
    logo = Image.open(LOGO).convert('RGBA')
    logo = logo.resize((int(logo.width * alto / logo.height), alto), Image.LANCZOS)
    img.paste(logo, ((L - logo.width) // 2, y), logo)


def quadro_abertura(c):
    img = Image.new('RGB', (L, A), BRANCO)
    d = ImageDraw.Draw(img)
    colar_logo(img, 640, 300)
    y = centro(d, c['titulo'], fonte(100, 'Black'), 1060, VERDE)
    centro(d, c['subtitulo'], fonte(52, 'SemiBold'), y + 30, AZUL_ESCURO)
    ondas(d)
    return img


def quadro_capitulo(c, capitulos):
    img = Image.new('RGB', (L, A), AZUL_ESCURO)
    d = ImageDraw.Draw(img)
    n, total = c['capitulo'], len(capitulos)
    d.ellipse([L / 2 - 170, 520, L / 2 + 170, 860], fill=VERDE)
    f = fonte(230, 'Black')
    d.text((L / 2, 690), str(n), font=f, fill=BRANCO, anchor='mm')
    centro(d, f'PARTE {n} DE {total}', fonte(44, 'Bold'), 960, (190, 220, 240))
    centro(d, capitulos[n - 1], fonte(92, 'Black'), 1040, BRANCO)
    for i in range(total):
        cx = L / 2 + (i - (total - 1) / 2) * 70
        d.ellipse([cx - 14, 1420, cx + 14, 1448], fill=VERDE if i < n else (90, 130, 170))
    return img


def cabecalho(d, c, capitulos):
    if c.get('_rotulo'):
        centro(d, c['_rotulo'].upper(), fonte(30, 'Bold'), 46, AZUL)
    elif c.get('capitulo'):
        rotulo = f"PARTE {c['capitulo']} DE {len(capitulos)}  ·  {capitulos[c['capitulo'] - 1].upper()}"
        centro(d, rotulo, fonte(30, 'Bold'), 46, AZUL)


def quadro_explicacao(c, capitulos):
    img = Image.new('RGB', (L, A), BRANCO)
    d = ImageDraw.Draw(img)
    cabecalho(d, c, capitulos)
    colar_logo(img, 520, 230)
    y = centro(d, c['titulo'], fonte(88, 'Black'), 880, VERDE)
    centro(d, c['texto'], fonte(60, 'SemiBold'), y + 50, AZUL_ESCURO, largura=L - 180, entre=1.3)
    ondas(d)
    return img


def quadro_tela(c, telas, alvos, capitulos):
    """Devolve (sem destaque, com destaque, centro do toque)."""
    img = Image.new('RGB', (L, A), FUNDO)
    d = ImageDraw.Draw(img)
    cabecalho(d, c, capitulos)
    centro(d, c['titulo'], fonte(76, 'Black'), 110, AZUL_ESCURO)
    foto = Image.open(telas / c['imagem']).convert('RGB')
    alto = 1220
    escala = alto / foto.height
    larg = int(foto.width * escala)
    foto = foto.resize((larg, alto), Image.LANCZOS)
    x, y = (L - larg) // 2, 300
    b = 16
    d.rounded_rectangle([x - b, y - b, x + larg + b, y + alto + b], radius=54, fill=AZUL_ESCURO)
    mascara = Image.new('L', foto.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, larg, alto], radius=40, fill=255)
    img.paste(foto, (x, y), mascara)
    legenda_rica(d, c['fala'], fonte(46, 'SemiBold'), y + alto + 50)

    destaque, toque = img, None
    alvo = alvos.get(c['imagem'])
    if alvo:
        ax, ay = x + alvo['x'] * escala, y + alvo['y'] * escala
        aw, ah = alvo['w'] * escala, alvo['h'] * escala
        x0, y0 = max(x + 6, ax - 12), max(y + 6, ay - 12)
        x1, y1 = min(x + larg - 6, ax + aw + 12), min(y + alto - 6, ay + ah + 12)
        # escurece a tela do celular, menos o botão
        sombra = Image.new('L', (L, A), 0)
        ds = ImageDraw.Draw(sombra)
        ds.rounded_rectangle([x, y, x + larg, y + alto], radius=40, fill=125)
        ds.rounded_rectangle([x0, y0, x1, y1], radius=20, fill=0)
        destaque = Image.composite(Image.new('RGB', (L, A), (10, 25, 40)), img, sombra)
        dd = ImageDraw.Draw(destaque)
        dd.rounded_rectangle([x0 - 5, y0 - 5, x1 + 5, y1 + 5], radius=24, outline=BRANCO, width=12)
        dd.rounded_rectangle([x0, y0, x1, y1], radius=20, outline=VERDE, width=7)
        toque = ((x0 + x1) / 2, (y0 + y1) / 2)
    return img, destaque, toque


def quadros_resumo(c):
    """Uma imagem para cada item já mostrado (os itens entram um a um)."""
    imgs = []
    for k in range(len(c['itens']) + 1):
        img = Image.new('RGB', (L, A), BRANCO)
        d = ImageDraw.Draw(img)
        centro(d, c['titulo'], fonte(100, 'Black'), 300, VERDE)
        y = 560
        f = fonte(52, 'SemiBold')
        for i, item in enumerate(c['itens'][:k]):
            d.ellipse([90, y - 4, 170, y + 76], fill=VERDE)
            d.text((130, y + 36), str(i + 1), font=fonte(48, 'Black'), fill=BRANCO, anchor='mm')
            yy = y
            for linha in quebrar(d, item, f, L - 300):
                d.text((210, yy + 4), linha, font=f, fill=AZUL_ESCURO)
                yy += int(f.size * 1.25)
            y = max(y + 110, yy + 50)
        ondas(d)
        imgs.append(img)
    return imgs


# ---------------------------------------------------------------- som

def ler_wav(caminho: Path) -> np.ndarray:
    with wave.open(str(caminho)) as w:
        dados = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return dados


def preparar_voz(origem: Path, destino: Path):
    # tira o grave do vento, suaviza o volume e passa para 44,1 kHz
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(origem), '-af',
                    'highpass=f=80,acompressor=threshold=0.08:ratio=3:attack=5:release=120:makeup=2,aresample=44100',
                    '-ac', '1', '-ar', str(TAXA), '-c:a', 'pcm_s16le', str(destino)], check=True)


_TTS = {}

# Só na narração: jeitos de escrever que a voz pronuncia melhor (testados com
# reconhecedor de fala). A legenda continua com o texto do roteiro.
PRONUNCIA = [
    (r'\bToque em\b', 'Toque no botão'),
    (r'\btoque em\b', 'toque no botão'),
    (r'\bQR Code\b', 'Q R Code'),
    (r'\bPDF\b', 'P D F'),
    (r'\bCPF\b', 'C P F'),
    (r'\bapp\b', 'aplicativo'),
    (r'\s*\((kg|QR)\)', ''),
]


def para_falar(texto: str) -> str:
    for de, para in PRONUNCIA:
        texto = re.sub(de, para, texto)
    return texto


def falar(texto: str, voz: str, saida: Path, falante: int, velocidade: float):
    """Voz neural Kokoro (código aberto, roda sem internet) pelo sherpa-onnx."""
    import sherpa_onnx

    if voz not in _TTS:
        d = Path(voz)
        modelo = sherpa_onnx.OfflineTtsKokoroModelConfig(model=str(d / 'model.onnx'), voices=str(d / 'voices.bin'), tokens=str(d / 'tokens.txt'),
                                                          data_dir=str(d / 'espeak-ng-data'), lexicon='', lang='pt-br')
        _TTS[voz] = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=modelo, num_threads=4)))
    tts = _TTS[voz]
    # frase por frase, com uma pausa curta entre elas: fala mais calma e clara
    partes = []
    for frase in re.split(r'(?<=[.!?])\s+', texto.strip()):
        a = tts.generate(frase, sid=falante, speed=velocidade)
        partes += [np.array(a.samples, dtype=np.float32), np.zeros(int(a.sample_rate * 0.15), dtype=np.float32)]
    som = np.concatenate(partes[:-1])
    with wave.open(str(saida), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(a.sample_rate)
        w.writeframes((np.clip(som, -1, 1) * 32767).astype(np.int16).tobytes())


def trilha(amostras: int) -> np.ndarray:
    """Trilha calma e original: acordes suaves (Dó, Lá menor, Fá, Sol) e um dedilhado leve."""
    t = np.arange(amostras) / TAXA
    segundos = amostras / TAXA
    acordes = [(130.81, 261.63, 329.63, 392.00), (110.00, 220.00, 261.63, 329.63), (87.31, 174.61, 220.00, 261.63), (98.00, 196.00, 246.94, 293.66)]
    dur = 6.0
    som = np.zeros_like(t)
    for i in range(int(segundos / dur) + 2):
        notas = acordes[i % 4]
        ini = i * dur - 1.0
        sel = (t >= ini) & (t < ini + dur + 2.0)
        tt = t[sel] - ini
        env = np.clip(tt / 1.2, 0, 1) * np.clip((dur + 2.0 - tt) / 1.6, 0, 1)
        pad = sum(np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * (f + 0.4) * tt) + 0.15 * np.sin(4 * np.pi * f * tt) for f in notas)
        som[sel] += 0.12 * env * pad
        # dedilhado: as notas do acorde subindo, uma a cada 0,5 s
        for k in range(12):
            ini_n = i * dur + k * 0.5
            seln = (t >= ini_n) & (t < ini_n + 1.6)
            tn = t[seln] - ini_n
            f = notas[1 + k % 3] * 2
            som[seln] += 0.05 * np.exp(-tn * 3.2) * (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(4 * np.pi * f * tn))
    som /= np.max(np.abs(som)) + 1e-9
    fade = np.clip(t / 2.0, 0, 1) * np.clip((segundos - t) / 3.0, 0, 1)
    return som * fade


def suavizar(x: np.ndarray, segundos: float) -> np.ndarray:
    n = max(1, int(segundos * TAXA))
    kern = np.ones(n) / n
    return np.convolve(x, kern, mode='same')


# ---------------------------------------------------------------- montagem

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--telas', required=True, type=Path)
    p.add_argument('--voz', help='pasta do modelo Kokoro do sherpa-onnx (kokoro-multi-lang-v1_0)')
    p.add_argument('--falante', type=int, default=42, help='voz do Kokoro: 42 = pf_dora (feminina, pt-BR), 43 = pm_alex, 44 = pm_santa')
    p.add_argument('--velocidade', type=float, default=1.0, help='1 = normal; menos que 1 = mais devagar')
    p.add_argument('--gravacoes', type=Path, help='pasta com cena-01.wav, cena-02.wav... (voz gravada; tem prioridade)')
    p.add_argument('--roteiro', type=Path, default=AQUI / 'roteiro.json')
    p.add_argument('--saida', type=Path, default=AQUI / 'tutorial-coleta-de-sementes.mp4')
    p.add_argument('--sem-trilha', action='store_true')
    a = p.parse_args()
    roteiro = json.loads(a.roteiro.read_text(encoding='utf-8'))
    capitulos = roteiro.get('capitulos', [])
    alvos = {c['imagem']: c['alvo'] for c in json.loads((a.telas / 'cenas.json').read_text())['cenas']}
    cenas = roteiro['cenas']
    # série de episódios: o topo da tela mostra "Episódio N · título"
    if roteiro.get('rotulo'):
        for c in cenas:
            c.setdefault('_rotulo', roteiro['rotulo'])

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # 1) narração e duração de cada cena
        vozes, inicio, tempos = [], [], []
        relogio = 0.0
        for n, c in enumerate(cenas, 1):
            bruta, pronta = tmp / f'{n:02d}-bruta.wav', tmp / f'{n:02d}.wav'
            gravada = a.gravacoes / f'cena-{n:02d}.wav' if a.gravacoes else None
            if gravada and gravada.exists():
                bruta = gravada
            elif a.voz:
                falar(para_falar(sem_colchetes(c['fala'])), a.voz, bruta, a.falante, a.velocidade)
            else:
                sys.exit(f'Falta a narração da cena {n}: use --voz ou --gravacoes.')
            preparar_voz(bruta, pronta)
            v = ler_wav(pronta)
            v = v / (np.max(np.abs(v)) + 1e-9) * 0.8
            # ritmo enxuto: pouco silêncio antes e depois de cada fala
            antes = 0.4 if c['tipo'] in ('abertura', 'capitulo') else 0.2
            depois = 1.0 if c['tipo'] in ('resumo', 'fim') else 0.45
            dur = antes + len(v) / TAXA + depois
            vozes.append((v, antes))
            inicio.append(relogio)
            tempos.append(dur)
            relogio += dur
        total = relogio

        # 2) som: narração + trilha que abaixa quando alguém fala
        fala = np.zeros(int(total * TAXA) + TAXA)
        for (v, antes), ini in zip(vozes, inicio):
            k = int((ini + antes) * TAXA)
            fala[k:k + len(v)] += v
        mix = fala
        if not a.sem_trilha:
            musica = trilha(len(fala))
            falando = suavizar((np.abs(fala) > 0.02).astype(np.float32), 0.6)
            falando = np.clip(falando * 4, 0, 1)
            mix = fala + musica * (0.16 - 0.11 * falando)
        mix = np.clip(mix / max(1.0, np.max(np.abs(mix)) / 0.95), -1, 1)
        audio = tmp / 'audio.wav'
        with wave.open(str(audio), 'w') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(TAXA)
            w.writeframes((mix * 32767).astype(np.int16).tobytes())

        # 3) imagem: quadro a quadro, direto para o ffmpeg
        enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{L}x{A}', '-r', str(FPS), '-i', '-',
                                '-i', str(audio), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
                                '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', str(a.saida)], stdin=subprocess.PIPE)
        anterior = None
        feitos = 0
        for n, c in enumerate(cenas):
            fim = round((inicio[n] + tempos[n]) * FPS)
            quadros = fim - feitos
            base = destaque = toque = None
            resumo = None
            if c['tipo'] == 'abertura' or c['tipo'] == 'fim':
                base = quadro_abertura(c)
            elif c['tipo'] == 'capitulo':
                base = quadro_capitulo(c, capitulos)
            elif c['tipo'] == 'explicacao':
                base = quadro_explicacao(c, capitulos)
            elif c['tipo'] == 'resumo':
                resumo = quadros_resumo(c)
            else:
                base, destaque, toque = quadro_tela(c, a.telas, alvos, capitulos)
            fala_ini, fala_dur = vozes[n][1], len(vozes[n][0]) / TAXA
            ultimo = None
            for q in range(quadros):
                t = q / FPS
                if resumo:
                    # os itens entram junto com a fala
                    k = 0 if t < fala_ini else min(len(resumo) - 1, 1 + int((t - fala_ini) / (fala_dur / (len(resumo) - 1) + 1e-9)))
                    quadro = resumo[k].copy()
                elif destaque is not None and destaque is not base:
                    nivel = min(1.0, max(0.0, (t - 0.1) / 0.3))
                    quadro = destaque.copy() if nivel >= 1 else Image.blend(base, destaque, nivel) if nivel > 0 else base.copy()
                    # toque: círculo que cresce e some, a cada 1,6 s
                    fase = (t - 0.4) % 1.4 if t >= 0.4 else -1
                    if 0 <= fase < 0.9 and toque:
                        r = 22 + fase / 0.9 * 70
                        alfa = int(220 * (1 - fase / 0.9))
                        camada = Image.new('RGBA', (L, A), (0, 0, 0, 0))
                        dc = ImageDraw.Draw(camada)
                        cx, cy = toque
                        dc.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, alfa), width=9)
                        dc.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(255, 255, 255, int(alfa * 0.45)))
                        quadro = Image.alpha_composite(quadro.convert('RGBA'), camada).convert('RGB')
                else:
                    quadro = base.copy()
                # barra de progresso do vídeo inteiro
                dq = ImageDraw.Draw(quadro)
                dq.rectangle([0, 0, L, 12], fill=TRILHO)
                dq.rectangle([0, 0, int(L * (feitos + q) / (total * FPS)), 12], fill=VERDE)
                if anterior is not None and q < TRANSICAO:
                    quadro = Image.blend(anterior, quadro, (q + 1) / (TRANSICAO + 1))
                enc.stdin.write(quadro.tobytes())
                ultimo = quadro
            anterior = ultimo
            feitos = fim
            print(f'cena {n + 1:02d}/{len(cenas)} ({c["tipo"]}): {tempos[n]:.1f} s', flush=True)
        enc.stdin.close()
        enc.wait()
    print(f'Vídeo pronto ({total / 60:.1f} min): {a.saida}')


if __name__ == '__main__':
    main()
