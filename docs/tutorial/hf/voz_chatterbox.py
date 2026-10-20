#!/usr/bin/env python3
"""
Narração com o Chatterbox Multilíngue (Resemble AI, licença MIT), que copia o
jeito de falar de uma gravação curta de referência. Roda no ambiente Python
dele (torch), separado do resto; o episodio_hf.py chama este arquivo.

Uso: python voz_chatterbox.py --ref voz.wav --pedido frases.json --saida <pasta>
frases.json: [{"id": "f001", "texto": "...", "semente": 1}, ...] -> <pasta>/f001.wav
"""
import argparse
import json
from pathlib import Path

import torch
import torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--ref', required=True)
    p.add_argument('--pedido', required=True, type=Path)
    p.add_argument('--saida', required=True, type=Path)
    a = p.parse_args()
    torch.set_num_threads(max(1, torch.get_num_threads()))
    modelo = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    a.saida.mkdir(parents=True, exist_ok=True)
    for f in json.loads(a.pedido.read_text(encoding='utf-8')):
        torch.manual_seed(f.get('semente', 1))
        wav = modelo.generate(f['texto'], language_id='pt', audio_prompt_path=a.ref,
                              exaggeration=0.5, cfg_weight=0.5, temperature=0.7)
        torchaudio.save(str(a.saida / f"{f['id']}.wav"), wav, modelo.sr)
        print(f['id'], flush=True)


if __name__ == '__main__':
    main()
