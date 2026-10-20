#!/usr/bin/env python3
"""
Manual de utilização em PDF (A4), a partir dos mesmos roteiros e telas dos
vídeos: capa, índice e, em cada episódio, os passos numerados com a tela do
app e o botão a tocar em destaque.

Uso: python3 gerar_manual.py --telas <pasta com as telas> [--saida manual-crad.pdf]
"""
import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
FONTE = RAIZ / 'app/src/fontes/inter-latin-wght-normal.woff2'
LOGO = RAIZ / 'app/public/marca/logo-completa.png'
VERDE, AZUL, AZUL_ESCURO, BRANCO, FUNDO = (72, 103, 47), (37, 154, 212), (51, 97, 141), (255, 255, 255), (238, 246, 251)
L, A = 1240, 1754  # A4 a 150 dpi
M = 90


def fonte(t, peso='Bold'):
    f = ImageFont.truetype(str(FONTE), t)
    f.set_variation_by_name(peso)
    return f


def quebrar(d, texto, f, largura):
    linhas, atual = [], ''
    for p in texto.split():
        teste = f'{atual} {p}'.strip()
        if d.textlength(teste, font=f) <= largura or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = p
    return linhas + [atual] if atual else linhas


def texto_rico(d, texto, x, y, largura, f, fb):
    """Texto com [Botão] em verde e negrito."""
    pedacos = []
    texto = re.sub(r'\{([^}]+)\}', r'\1', texto)
    for parte in re.split(r'(\[[^\]]+\])', texto):
        if parte.startswith('['):
            pedacos += [(w, True) for w in parte[1:-1].split()]
        else:
            pedacos += [(w, False) for w in parte.split()]
    esp = d.textlength(' ', font=f)
    cx, linha = x, int(f.size * 1.35)
    for w, b in pedacos:
        ff = fb if b else f
        if not b and re.fullmatch(r'[.,:;!?]+', w) and cx > x:
            cx -= esp  # "[Entrar]." sem espaço antes do ponto
        lw = d.textlength(w, font=ff)
        if cx + lw > x + largura and cx > x:
            cx, y = x, y + linha
        d.text((cx, y), w, font=ff, fill=VERDE if b else AZUL_ESCURO)
        cx += lw + esp
    return y + linha


def rodape(d, n):
    d.rectangle([0, A - 60, L, A], fill=AZUL_ESCURO)
    d.text((M, A - 45), 'Manual do app CRAD', font=fonte(22, 'SemiBold'), fill=BRANCO)
    d.text((L - M, A - 45), str(n), font=fonte(22, 'Bold'), fill=BRANCO, anchor='ra')


