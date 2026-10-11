# CRADS — Centro de Recuperação de Áreas Degradadas

Aplicativo de gestão pública de mudas nativas da Secretaria de Meio Ambiente e
Recursos Hídricos do Tocantins. Ele acompanha cada muda desde a árvore matriz
até o plantio:

**matriz `MT-0123` → lote de sementes `LS-2026-045` → lote de mudas `LM-2026-045-A` → doação `DO-2026-310`**

O app funciona **sem internet** em campo e roda no navegador do celular
(Android e iPhone) e do computador. A hospedagem é gratuita.

- [Plano de arquitetura](docs/01-arquitetura.md)
- [Modelo de dados](docs/02-modelo-de-dados.md)

## Situação

| Etapa | Situação |
|---|---|
| 1. Base de dados e sincronização offline | **pronta** |
| 2. Módulo 1, Matrizes, com o assistente de identificação | **pronta** |
| 3. Módulo 2, Coleta e lotes de sementes | próxima |
| 4 a 8. Viveiro, Catálogo, Doação (com Plantando Água), Pós-plantio, Relatórios | a fazer |

O que o Módulo 1 entrega (tudo funciona sem internet):

- **Espécies:**
  - lista com busca tolerante (sem acento, variação regional, erro de digitação);
  - ficha editável pelo gestor;
  - nomes populares;
  - marcação **"revisar"** com o motivo.
- **Importação de espécies** pela tela do gestor, sempre com prévia antes de gravar:
  - da planilha de controle atual (aba "Espécies") ou do modelo completo `dados/modelo-especies.xlsx`;
  - do pacote de dados abertos da **Flora e Funga do Brasil**, filtrado por UF e forma de vida.
- **Assistente de identificação:**
  - uma pergunta por tela, com figuras;
  - "não sei" não pesa, e um engano é tolerado;
  - filtro por bioma e época (flor/fruto no mês);
  - comparação lado a lado;
  - grau de certeza (certo, provável, a identificar).
- **Cadastro de matriz:**
  - GPS com a precisão em metros;
  - espécie pelo assistente ou pelo nome;
  - **alerta de matriz da mesma espécie a menos de 100 m**;
  - fotos comprimidas no aparelho, com as obrigatórias definidas por parâmetro;
  - dados da árvore (altura, DAP/CAP, estado, local);
  - proprietário, com o telefone visível só para o gestor;
  - plaqueta com QR code para imprimir.
- **Ficha da matriz:**
  - fotos, mesmo sem internet;
  - registro de fenologia a cada visita;
  - **validação do gestor**: confirma a espécie e aprova ou reprova. Só aprova com espécie "certa" e GPS válido.
- **Lista de matrizes:**
  - fila "para validar";
  - **metas por espécie** (ex.: 12);
  - leitura da plaqueta pelo QR (câmera, foto do QR ou digitando o código).

O que a etapa 1 entrega:

- **Esquema único** (`dominio/src/esquema.ts`): define todas as tabelas do
  modelo aprovado. O servidor e o aparelho são gerados a partir dele.
- **Banco no aparelho** (IndexedDB): cada alteração entra numa **fila** e
  espera o sinal. Ao fechar o app ou desligar o celular, nada se perde.
- **Sincronização** com:
  - reenvio seguro, que não duplica registros;
  - fusão campo a campo quando duas pessoas mexem no mesmo cadastro;
  - tela de **Avisos** para os conflitos.
- **Códigos do lote sem internet**: cada aparelho reserva uma faixa de códigos
  com o botão “Preparar para ir a campo”. Se a faixa acabar, o código fica
  provisório e o servidor troca pelo definitivo, avisando o usuário.
- **Perfis por viveiro** (coletor, viveirista, gestor, solicitante). Cada
  pessoa só recebe os dados do seu viveiro.
- **LGPD**: CPF, documento e telefone ficam numa tabela que só o gestor lê.
  Se outra pessoa cadastrou o dado, ele é apagado do aparelho dela depois de
  enviado.
- **Auditoria**: toda criação e alteração fica registrada com usuário,
  aparelho, data no aparelho e data no servidor. Isso vale também para o
  que for feito pelo painel do PocketBase, que não deixa apagar de verdade.
- **App instalável (PWA)** com:
  - tela inicial de ícones grandes;
  - login que continua valendo sem internet por 30 dias;
  - escolha do viveiro;
  - cadastro de viveiros;
  - guia de instalação no iPhone.

## Como o projeto está organizado

