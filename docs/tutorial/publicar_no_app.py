#!/usr/bin/env python3
"""
Leva a série pronta para o app (tela Ajuda): cada vídeo em 720p (leve para o
celular e para guardar sem internet), a capa (quadro do cartão de abertura), o
manual em PDF e a lista de episódios (título, perfil, duração, tamanho), gerada
dos roteiros para não ficar desatualizada.

Uso: python3 publicar_no_app.py --videos <pasta com NN-nome.mp4> [--manual manual-crad.pdf]
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
PUBLICO = RAIZ / 'app/public/ajuda'
LISTA = RAIZ / 'app/src/modulos/ajuda/episodios.gerado.ts'


def duracao(arq: Path) -> float:
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(arq)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--videos', required=True, type=Path)
    p.add_argument('--manual', type=Path, default=AQUI / 'manual-crad.pdf')
    a = p.parse_args()
    PUBLICO.mkdir(parents=True, exist_ok=True)
    itens = []
    for roteiro in sorted((AQUI / 'episodios').glob('*.json')):
        ep = json.loads(roteiro.read_text(encoding='utf-8'))
        nome = roteiro.stem
        origem = a.videos / f'{nome}.mp4'
        if not origem.exists():
            raise SystemExit(f'Falta o vídeo {origem}')
        video, capa = PUBLICO / f'{nome}.mp4', PUBLICO / f'{nome}.jpg'
        # 720x1280, H.264 compatível com celulares antigos, som AAC; faststart: começa a tocar antes de baixar tudo
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(origem), '-vf', 'scale=720:1280:flags=lanczos',
                        '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(video)], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '0.8', '-i', str(origem), '-frames:v', '1',
                        '-vf', 'scale=360:640', '-q:v', '4', str(capa)], check=True)
        itens.append({
            'numero': int(nome[:2]),
            'titulo': ep['titulo'],
            'perfis': ep['perfis'],
            'video': f'/ajuda/{nome}.mp4',
            'capa': f'/ajuda/{nome}.jpg',
            'segundos': round(duracao(video)),
            'bytes': video.stat().st_size,
        })
        print(f'{nome}: {itens[-1]["segundos"]} s, {itens[-1]["bytes"] / 1e6:.1f} MB')
    if a.manual.exists():
        shutil.copy(a.manual, PUBLICO / 'manual-crad.pdf')
    corpo = json.dumps(itens, ensure_ascii=False, indent=2)
    LISTA.write_text(
        '// Gerado por docs/tutorial/publicar_no_app.py a partir dos roteiros. Não edite à mão.\n'
        "import type { Episodio } from './episodios';\n\n"
        f'export const EPISODIOS: Episodio[] = {corpo};\n', encoding='utf-8')
    total = sum(i['bytes'] for i in itens) / 1e6
    print(f'{len(itens)} episódios, {total:.0f} MB no total -> {PUBLICO}')


if __name__ == '__main__':
    main()
