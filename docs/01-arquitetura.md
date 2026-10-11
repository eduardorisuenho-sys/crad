# CRADS — Plano de arquitetura e stack

> Estado: **proposta, aguardando aprovação**. Nenhum código foi escrito ainda.
>
> Atenção: o arquivo `especificacao.md` **não chegou ao repositório** (assim como
> a tabela de sementes/mudas e o termo de doação). Este plano foi feito a partir
> do prompt inicial. Tudo marcado com **[hipótese]** deve ser conferido contra a
> especificação quando ela for adicionada.

## 1. Decisão principal: PWA (recomendado) × app nativo

### Comparação ponto a ponto

| Requisito | PWA (React + TS + Vite) | Nativo (React Native / Expo) |
|---|---|---|
| **Offline** | Service Worker (Workbox) guarda o app; dados em IndexedDB (Dexie). `navigator.storage.persist()` protege os dados contra limpeza automática (Chrome Android e Safari 17+). **No iPhone o app precisa ser instalado na tela de início**: no Safari comum, os dados podem ser apagados após 7 dias sem uso. O app mostra um guia de instalação no primeiro acesso. | SQLite nativo, que é o mais robusto. |
| **GPS** | API de Geolocalização funciona sem internet (usa o chip GPS). **Limite:** não grava a trilha com a tela desligada. | Grava em segundo plano. |
| **Câmera + compressão** | `<input capture>` ou `getUserMedia` + compressão em canvas (JPEG/WebP, ~1280 px, ~150 KB). Funciona bem em aparelhos simples. | Equivalente. |
| **QR code** | `BarcodeDetector` no Chrome Android; `zxing-wasm` no iPhone (Safari não tem a API) e em navegadores antigos. | Equivalente (expo-camera). |
| **Mapa offline** | MapLibre GL + arquivo **PMTiles** da região, guardado no aparelho (OPFS/IndexedDB). Funciona, com um pouco mais de código. | MapLibre nativo tem “pacotes offline” prontos. Vantagem nativa. |
| **Computador (gestor, relatórios, portal)** | O mesmo app, no navegador. | Exige `react-native-web`, mais fraco para telas de administração, ou um segundo app web. |
| **Distribuição e atualização** | Um link, “Instalar na tela inicial”, e atualização automática. Sem loja, no Android e no iPhone. | Play Store (US$ 25) **e App Store (US$ 99 por ano, que quebra o custo zero)**, builds (cota gratuita do EAS limitada), revisões das lojas e usuários com versões antigas. |
| **Custo e manutenção** | Um código, hospedagem estática gratuita, equipe web comum. | Dois alvos e mais ferramentas. |
| **Adoção por outros municípios** | Basta hospedar os arquivos estáticos e o servidor. | É preciso publicar outro app na loja ou usar o mesmo app multi-instalação. |

### Recomendação

**PWA**, como você sugeriu. As únicas vantagens reais do nativo são a trilha GPS
em segundo plano e os pacotes de mapa offline. A segunda resolve-se com PMTiles.
A primeira **não é exigida** (confirmado): o app grava offline só o **ponto
GPS da matriz**, e o mapa da rota mostra as matrizes e a posição atual, sem
gravar trilha. Como há usuários de **iPhone**, o nativo também exigiria a
App Store (US$ 99/ano). Isso reforça a escolha do PWA.

**Saída de emergência:** se um dia for preciso armazenamento garantido, o
mesmo código pode ser empacotado com **Capacitor** (APK) sem reescrever nada. Por isso a lógica de câmera, GPS e arquivos fica
atrás de uma camada `plataforma/`.

## 2. Backend: PocketBase (recomendado) × Supabase