def miniatura(arquivo: Path, alvo, largura):
    im = Image.open(arquivo).convert('RGB')
    if alvo:
        d = ImageDraw.Draw(im)
        x0, y0, x1, y1 = alvo['x'] - 10, alvo['y'] - 10, alvo['x'] + alvo['w'] + 10, alvo['y'] + alvo['h'] + 10
        d.rounded_rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 6], radius=26, outline=BRANCO, width=14)
        d.rounded_rectangle([x0, y0, x1, y1], radius=20, outline=VERDE, width=10)
    alto = int(im.height * largura / im.width)
    return im.resize((largura, alto), Image.LANCZOS)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--telas', required=True, type=Path)
    p.add_argument('--saida', type=Path, default=AQUI / 'manual-crad.pdf')
    a = p.parse_args()
    eps = [json.loads(f.read_text(encoding='utf-8')) for f in sorted((AQUI / 'episodios').glob('*.json'))]

    paginas: list[Image.Image] = []
    indice: list[tuple[str, str, int]] = []
    # capa (o índice entra depois, como página 2)
    capa = Image.new('RGB', (L, A), BRANCO)
    d = ImageDraw.Draw(capa)
    logo = Image.open(LOGO).convert('RGBA')
    logo = logo.resize((int(logo.width * 700 / logo.height), 700), Image.LANCZOS)
    capa.paste(logo, ((L - logo.width) // 2, 260), logo)
    for i, (t, f, cor) in enumerate([('Manual de utilização', fonte(84, 'Black'), VERDE), ('Passo a passo, em episódios curtos', fonte(44, 'SemiBold'), AZUL_ESCURO)]):
        d.text((L / 2, 1080 + i * 110), t, font=f, fill=cor, anchor='mm')
    d.text((L / 2, 1300), 'Cada episódio tem um vídeo no app.', font=fonte(34, 'Regular'), fill=AZUL_ESCURO, anchor='mm')
    d.rectangle([0, A - 140, L, A - 70], fill=AZUL)
    d.rectangle([0, A - 70, L, A], fill=AZUL_ESCURO)
    paginas.append(capa)
    paginas.append(None)  # índice

    for n, ep in enumerate(eps, 1):
        telas = a.telas / ep['telas']
        alvos = {c['imagem']: c['alvo'] for c in json.loads((telas / 'cenas.json').read_text())['cenas']}
        passos = [c for c in ep['cenas'] if c['tipo'] == 'tela']
        indice.append((f'{n}. {ep["titulo"]}', ep['publico'], len(paginas) + 1))
        for k in range(0, len(passos), 6):
            pg = Image.new('RGB', (L, A), FUNDO)
            d = ImageDraw.Draw(pg)
            d.rectangle([0, 0, L, 170], fill=AZUL_ESCURO)
            d.text((M, 42), f'EPISÓDIO {n} · {ep["publico"].upper()}', font=fonte(26, 'Bold'), fill=(190, 220, 240))
            d.text((M, 82), ep['titulo'] + (' (continuação)' if k else ''), font=fonte(54, 'Black'), fill=BRANCO)
            for j, c in enumerate(passos[k:k + 6]):
                col, lin = j % 2, j // 2
                x, y = M + col * 540, 210 + lin * 500
                mini = miniatura(telas / c['imagem'], alvos.get(c['imagem']), 210)
                mini = mini.crop((0, 0, mini.width, min(mini.height, 450)))
                d.rounded_rectangle([x - 6, y - 6, x + mini.width + 6, y + mini.height + 6], radius=18, fill=AZUL_ESCURO)
                pg.paste(mini, (x, y))
                tx = x + mini.width + 26
                num = k + j + 1
                d.ellipse([tx, y, tx + 56, y + 56], fill=VERDE)
                d.text((tx + 28, y + 28), str(num), font=fonte(30, 'Black'), fill=BRANCO, anchor='mm')
                yy = y + 72
                for linha in quebrar(d, c['titulo'], fonte(30, 'Bold'), 270):
                    d.text((tx, yy), linha, font=fonte(30, 'Bold'), fill=AZUL_ESCURO)
                    yy += 38
                texto_rico(d, c['fala'], tx, yy + 8, 270, fonte(25, 'Regular'), fonte(25, 'Bold'))
            rodape(d, len(paginas) + 1)
            paginas.append(pg)

    # índice
    ind = Image.new('RGB', (L, A), BRANCO)
    d = ImageDraw.Draw(ind)
    d.text((M, 120), 'Episódios', font=fonte(80, 'Black'), fill=VERDE)
    y = 270
    for titulo, publico, pagina in indice:
        d.text((M, y), titulo, font=fonte(40, 'Bold'), fill=AZUL_ESCURO)
        d.text((M, y + 52), publico, font=fonte(28, 'Regular'), fill=AZUL)
        d.text((L - M, y + 6), f'pág. {pagina}', font=fonte(32, 'SemiBold'), fill=AZUL_ESCURO, anchor='ra')
        d.line([M, y + 100, L - M, y + 100], fill=(205, 225, 238), width=2)
        y += 112
    rodape(d, 2)
    paginas[1] = ind
    paginas[0].save(a.saida, save_all=True, append_images=paginas[1:], resolution=150)
    print(f'Manual pronto: {a.saida} ({len(paginas)} páginas)')


if __name__ == '__main__':
    main()
