#!/usr/bin/env python3
"""
Monta o vídeo-tutorial (vertical, 1080x1920, para celular) a partir de:
  - roteiro.json (título, legenda e fala de cada cena);
  - as telas do app geradas por app/e2e/tutorial.spec.ts (pasta com cenas.json);
  - a narração: voz sintética Piper (código aberto, roda sem internet) ou
    gravações de uma pessoa (cena-01.wav, cena-02.wav... na pasta --gravacoes).

Uso:
  python3 montar_video.py --telas <pasta das telas> --voz <modelo .onnx do Piper> --saida tutorial.mp4
  python3 montar_video.py --telas <pasta> --gravacoes <pasta com cena-NN.wav> --saida tutorial.mp4

Precisa de: Python 3 com Pillow, ffmpeg e (para a voz sintética) piper-tts.
"""
import argparse
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

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
FUNDO = (236, 245, 251)

L, A = 1080, 1920
ANTES, DEPOIS = 0.4, 0.8  # silêncio antes e depois da fala (segundos)


def fonte(tamanho: int, peso: str = 'Bold') -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTE), tamanho)
    f.set_variation_by_name(peso)
    return f


def quebrar(d: ImageDraw.ImageDraw, texto: str, f, largura: int) -> list[str]:
    linhas, atual = [], ''
    for palavra in texto.split():
        teste = f'{atual} {palavra}'.strip()
        if d.textlength(teste, font=f) <= largura:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    return linhas + [atual] if atual else linhas


def texto_centro(d, texto, f, y, cor, largura=L - 120, entre=1.18) -> int:
    for linha in quebrar(d, texto, f, largura):
        d.text(((L - d.textlength(linha, font=f)) / 2, y), linha, font=f, fill=cor)
        y += int(f.size * entre)
    return y


def cartao(cena: dict, saida: Path):
    img = Image.new('RGB', (L, A), BRANCO)
    d = ImageDraw.Draw(img)
    logo = Image.open(LOGO).convert('RGBA')
    alto = 760
    logo = logo.resize((int(logo.width * alto / logo.height), alto), Image.LANCZOS)
    img.paste(logo, ((L - logo.width) // 2, 260), logo)
    y = texto_centro(d, cena['titulo'], fonte(104, 'Black'), 1120, VERDE)
    if cena.get('legenda'):
        texto_centro(d, cena['legenda'], fonte(54, 'SemiBold'), y + 40, AZUL_ESCURO)
    # ondas no pé, como no app
    d.rectangle([0, A - 120, L, A], fill=AZUL)
    d.rectangle([0, A - 60, L, A], fill=AZUL_ESCURO)
    img.save(saida)


def tela(cena: dict, telas: Path, info: dict, base: Path, anel: Path):
    img = Image.new('RGB', (L, A), FUNDO)
    d = ImageDraw.Draw(img)
    texto_centro(d, cena['titulo'], fonte(74, 'Black'), 70, AZUL_ESCURO)
    # o celular
    foto = Image.open(telas / cena['imagem']).convert('RGB')
    alto = 1300
    escala = alto / foto.height
    larg = int(foto.width * escala)
    foto = foto.resize((larg, alto), Image.LANCZOS)
    x, y = (L - larg) // 2, 300
    borda = 18
    d.rounded_rectangle([x - borda, y - borda, x + larg + borda, y + alto + borda], radius=56, fill=AZUL_ESCURO)
    mascara = Image.new('L', foto.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, larg, alto], radius=40, fill=255)
    img.paste(foto, (x, y), mascara)
    # legenda (o que a narração diz)
    texto_centro(d, cena.get('legenda') or cena['fala'], fonte(40, 'SemiBold'), y + alto + 52, AZUL_ESCURO, largura=L - 100, entre=1.25)
    img.save(base)
    # anel que pisca em volta do botão a tocar
    camada = Image.new('RGBA', (L, A), (0, 0, 0, 0))
    alvo = info.get(cena['imagem'])
    if alvo:
        dc = ImageDraw.Draw(camada)
        ax, ay = x + alvo['x'] * escala, y + alvo['y'] * escala
        aw, ah = alvo['w'] * escala, alvo['h'] * escala
        # não deixa o anel sair da tela do celular
        x0, y0 = max(x + 4, ax - 14), max(y + 4, ay - 14)
        x1, y1 = min(x + larg - 4, ax + aw + 14), min(y + alto - 4, ay + ah + 14)
        dc.rounded_rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 6], radius=26, outline=BRANCO, width=16)
        dc.rounded_rectangle([x0, y0, x1, y1], radius=22, outline=VERDE, width=10)
    camada.save(anel)