| Critério | PocketBase | Supabase |
|---|---|---|
| Custo | Um binário Go + SQLite. Roda numa VM **Oracle Cloud Always Free** (ARM, 24 GB RAM, 200 GB disco) ou num servidor da secretaria/ATI. Custo zero. | Plano gratuito: 500 MB de banco e **1 GB de arquivos**. O projeto **pausa após 7 dias sem uso**, o que é arriscado para um serviço público. Auto-hospedar exige ~10 contêineres. |
| Fotos | Disco local ou S3 (Cloudflare R2: 10 GB grátis). | 1 GB grátis, o que dá cerca de 6 mil fotos. |
| Manutenção | Um arquivo para rodar e um arquivo (`.db`) para fazer backup. Ideal para equipe pequena e para outros municípios copiarem. | Mais poderoso (Postgres, PostGIS, RLS), porém mais complexo. |
| Regras de negócio no servidor | Hooks em JavaScript (`pb_hooks`). A mesma lógica de domínio em TS pode ser empacotada com esbuild e usada no app e no servidor. | Funções SQL/Edge Functions, em outra linguagem. |
| LGPD | Regras de acesso por coleção. CPF e telefone ficam numa coleção separada que só o gestor lê. | RLS por linha e coluna. |
| Sincronização offline | Nenhuma pronta nos dois. Será um endpoint próprio (`/api/sync`), descrito abaixo. | Igual. |

**Decisão: PocketBase na VM gratuita da Oracle Cloud (Always Free)**,
confirmada pela opção “hospedagem gratuita”. O README terá o passo a passo.
Cuidado conhecido: a Oracle pode recuperar VMs gratuitas ociosas, por isso o
backup diário automático para armazenamento externo gratuito (R2/B2) é
obrigatório, e a reinstalação deve levar poucos minutos com o script.

## 3. Stack proposta

| Camada | Escolha | Por quê |
|---|---|---|
| App | React 18 + TypeScript + Vite + `vite-plugin-pwa` (Workbox) | Sugestão aceita; ecossistema grande. |
| Banco local | Dexie (IndexedDB) | Consultas indexadas, transações, bom suporte a testes (`fake-indexeddb`). |
| Interface | CSS próprio com tokens (botões ≥ 56 px, ícones grandes) + ícones SVG | Sem framework pesado, para caber em celular simples. |
| Rotas | React Router | Simples. |
| Mapa | MapLibre GL + PMTiles (base Protomaps/OSM, recortada para o Tocantins) | Funciona offline. **Não** dá para baixar blocos do servidor do OSM em massa: a política de uso proíbe. |
| PDF | pdfmake (no aparelho) | Gera termo, ofício e relatórios até sem internet. |
| Planilha | `exceljs` (exportar) + `read-excel-file`/`xlsx` leitura | Importação de espécies e exportação. A versão do SheetJS no npm está desatualizada, por isso não é a escolhida. |
| KML | Gerador próprio (texto XML) | Trivial, sem dependência. |
| Assinatura | `signature_pad` | Leve, funciona no toque. |
| QR | `qrcode` (gerar) + `BarcodeDetector`/`zxing-wasm` (ler) | Funciona offline. |
| Servidor | PocketBase (migrações em JS versionadas no repositório) | Ver seção 2. |
| Testes | Vitest (regras de negócio, Dexie com `fake-indexeddb`) + Playwright (fluxo com `context.setOffline(true)`) | Atende ao item 4 do pedido. |
| Hospedagem | App estático: Cloudflare Pages ou GitHub Pages (grátis). Servidor: Oracle Always Free ou servidor do órgão. Backup diário do `.db` e das fotos para R2/B2 (grátis até 10 GB). | Custo zero. |

### Estrutura do repositório

```
app/          PWA (React)
  src/plataforma/   câmera, GPS, QR, arquivos (isolado p/ Capacitor no futuro)
  src/dados/        Dexie, fila de sincronização, pacote de campo
  src/modulos/      matrizes, coleta, viveiro, catalogo, doacao, pos-plantio, relatorios
dominio/      regras de negócio puras em TS (usadas no app, nos testes e no servidor)
servidor/     PocketBase: pb_migrations/, pb_hooks/ (sync, auditoria, códigos), Dockerfile
dados/        modelo de planilha de espécies, espécies FICTÍCIAS de exemplo
docs/         este plano, modelo de dados, decisões
```

## 4. Funcionamento offline e sincronização

1. **IDs gerados no aparelho:** todo registro nasce com um ID aleatório de 15
   caracteres (formato aceito pelo PocketBase). Ele não muda ao sincronizar.
