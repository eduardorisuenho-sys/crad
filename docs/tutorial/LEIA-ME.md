# Manual de utilização do app CRAD

Série de **12 vídeos curtos** (30 a 60 segundos cada, verticais, para
celular) e um **manual em PDF** com os mesmos passos. Público: de 10 a 80
anos. Linguagem direta, uma frase por tela, os nomes dos botões iguais aos
do app.

| # | Episódio | Perfil |
|---|---|---|
| 1 | Criar conta e entrar | Todos |
| 2 | A tela inicial (e o trabalho sem internet) | Todos |
| 3 | Cadastrar uma matriz | Coletor |
| 4 | Registrar uma coleta | Coletor |
| 5 | O lote de sementes | Viveirista |
| 6 | Cadastro de mudas | Viveirista |
| 7 | Cuidar das mudas (germinação, perdas, pronta, inventário) | Viveirista |
| 8 | Pedir mudas | Solicitante |
| 9 | Analisar e aprovar pedidos | Gestor |
| 10 | Entregar as mudas | Viveirista |
| 11 | Pós-plantio | Solicitante |
| 12 | Para a gestão (equipe, relatórios, lixeira) | Gestor |

O perfil (`perfis` no roteiro) usa os nomes do app e aparece no cartão de
abertura, no topo do vídeo e no manual.

## Linguagem visual

- Abertura com o número do episódio e para quem é; fim com "Próximo: …".
- Topo da tela: "Episódio N · título" e a barra de progresso.
- Legenda grande; os botões aparecem em pílulas verdes, como no app.
- O resto da tela escurece e o botão a tocar fica em destaque, com toque animado.
- Cores da logomarca, transições curtas e trilha calma criada pelo próprio
  montador (sem direitos autorais), que abaixa quando a narração fala.
- Voz: **Chatterbox Multilíngue** (Resemble AI, código aberto, licença MIT),
  que copia o jeito de falar de uma gravação curta (`voz-referencia.wav`).
  Escolhida ouvindo amostras de Kokoro, Supertonic 3, Piper, XTTS-v2 e
  Chatterbox. Cada frase é conferida por um reconhecedor de fala (Whisper) e
  refeita quando sai diferente do texto. A voz recebe um tratamento leve
  (grave, "s" e volume); vozes com chiado (Piper, gravação de celular) passam
  também por RNNoise (`ruido-voz.rnnn`) e redução espectral.
- `voz-referencia.wav`: trecho de audiolivro do LibriVox (domínio público),
  locutora 13069 do conjunto CML-TTS (português, licença CC-BY 4.0). Para usar
  a voz de uma pessoa da equipe, troque o arquivo por uns 15 segundos de
  leitura dela, com autorização por escrito (a voz é dado pessoal na LGPD).

As telas são do app de verdade, com um viveiro de exemplo ("CRAD Palmas"),
quatro pessoas de exemplo e espécies reais: Ipê-amarelo (*Handroanthus
serratifolius*, Bignoniaceae), Jatobá (*Hymenaea courbaril*, Fabaceae) e
Baru (*Dipteryx alata*, Fabaceae).

## Arquivos

- `episodios/NN-nome.json`: roteiro de cada episódio (título, fala e tela de cada passo).
- `app/tutorial/`: servidor de exemplo e o caminho que gera as telas.
- `montar_video.py`: monta um vídeo; `montar_serie.py`: monta todos.
- `gerar_manual.py`: gera o manual em PDF.

## Refazer (depois de mudar o app ou um roteiro)

Tudo gratuito e de código aberto.

```bash
# 1) telas do app (servidor só com os dados de exemplo)
cd app && npx vite build && CRADS_TUTORIAL_DIR=/tmp/telas npx playwright test -c tutorial

# 2) voz neural Kokoro
pip install sherpa-onnx numpy pillow
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2 | tar xj

# 3) vídeos e manual
python3 docs/tutorial/montar_serie.py --telas /tmp/telas --voz kokoro-multi-lang-v1_0 --saida videos/
python3 docs/tutorial/gerar_manual.py --telas /tmp/telas --saida manual-crad.pdf
```

Um episódio só: `montar_serie.py ... 03-matriz`.

### Com a voz de uma pessoa

Grave cada fala do roteiro (pelo celular mesmo) como `cena-01.wav`,
`cena-02.wav`… (na ordem das cenas, contando a abertura e o fim) e rode
`montar_video.py --roteiro episodios/03-matriz.json --telas /tmp/telas/03-matriz --gravacoes <pasta>`.

## Versão profissional (HyperFrames)

`hf/episodio_hf.py` transforma um roteiro numa composição
[HyperFrames](https://github.com/heygen-com/hyperframes) (HTML + animação,
renderizada em vídeo): celular grande, o resto da tela escurece, o botão
fica em destaque, o dedo animado toca no botão no momento em que a narração
fala o nome dele, legenda palavra por palavra e cartões de abertura e de
"Próximo episódio". Áudio: voz Kokoro, trilha calma que abaixa sob a voz e
volume final em -14 LUFS (padrão de plataformas de vídeo).

No roteiro, cada cena pode ter vários botões (`alvos` na gravação das telas),
`"dedo": false` (só destaque, sem toque) e `"destaque": "uniao"` (um
destaque só em volta de vários campos).

```bash
cd docs/tutorial/hf && npm install
# voz: Chatterbox num ambiente Python separado (torch) + Whisper para conferir
uv venv -p 3.11 venv-voz && uv pip install --python venv-voz/bin/python \
  --extra-index-url https://download.pytorch.org/whl/cpu chatterbox-tts "setuptools<80"
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2 | tar xj
python3 episodio_hf.py --roteiro ../episodios/03-matriz.json --telas /tmp/telas/03-matriz \
  --voz ../voz-referencia.wav --python-voz venv-voz/bin/python \
  --whisper sherpa-onnx-whisper-small --projeto /tmp/hf-ep03
npx hyperframes check /tmp/hf-ep03          # erros, contraste (WCAG AA)
npx hyperframes render /tmp/hf-ep03 -o ep03.mp4 --fps 30
```

O HyperFrames é de código aberto. A animação usa o GSAP, que é gratuito mas
não é de código aberto; ele fica só aqui, na produção dos vídeos, e não entra
no app.