def duracao(wav: Path) -> float:
    with wave.open(str(wav)) as w:
        return w.getnframes() / w.getframerate()


def falar(texto: str, voz: str, saida: Path):
    subprocess.run([sys.executable, '-m', 'piper', '-m', voz, '-f', str(saida), '--length-scale', '1.12', '--sentence-silence', '0.35'], input=texto.encode('utf-8'), check=True, capture_output=True)


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--telas', required=True, type=Path)
    p.add_argument('--voz', help='modelo .onnx do Piper (voz sintética)')
    p.add_argument('--gravacoes', type=Path, help='pasta com cena-01.wav, cena-02.wav... (voz gravada; tem prioridade)')
    p.add_argument('--roteiro', type=Path, default=AQUI / 'roteiro.json')
    p.add_argument('--saida', type=Path, default=AQUI / 'tutorial-matrizes-e-coleta.mp4')
    a = p.parse_args()
    roteiro = json.loads(a.roteiro.read_text(encoding='utf-8'))
    info = {c['imagem']: c['alvo'] for c in json.loads((a.telas / 'cenas.json').read_text())['cenas']}

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        partes = []
        for n, cena in enumerate(roteiro['cenas'], 1):
            base, anel, voz = tmp / f'{n:02d}.png', tmp / f'{n:02d}-anel.png', tmp / f'{n:02d}.wav'
            gravada = a.gravacoes / f'cena-{n:02d}.wav' if a.gravacoes else None
            if gravada and gravada.exists():
                ffmpeg('-i', str(gravada), '-ac', '1', '-ar', '22050', str(voz))
            elif a.voz:
                falar(cena['fala'], a.voz, voz)
            else:
                sys.exit(f'Falta a narração da cena {n}: use --voz ou --gravacoes.')
            if cena.get('imagem'):
                tela(cena, a.telas, info, base, anel)
            else:
                cartao(cena, base)
                Image.new('RGBA', (L, A), (0, 0, 0, 0)).save(anel)
            tempo = ANTES + duracao(voz) + DEPOIS
            parte = tmp / f'{n:02d}.mp4'
            ffmpeg(
                '-loop', '1', '-framerate', '30', '-i', str(base),
                '-loop', '1', '-framerate', '30', '-i', str(anel),
                '-i', str(voz),
                '-filter_complex',
                f"[0][1]overlay=enable='lt(mod(t,1),0.6)',fade=t=in:d=0.25,fade=t=out:st={tempo - 0.25:.2f}:d=0.25,format=yuv420p[v];"
                f"[2]adelay={int(ANTES * 1000)}|{int(ANTES * 1000)},apad,aresample=44100[a]",
                '-map', '[v]', '-map', '[a]', '-t', f'{tempo:.2f}',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-r', '30',
                '-c:a', 'aac', '-b:a', '128k', '-ac', '1', str(parte),
            )
            partes.append(parte)
            print(f'cena {n:02d}: {tempo:.1f} s')
        lista = tmp / 'lista.txt'
        lista.write_text(''.join(f"file '{x}'\n" for x in partes))
        ffmpeg('-f', 'concat', '-safe', '0', '-i', str(lista), '-c', 'copy', '-movflags', '+faststart', str(a.saida))
    print(f'Vídeo pronto: {a.saida}')


if __name__ == '__main__':
    main()
