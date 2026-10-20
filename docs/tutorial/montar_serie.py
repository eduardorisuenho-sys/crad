#!/usr/bin/env python3
"""
Monta todos os episódios do manual em vídeo (um por arquivo de episodios/).
Uso: python3 montar_serie.py --telas <pasta com as telas> --voz <pasta kokoro> [--saida videos/] [episódio...]
As telas vêm de: cd app && CRADS_TUTORIAL_DIR=<pasta> npx playwright test -c tutorial
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent

p = argparse.ArgumentParser()
p.add_argument('--telas', required=True, type=Path)
p.add_argument('--voz', required=True)
p.add_argument('--saida', type=Path, default=AQUI / 'videos')
p.add_argument('episodios', nargs='*', help='ex.: 03-matriz (sem nada, todos)')
a = p.parse_args()
a.saida.mkdir(parents=True, exist_ok=True)
for r in sorted((AQUI / 'episodios').glob('*.json')):
    if a.episodios and r.stem not in a.episodios:
        continue
    roteiro = json.loads(r.read_text(encoding='utf-8'))
    destino = a.saida / f'{r.stem}.mp4'
    print(f'== {r.stem}: {roteiro["titulo"]}', flush=True)
    subprocess.run([sys.executable, str(AQUI / 'montar_video.py'), '--roteiro', str(r), '--telas', str(a.telas / roteiro['telas']),
                    '--voz', a.voz, '--saida', str(destino)], check=True)
