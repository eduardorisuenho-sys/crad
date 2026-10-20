# Vídeo-tutorial: Coleta de sementes

Para quem vai a campo coletar, de 10 a 80 anos. Didático e direto: uma
ideia por cena, frases curtas, telas de verdade do app e narração.

- **Vídeo:** `tutorial-coleta-de-sementes.mp4` (vertical, para celular, cerca
  de 4 minutos). Pode ser enviado pelo WhatsApp.
- **Roteiro:** `roteiro.json` (capítulos, título, legenda e fala de cada cena).

## Linguagem visual

- Abertura que diz o que a pessoa vai aprender; três capítulos numerados
  ("Antes de sair", "Cadastrar a árvore matriz", "Colher as sementes");
  resumo "Lembre-se" com os 4 pontos principais; encerramento.
- Letras grandes e alto contraste, nas cores da logomarca.
- Legenda com os nomes dos botões em pílulas verdes, iguais às do app.
- O resto da tela escurece e o botão a tocar fica em destaque, com animação
  de toque.
- Barra de progresso, transições suaves e trilha sonora calma, criada pelo
  próprio montador (sem direitos autorais), que abaixa quando a narração fala.

## O que o vídeo ensina (em ordem)

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

# 2) voz neural Kokoro (código aberto, roda sem internet), voz "Dora" em português do Brasil
pip install sherpa-onnx numpy pillow
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2 | tar xj

# 3) monta o vídeo
python3 docs/tutorial/montar_video.py --telas /tmp/telas --voz kokoro-multi-lang-v1_0
```

### A voz

Comparamos 7 vozes neurais gratuitas em português (Piper faber, cadu, jeff,
dii e Kokoro dora, alex, santa): cada uma leu as frases do roteiro e um
reconhecedor de fala (Whisper) transcreveu o que ouviu. A Kokoro "Dora" foi
a mais clara (2% de palavras erradas, contra 5% a 21% das outras) e a única
que falou "CRAD" certo. Ela fala um pouco mais devagar que o normal
(`--velocidade 0.92`) e com pausa entre as frases. Outras vozes:
`--falante 43` (Alex) ou `--falante 44` (Santa).

### Com a voz de uma pessoa

Para uma narração ainda mais humana, grave cada fala do `roteiro.json` (pelo celular mesmo) como
`cena-01.wav`, `cena-02.wav`… numa pasta e rode:

```bash
python3 docs/tutorial/montar_video.py --telas /tmp/telas --gravacoes pasta-das-gravacoes
```

Cenas sem gravação usam a voz sintética, se `--voz` também for passado.

As telas usam uma coletora de exemplo ("Ana") e o Ipê-amarelo
(*Handroanthus serratifolius*, Bignoniaceae). Nos fundos de mapa, a imagem de
satélite não aparece nas telas geradas sem internet; no celular ela aparece.
