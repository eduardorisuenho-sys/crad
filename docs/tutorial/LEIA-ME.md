# Vídeo-tutorial: Matrizes e coleta de sementes

Para quem vai a campo coletar. Linguagem simples (pensada para quem tem 10
anos), com as telas de verdade do app e narração.

- **Vídeo:** `tutorial-matrizes-e-coleta.mp4` (vertical, para celular, cerca
  de 4 minutos). Pode ser enviado pelo WhatsApp.
- **Roteiro:** `roteiro.json` (título, legenda e fala de cada cena).

## O que o vídeo ensina

1. Preparar o celular para ir a campo (funciona sem internet).
2. Cadastrar uma matriz: lugar pelo GPS, espécie, fotos, como é a árvore,
   dono do terreno, salvar e prender a plaqueta.
3. Marcar flor e fruto a cada visita.
4. Rota de coleta até a árvore.
5. Registrar a coleta (quanto e o quê), e o botão verde "Coleta" para
   árvores que não são matriz.
6. Ver "Tudo enviado" quando a internet volta.

## Refazer o vídeo (depois de mudar o app ou o roteiro)

Tudo gratuito e de código aberto.

```bash
# 1) telas do app (sobe o servidor de teste e percorre o caminho do coletor)
cd app && CRADS_TUTORIAL_DIR=/tmp/telas npx playwright test e2e/tutorial.spec.ts

# 2) voz sintética Piper (código aberto, roda sem internet)
pip install piper-tts
curl -LO https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-pt-br-edresson-low.tar.gz
tar xzf voice-pt-br-edresson-low.tar.gz

# 3) monta o vídeo
python3 docs/tutorial/montar_video.py --telas /tmp/telas --voz pt-br-edresson-low.onnx
```

### Com a voz de uma pessoa (recomendado para crianças)

A voz sintética é compreensível, mas robótica. Para uma narração mais
acolhedora, grave cada fala do `roteiro.json` (pelo celular mesmo) como
`cena-01.wav`, `cena-02.wav`… numa pasta e rode:

```bash
python3 docs/tutorial/montar_video.py --telas /tmp/telas --gravacoes pasta-das-gravacoes
```

Cenas sem gravação usam a voz sintética, se `--voz` também for passado.

As telas usam uma coletora de exemplo ("Ana") e o Ipê-amarelo
(*Handroanthus serratifolius*, Bignoniaceae). Nos fundos de mapa, a imagem de
satélite não aparece nas telas geradas sem internet; no celular ela aparece.