```
dominio/    regras de negócio em TypeScript, usadas pelo app e pelo servidor
servidor/   PocketBase: migrações geradas do esquema, rotas de sincronização (pb_hooks)
app/        o aplicativo (React + Vite + PWA)
docs/       arquitetura e modelo de dados
```

## Rodar no seu computador

Você precisa do **Node.js 22** ou mais novo.

```bash
npm install                                # instala tudo
npm run baixar-pocketbase -w servidor      # baixa o PocketBase (um arquivo só)
npm run dev -w servidor                    # sobe o servidor em http://127.0.0.1:8090
```

Na primeira vez, o terminal mostra um link para criar o **superusuário** do
painel (`http://127.0.0.1:8090/_/`). Depois, no painel:

1. Abra **users** e crie o primeiro gestor: e-mail, senha, nome e
   **gestor_geral** marcado.
2. Em outro terminal, rode `npm run dev` (o app abre em http://localhost:5173)
   e entre com esse gestor.
3. Pelo app, cadastre os viveiros em **Viveiros**.
4. Para dar perfil a coletores e viveiristas: crie a pessoa em **users** e um
   registro em **usuario_viveiro** com o `usuario_id`, o `viveiro_id` e o
   `perfil`. Hoje isso se faz pelo painel; a tela de usuários entra numa
   próxima etapa.

### Testes

```bash
npm test             # regras de negócio, sincronização offline e servidor real
npm run test:e2e     # navegador: abre, grava sem internet e envia quando o sinal volta
npm run typecheck
```

Os testes do servidor e o de ponta a ponta sobem um PocketBase temporário
sozinhos. Para isso, é preciso ter rodado `npm run baixar-pocketbase -w
servidor` antes.

## Hospedar de graça

São duas partes: o **app**, que é um site estático, e o **servidor**, o
PocketBase.

### Servidor: Oracle Cloud “Always Free”

1. Crie uma conta em cloud.oracle.com e uma VM **Ampere (ARM) Always Free**
   com Ubuntu. Ela dá até 4 núcleos, 24 GB de memória e 200 GB de disco.
2. Libere as portas 80 e 443 na *Security List* da rede e no firewall da VM.
3. Aponte um domínio para o IP da VM. Pode ser um subdomínio do órgão (pedir
   à ATI) ou um gratuito (ex.: DuckDNS).
4. Na VM:
   ```bash
   sudo apt install -y unzip nodejs npm git
   git clone <este repositório> crads && cd crads/servidor
   npm run baixar-pocketbase
   sudo ./pocketbase serve crads.seudominio.gov.br   # HTTPS automático (Let's Encrypt)
   ```
   Para iniciar sozinho ao ligar a VM, crie um serviço do `systemd` com o
   mesmo comando.
5. **Backup:** no painel (`/_/`), vá em *Settings → Backups*, ative o backup
   automático diário e envie para um armazenamento S3 gratuito (Cloudflare R2
   ou Backblaze B2, 10 GB grátis). A Oracle pode recuperar VMs gratuitas
   paradas, então o backup é obrigatório.

### App: Cloudflare Pages (ou GitHub Pages)

- Comando de build: `npm install && npm run build -w app`
- Pasta publicada: `app/dist`
- Variável de ambiente: `VITE_SERVIDOR_URL=https://crads.seudominio.gov.br`

O app precisa de **HTTPS** para funcionar offline, usar o GPS e a câmera. Os
dois serviços já dão HTTPS.

### Atualizar

- **Servidor:** `git pull` e reinicie o PocketBase. As migrações rodam sozinhas.
- **App:** cada publicação nova chega aos aparelhos na próxima vez em que
  abrirem com internet.

## iPhone

No iPhone, o CRADS precisa ser **adicionado à tela de início** pelo Safari
(Compartilhar → Adicionar à Tela de Início). Se for usado só dentro do Safari,
o iPhone pode apagar os dados guardados sem internet depois de 7 dias sem
uso. O app mostra esse aviso e um guia com figuras.

## Importar a planilha de espécies

No app, entre como gestor e vá em **Espécies → Importar**.

- **Planilha (.xlsx, .xlsm ou .csv):**
  - O app acha as colunas pelo título: *Nome popular* (aceita "Nome Polular"),
    *Família* e *Nome científico*. As outras colunas da ficha são opcionais.
  - Pode ser a planilha de controle usada hoje: só a lista de espécies é lida,
    sem quantidades.
  - O modelo completo, com instruções, está em `dados/modelo-especies.xlsx`.
  - A mesma espécie em várias linhas vira um registro só, com todos os nomes
    populares. "Pau-de-óleo/Copaíba" vira dois nomes.
  - Variedades e subespécies ficam separadas.
  - É marcado **"revisar"**, com o motivo: família diferente na mesma espécie,
    nome com "ou" ou "et al." e nome só até o gênero.
  - A importação **nunca sobrescreve** a ficha: só completa campos vazios e
    acrescenta nomes populares. Pode importar de novo sem duplicar.
  - A linha de exemplo do modelo (família "Ficticiaceae") entra marcada como
    fictícia e não aparece no catálogo.
- **Flora e Funga do Brasil (.zip):**
  - Baixe o pacote "Darwin Core Archive" da Lista de Espécies da Flora do
    Brasil no IPT do JBRJ (ipt.jbrj.gov.br) e envie o .zip.
  - Entram as espécies aceitas que ocorrem na UF (TO), por padrão árvores,
    arbustos e palmeiras, com nomes populares, sinônimos, biomas e origem
    (nativa, cultivada…).
  - Se o nome da planilha for sinônimo na Flora, a espécie é marcada
    "revisar" com o nome aceito. A troca de nome fica com a equipe.
  - Atenção: este importador foi testado com um pacote de exemplo no formato
    oficial, mas não com o arquivo real, porque a rede usada no
    desenvolvimento não alcança o site do JBRJ. Teste com o arquivo verdadeiro
    na primeira importação e confira a prévia.
- **Assistente:** em **Espécies → Assistente de identificação**:
  - "Criar perguntas padrão" cria as perguntas de folha, disposição, látex,
    espinhos, casca, flor e fruto;
  - na ficha de cada espécie, o gestor marca as respostas que valem para ela;
  - "Espécies fictícias de treino" cria 5 espécies inventadas para
    treinar a equipe.

## Decisões pequenas tomadas sem consulta

- Códigos `MT` numa sequência única do órgão (não por viveiro). `LS` e `DO`
  recomeçam a cada ano. `LM` herda o número do `LS` e ganha uma letra.
- Datas guardadas como texto ISO 8601.
- Ligações entre tabelas guardadas como texto e não como “relation” do
  PocketBase, porque offline um registro filho pode chegar antes do pai. A
  integridade é conferida pelas regras do domínio.
- O PocketBase guarda número vazio como 0 e texto vazio como "". Para a
  sincronização, vazio, 0 e "" contam como iguais.
- Eventos (perdas, movimentos de estoque, fotos) **nunca** são alterados ou
  apagados. Uma correção é um novo evento.
- Exclusão é sempre lógica (campo `excluido`).
- Todo acesso aos dados passa pelas rotas `/api/crads/*`. O acesso direto às
  tabelas fica só para o superusuário.
- A sessão do aparelho vale 30 dias sem internet (parâmetro
  `dias_sessao_offline`).
- Gravação de trilha GPS não existe. Só o ponto da matriz, da coleta e da foto.
- Fotos: lado maior de 1280 px (JPEG) e miniatura de 320 px. A miniatura fica
  no aparelho para ver as fotos sem internet.
- As fotos obrigatórias da matriz (árvore inteira e folhas) e a precisão
  mínima do GPS (30 m) são parâmetros do gestor.
- O QR da plaqueta guarda só o código (ex.: `MT-0123`): qualquer leitor
  mostra o código, e o CRADS abre a ficha.
- O gestor aprova uma matriz só com a espécie confirmada como "certo" e com
  GPS válido. Só matriz aprovada poderá fornecer sementes (Módulo 2).
- Ainda não há lista de municípios com contorno (IBGE). Por isso o filtro do
  assistente por município fica para quando essa base for importada. O filtro
  por bioma e época já funciona.
- Licença: **AGPL-3.0** (arquivo `LICENSE`). Quem adaptar e hospedar o app
  (outros municípios, consórcios) precisa manter o código aberto.

## Pendências

- `especificacao.md`: o projeto segue o prompt inicial. As regras marcadas
  como **[hipótese]** no modelo de dados continuam valendo até haver uma
  especificação.
- Modelo visual (design): a ser enviado. As cores e os tamanhos estão em
  `app/src/estilo.css` (variáveis no topo), para facilitar a troca.
- Base de municípios do Tocantins com contorno (IBGE), para o filtro por
  município e o pacote de campo.
- Modelo do termo de doação de mudas (PDF da retirada, Módulo 5).
- Modelo da ficha de solicitação de mudas.