2. **Códigos legíveis sem internet** (`MT-0123`, `LS-2026-045`…). Ao baixar o
   pacote de campo, o aparelho **reserva uma faixa de códigos** (ex.:
   MT-0500 a MT-0519). Assim a plaquinha/QR impressa em campo já tem o código
   definitivo. Se a faixa acabar, usa-se um código provisório (`MT-P-xxxx`) que
   o servidor troca na sincronização, e o QR, que guarda o ID, continua valendo.
3. **Fila de saída (outbox):** cada alteração vira uma operação com ID próprio.
   O envio é idempotente: reenviar não duplica nada. Fotos vão depois, em fila
   separada, e só quando houver sinal (opção “só no Wi-Fi”).
4. **Recebimento:** o servidor mantém um contador crescente (`seq`). O aparelho
   pede “tudo depois do meu último `seq`”, filtrado pelo perfil e pelo viveiro
   do usuário.
5. **Conflitos**, conforme o tipo de dado:
   - **Eventos** (coleta, perda, medição, contagem, foto, monitoramento) são
     só-acréscimo e nunca entram em conflito.
   - **Estoque** nunca é um número editado. É sempre a soma dos movimentos, e
     movimentos não conflitam.
   - **Cadastros editáveis** (matriz, espécie, pedido) usam versão otimista e
     fusão campo a campo. Se o mesmo campo mudou dos dois lados, vale o servidor
     e abre-se um item em **“Conflitos para revisar”** com as duas versões.
   - **Reserva de estoque e aprovação de doação** exigem conexão. Isso evita
     reservar a mesma muda duas vezes. **Retirada** pode ser feita offline; o
     servidor valida e, se faltar saldo, abre um conflito para o gestor.
6. **Pacote de campo:** espécies do município (pela lista curada do município
   ou pelo bioma), fichas, fotos comprimidas, perguntas e figuras do assistente,
   matrizes já cadastradas da área, recorte do mapa (PMTiles) e faixa de
   códigos. A tela mostra o tamanho do pacote e a data em que foi baixado.
7. **Login offline:** a sessão fica salva no aparelho por N dias (parâmetro).
   Sem internet, o app abre com a última sessão válida.

## 5. Perfis, viveiros, LGPD e auditoria (resumo)

- Perfis: `coletor`, `viveirista`, `gestor`, `solicitante`, além do acesso
  público sem login. O perfil vale **por viveiro**, e um gestor pode ter
  escopo “todos os viveiros”. O perfil que aprova doações é um **parâmetro**.
- LGPD: CPF e telefone ficam em `dados_pessoais`, que só o gestor lê. O
  portal e o catálogo leem **visões públicas** sem dados pessoais, e a
  posição das matrizes aparece só no nível de município **[hipótese]**.
- Auditoria: hook no servidor registra toda criação, alteração e exclusão
  (que é lógica, nunca física), com usuário, aparelho, data no aparelho e data
  no servidor, e o “antes/depois”.

## 6. Ordem de construção

1. Base de dados, sincronização e pacote de campo, com testes da fila e de conflitos.
2. Módulo 1, Matrizes, com o assistente de identificação, a importação de espécies e a tela de administração das fichas.
3. Módulo 2, Coleta e lotes de sementes, com o endereçamento do armazenamento.
4. Módulo 3, Viveiro.
5. Módulo 4, Catálogo público.
6. Módulo 5, Doação, com o Plantando Água.
7. Módulo 6, Pós-plantio.
8. Módulo 7, Relatórios e portal.

Cada etapa traz testes das regras de negócio em Vitest e um teste do fluxo sem
internet em Playwright.

## 7. Decisões confirmadas

1. **Servidor:** gratuito. PocketBase na Oracle Cloud Always Free, app estático no Cloudflare Pages.
2. **GPS:** só o ponto da matriz (e das coletas e fotos), offline. Sem gravação de trilha.
3. **Coordenadas no portal público:** em aberto (ver pergunta no README/conversa).
   Enquanto não houver resposta, o portal mostra só o município.
4. **Aparelhos:** iPhone, Android e computador. O app é testado no Chrome
   Android, no Safari iOS e em navegadores de computador.
