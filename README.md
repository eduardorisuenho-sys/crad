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
| 3. Módulo 2, Coleta e lotes de sementes | **pronta** |
| 4. Módulo 3, Viveiro | **pronta** |
| 5. Módulo 4, Catálogo público | **pronta** |
| 6. Módulo 5, Doação de mudas (com Plantando Água) | **pronta** |
| 7. Módulo 6, Pós-plantio | **pronta** |
| 8. Módulo 7, Relatórios e transparência | **pronta** |

Mudas que já estavam no viveiro (estoque inicial), em Viveiro → **Registrar
mudas**:

- Três formas, todas sem internet:
  - **uma espécie por vez**: espécie → quantidade → foto das mudas
    (opcional) → canteiro opcional;
  - **várias de uma vez**: lista de espécies com a quantidade ao lado;
  - **planilha** (.xlsx ou .csv), com as colunas Espécie (nome popular ou
    científico), Quantidade, Canteiro e Observação. Há um botão para
    baixar o modelo, e a prévia mostra as linhas com problema antes de gravar.
- Cada espécie vira um lote **LM-AAAA-I-NNN** (I de inicial), com plaqueta e
  QR. O código definitivo vem do servidor na sincronização.
- Entram **prontas para doação** (catálogo, pedidos, reservas e retirada). Como são as mais antigas, saem primeiro nas
  reservas.
- **Toda muda pronta aparece sozinha no catálogo**, de qualquer espécie
  (inclusive as importadas da lista oficial). Não precisa publicar nem
  liberar a espécie.
- **Catálogo vazio explica o porquê** para qualquer pessoa: quantos lotes o
  servidor tem em formação, com as mudas todas reservadas, sem a quantidade
  de mudas (a entrada não chegou ao servidor), esgotados ou de espécie
  apagada (só contagens, sem dados pessoais) e de qual servidor o app leu.
- **Cadastro recusado pelo servidor** não conta no saldo do celular: o lote
  aparece no Viveiro com "recusado pelo servidor: veja Avisos" e o motivo
  fica em Avisos, na barra do alto. No pedido de
  mudas, "De qual viveiro?" sem opções diz que nenhum viveiro tem mudas
  prontas agora.
- **Por que minha muda não aparece?** Quem é da equipe e abre o catálogo vê
  a lista dos lotes deste aparelho que não estão no catálogo, cada um com o
  motivo e o que fazer: em formação (marcar como pronta), todas reservadas,
  ainda não enviado (abrir com internet) ou **servidor
  desatualizado** (rodar a atualização do servidor). Tocar no lote abre a
  ficha dele.
- **Nada é inventado**: o rastreio público diz que a origem das sementes não
  foi registrada. Essas mudas não entram na taxa de germinação, e os
  relatórios mostram o total separado.
- Quem pode, por padrão: gestor e viveirista (linha própria na tabela de
  permissões).

Sementes sem matriz cadastrada:

- **Botão verde "Coleta"** (em Registrar coleta): para colheita sem matriz
  cadastrada e também para **sementes guardadas antes do app**. Pede só a
  espécie e a quantidade; **não pede localização nem matriz**. A data pode
  ser antiga ("Quando foi colhido?") e a observação guarda de onde vieram.
  A coleta vira um lote de sementes sozinha, como as outras, e não conta
  como matriz na diversidade.

Doação: combinar a retirada e baixa no estoque:

- Depois da aprovação, o pedido mostra **Combinar a retirada**:
  - quem entrega as mudas (viveirista ou gestor) toca em **Ver telefone de
    quem pediu** (com internet), liga ou chama no WhatsApp e marca o **dia
    combinado** com uma observação. Cada vez que alguém vê o telefone, isso
    fica registrado na auditoria (LGPD);
  - quem pediu vê o dia combinado, o telefone e o endereço do viveiro
    (cadastre em Viveiros → tocar no viveiro).
- Na retirada, quem entrega toca em **As mudas saíram (dar baixa)**, confere
  as quantidades, colhe a assinatura e toca em **Confirmar: as mudas saíram
  do viveiro**. Cada muda entregue **sai do estoque do lote** (baixa), a
  reserva é consumida e o catálogo é atualizado.
  - Retirada com **0 mudas** não é aceita; nunca sai mais que o aprovado.
  - Item aprovado que ficou **sem reserva no aparelho** não trava: as mudas
    saem dos lotes prontos da espécie (os mais antigos primeiro).
  - A baixa e o "retirado" vêm antes do PDF: se o termo não puder ser gerado
    na hora, a retirada vale e o termo sai depois na ficha do pedido.
  - Pedido que ficou "retirado" sem nenhuma muda baixada mostra **Completar a
    retirada (dar baixa)**; a coluna "Entregues" conta o que de fato saiu do
    estoque.
  - **Lote zerado some do Viveiro e do Inventário**; continua no histórico,
    no rastreio e nos relatórios.

Relatório do plantio (PDF):

- Na ficha do plantio, **Baixar relatório do plantio (PDF)** gera o
  "Relatório simplificado de execução" pedido no termo de compromisso:
  dados do pedido e do plantio (local, coordenadas, área, programa), mudas
  entregues, plantadas e vivas por espécie, sobrevivência, todos os
  acompanhamentos e **as fotos com data e ponto do GPS** (a foto tirada longe
  do local aparece com "Conferir"). No fim, o e-mail para onde enviar,
  tirado do termo aceito. Sem CPF nem telefone.

Termo de compromisso e declaração:

- Pedido registrado (no app ou no balcão): aviso em destaque para **enviar
  o ofício de solicitação de mudas ao Secretário** pelo e-mail
  protocolo@semarh.to.gov.br, com a solicitação em PDF do app em anexo. O
  aviso fica na ficha enquanto o pedido aguarda análise; o gestor autoriza
  ou não pelo app.
- No fim do pedido de mudas, quem pede vê o **Termo de compromisso e
  declaração**: pode tocar em **Ler o termo** ou só marcar **Li e aceito**.
  Sem aceitar, o botão **Enviar pedido** fica desligado (no balcão, a equipe
  lê para a pessoa e marca).
- O texto vem **preenchido com o pedido**: nome, espécies e quantidades,
  coordenadas do plantio (ou "não informadas"), área e data.
- O pedido guarda **a data do aceite e o texto aceito**; ele aparece na ficha
  do pedido e nas páginas finais do PDF da solicitação. O servidor recusa
  pedido feito pelo app sem o termo aceito.
- O **administrador** muda o texto em **Ajustes → Termo de compromisso dos
  pedidos** (com **Voltar ao texto original**). Os marcadores [NOME],
  [ESPÉCIES E QUANTITATIVO], [COORDENADAS UTM/DECIMAIS], [ÁREA TOTAL] e
  [DATA] são preenchidos sozinhos. Vale para os próximos pedidos.

Imprimir (PDF gerado no próprio aparelho):

- **Catálogo com fotos**: no catálogo, **Imprimir o catálogo com fotos**
  gera as fichas das espécies da lista (respeita a busca e o viveiro
  escolhido), duas por folha A4: foto, nomes populares, nome científico,
  família, mudas prontas, como reconhecer, época de flores e frutos, onde
  tem mudas e referência. Só entra o que está cadastrado na espécie.
- **Fichas das espécies do pedido**: no pedido (ex.: 20 espécies),
  **Fichas das espécies com fotos (PDF)**, com as quantidades pedidas,
  aprovadas e entregues de cada uma. Sem internet, sai a ficha guardada; sem
  ficha guardada, saem só os nomes.
- **Etiquetas com QR para as mudas**: na ficha do lote de mudas, **Imprimir
  etiquetas (PDF)**: 24 etiquetas por folha A4 para recortar e fixar nas
  mudas, com nome popular, nome científico, código do lote, viveiro e data
  da semeadura. O QR abre a origem do lote (rastreio público) em qualquer
  celular, e o leitor de QR do app abre a ficha do lote.
- Solicitação de mudas e termo de doação, como antes.

Avisos com som:

- O app toca um som, vibra e mostra um aviso quando chega:
  - para quem aprova: **pedido de mudas novo**;
  - para quem pediu: **pedido aprovado**, recusado ou **retirada combinada**;
  - para quem entrega: **pedido aprovado** (combinar a retirada);
  - para quem cuida da equipe: **pedido de acesso**.
- Aparece **um aviso por vez** (o mais novo), para não cobrir a tela; os
  outros ficam em **Ver mais avisos**, e **Fechar todos** limpa a lista.
- Tocar no aviso abre a tela certa. Em Ajustes → Avisos com som: ligar ou
  desligar o som e **permitir notificações no aparelho**.
- **Com o app fechado** o aviso também chega (Web Push), com o som de
  notificação do próprio celular. Basta tocar em "Permitir notificações no
  aparelho" (Ajustes → Avisos com som). No iPhone, só com o app instalado na
  tela inicial (iOS 16.4 ou mais novo).
  - No servidor, o "carteiro" (`servidor/push/push.mjs`, serviço
    `crads-push`) entrega os avisos; o PocketBase decide quem recebe o quê,
    com a mesma regra dos avisos com o app aberto. O instalador configura
    tudo (Node.js, chaves e serviço).

Excluir o que foi preenchido errado:

- Nas fichas de matriz, lote de sementes e lote de mudas: **Excluir
  (preenchido errado)**, para o administrador e para quem fez o cadastro.
  Vai para a lixeira. Não exclui se houver algo ativo ligado (ex.: lote com
  mudas já entregues numa doação) e diz o motivo.

Identificar com ajuda do Google Lens (com internet):

- Na matriz ainda sem espécie certa, o bloco **Ajuda para identificar**:
  1. **Pesquisar no Google Lens**. No celular, a foto vai pelo "Compartilhar"
     (escolha Google Lens ou Pesquisar com o Google). No computador, a foto é
     baixada e o Lens abre noutra aba.
  2. **Escolher a espécie sugerida**: a pessoa escolhe a espécie na lista do
     app. Ela fica como **provável**, com a marca "com ajuda do Google Lens",
     até o gestor confirmar.
- Em Identificar árvore também dá para tirar uma foto e mandar ao Lens.
- O Lens só sugere: nada é gravado sem a pessoa escolher, e só espécies que
  já existem no cadastro podem ser escolhidas.

Relatório de serviço do coletor (Coleta e sementes → Relatório de serviço):

- Comprova o trabalho de campo num período (este mês, mês passado, este ano
  ou outras datas):
  - dias de campo;
  - matrizes cadastradas com fotos, espécie, data, certeza e local;
  - coletas (data, matriz, espécie, quantidade);
  - registros de flor e fruto.
- Gera um PDF com espaço para a assinatura do coletor e do gestor.
- Funciona sem internet com o que está no aparelho. Com internet, as fotos
  tiradas em outro aparelho são baixadas do servidor.
- O gestor escolhe de qual coletor quer o relatório.

Corrigir cadastros e lixeira (administrador, bloco **Lixeira** na tela inicial):
- **Apagar de vez** leva junto os detalhes: o pedido leva os itens, as
  reservas, as baixas e as **retiradas**; o lote leva as movimentações, os
  eventos, as linhas de **inventário** e as reservas já usadas. Só uma
  **reserva ativa** (pedido aprovado ainda não retirado) segura o lote.
- Marcando vários, o app apaga na ordem certa: pedidos e plantios primeiro,
  depois lotes, coletas e matrizes, e por fim espécies e pessoas.
- Quando algo ainda segura o cadastro, a mensagem diz **qual** é (ex.: "1 em
  lote de mudas: LM-2026-I-007").

- **Excluir cadastros** preenchidos errado (matriz, coleta, lote, doação,
  plantio, espécie, pessoa, viveiro), **um por um ou vários de uma vez**
  (marque as caixas ou "Selecionar todos"). Funciona sem internet. O cadastro
  vai para a **lixeira** e some de todos os aparelhos. O que tem algo ativo
  ligado fica, e o app diz o motivo.
- Na lixeira (com internet), o administrador pode, também em vários de uma
  vez:
  - **restaurar**;
  - **apagar de vez**. Leva junto os detalhes (fotos, flor e fruto, itens,
    movimentos). Não apaga se ainda houver algo ativo ligado, como uma coleta
    de uma matriz; o app diz o que é. Fica só a anotação de quem apagou e
    quando. Para pessoas, os dados pessoais saem também do histórico (LGPD).
    Os aparelhos também tiram o que foi apagado de vez, mesmo os que estavam
    sem internet.
- Em Equipe, o administrador pode **apagar a conta** de alguém. O que a
  pessoa já registrou continua. O nome e o e-mail do pedido de acesso dela
  são apagados, inclusive do histórico.

Contas, equipe e permissões:

- **Criar conta pelo celular** (botão "Criar conta" na entrada):
  - quem vai **pedir mudas** entra na hora;
  - quem vai **coletar sementes** ou **trabalhar no viveiro** escolhe o
    viveiro e fica aguardando o gestor. Enquanto isso, a tela inicial mostra
    o pedido em análise. Até ser aprovada, a conta não vê dados de ninguém.
  - Freio contra robôs: no máximo 10 contas por hora por endereço de
    internet.
- **Telas protegidas**: quem digita o endereço de uma tela que não é do seu
  perfil vê "Sem acesso", e os botões das tarefas sem permissão não aparecem.
  O servidor também recusa a gravação.
- **Equipe** (gestor, precisa de internet):
  - aprovar ou recusar pedidos de acesso, com motivo;
  - cadastrar uma pessoa com senha inicial, viveiro e perfil;
  - tirar o acesso de alguém.

  Só um gestor dá o perfil de gestor, e ninguém tira o próprio acesso.
- **Permissões** (Equipe → O que cada perfil pode fazer): uma tabela com o que cada perfil
  pode fazer (administrador, grupo gestor, viveirista, coletor, solicitante).
  - Só o administrador (gestor geral) muda a tabela.
  - Algumas caixas são fixas: CPF e telefone (LGPD) continuam só com o
    gestor, e o solicitante não recebe funções internas do viveiro.
  - A tabela vale também no servidor, não só nos botões do app.
  - No celular, escolhe-se um perfil por vez; no computador aparece a tabela
    inteira.
  - Sem mudanças na tabela, valem as regras originais. Um teste garante isso.

O que o Módulo 7 entrega:

- **Painel do gestor** (menu Relatórios), calculado no aparelho com os dados
  já sincronizados, funciona sem internet:
  - filtros: período (este ano, ano passado, tudo), viveiro (todos somados ou
    um por um) e o recorte **Só Plantando Água**;
  - números: matrizes (ativas, espécies), coletas (kg), sementes em
    estoque, mudas prontas e germinação, mudas doadas e pedidos em análise,
    doações do Plantando Água, mudas plantadas e sobrevivência;
  - barras de mudas por fase e tabela por viveiro.
- **Baixar arquivos**, feitos no próprio aparelho e sem CPF nem telefone:
  - PDF de prestação de contas com a logo;
  - planilha Excel com as abas Indicadores, Matrizes, Coletas, Lotes de mudas
    e Doações;
  - CSV (indicadores e doações, com `;`, abre no Excel em português);
  - mapa KML com matrizes, coletas e plantios, em cores separadas. Abre no
    Google Earth e no QGIS.
- **Rastrear um código** (uso interno): de qualquer código (MT, LS, LM ou
  DO), mostra a cadeia inteira. Para trás vai até as matrizes; para frente,
  até as doações e os plantios. A doação só traz os lotes de onde saíram as
  suas mudas.
- **Transparência** (`/transparencia`, **só para quem entrou no app**; sem
  login não há link e o servidor não entrega os dados). Mostra:
  - mudas doadas e plantadas, sobrevivência e Plantando Água;
  - doações por ano e espécies mais doadas;
  - mapa dos plantios com o ponto arredondado (cerca de 1 km), sem nomes nem
    documentos.

  Uma cópia fica guardada para abrir sem internet.

O que o Módulo 6 entrega (tudo funciona sem internet):

- **Registro do plantio** de cada doação retirada, feito pelo solicitante ou
  pela equipe:
  - mudas plantadas por espécie; **plantar mais do que recebeu é bloqueado**;
  - ponto do GPS no local, município, data e pelo menos uma foto;
  - **cada foto guarda o GPS do momento**.
- **Acompanhamentos:** o solicitante informa quantas mudas estão vivas, com
  fotos. **Vivas não podem passar das plantadas.**
- **Vistoria (opcional)** da equipe, no mesmo formato. No mesmo dia, a
  vistoria vale mais que o relato.
- **Taxa de sobrevivência** (vivas ÷ plantadas), no total e por espécie, pelo
  acompanhamento mais recente.
- **Conferência das fotos:** foto sem GPS, ou tirada mais longe do local que
  o parâmetro `distancia_max_foto_plantio_m` (padrão: 500 m), fica marcada
  "conferir".
- **Lista do pós-plantio:** doações retiradas, com quem ainda não registrou o
  plantio e a sobrevivência de cada plantio.

O que o Módulo 5 entrega:

- **Pedido de mudas**, uma coisa por tela, inclusive sem internet:
  - **todos os campos são obrigatórios**: finalidade, município, endereço,
    área (hectares), nome completo, instituição (ou “particular”), CPF ou
    CNPJ (conferido pelos dígitos) e telefone com DDD. Falta algo, a tela
    diz o quê, sem perder o que já foi escrito. O ponto do GPS segue
    opcional, porque muita gente pede de casa;
  - o solicitante pede pelo app, a partir do catálogo; a equipe registra o
    pedido do balcão;
  - o pedido traz espécies e quantidades, finalidade, município, local (com
    ponto do GPS), área e dados do solicitante. **Não precisa de ofício**;
  - **até 30 mudas de cada espécie por pedido** (parâmetro
    `limite_mudas_por_especie`); o total do pedido não tem limite. O que
    passa do disponível também é bloqueado;
  - CPF, CNPJ e telefone ficam na tabela que só o gestor lê. A exceção é o
    telefone, que quem entrega as mudas vê depois da aprovação para combinar a
    retirada (fica registrado na auditoria).
- **Solicitação de mudas em PDF**, gerada no aparelho (também sem internet):
  é o documento do pedido, com dados, mudas, texto de compromisso e linha
  para assinatura. O botão **Baixar a solicitação em PDF** aparece logo
  depois de enviar e fica na ficha do pedido.
- **Análise** (aprovar tudo, em parte ou recusar com motivo):
  - **precisa de internet**: o servidor reserva as mudas dos **lotes prontos
    mais antigos primeiro**, numa transação, e duas pessoas nunca reservam a
    mesma muda;
  - **quem aprova é configurável** pelo parâmetro `perfis_aprovadores` (padrão: gestor);
  - o prazo de retirada vem do parâmetro `prazo_retirada_dias` (padrão: 30).
- **Retirada no viveiro**, que funciona sem internet:
  - confere as quantidades (pode levar menos que o aprovado, nunca mais) e
    registra quem recebeu (documento só para o gestor);
  - **assinatura com o dedo na tela** e **termo de doação em PDF** com a assinatura;
  - baixa o estoque pelos lotes reservados (rastreio até a matriz), e a sobra
    da reserva volta ao catálogo;
  - **retirada depois do prazo é bloqueada.**
- **Prazo vencido:** todo dia o servidor expira as reservas e os pedidos não
  retirados, e as mudas voltam ao catálogo.
- **Plantando Água:**
  - um botão na doação, no registro e na análise, que marca e desmarca
    deixando **histórico de quem e quando**;
  - depois da retirada, desmarcar pede motivo;
  - a doação segue o fluxo normal e conta **uma vez só** nos totais gerais,
    porque o programa é um recorte;
  - há filtro "Plantando Água" na lista de pedidos, e o programa já vem cadastrado.
- **Proteções no servidor:**
  - nenhum aparelho aprova pedido, cria reserva ou muda quantidade aprovada
    pela sincronização;
  - o solicitante só envia ou cancela o próprio pedido.

O que o Módulo 4 entrega:

- **Catálogo público, sem login** (`/catalogo`, com link na tela de entrada):
  - espécies com **mudas prontas** e a quantidade **já sem as reservas** de pedidos aprovados;
  - total e quantidade por viveiro, foto, busca por nome e filtro por viveiro.
- **Ficha pública da espécie:**
  - fotos por parte da planta, nomes populares e como reconhecer;
  - meses de flor e fruto e referência do Lorenzi;
  - onde tem mudas.
- **Rastreio do lote**, na ficha ou pelo código `LM-…`:
  - de quantas matrizes vieram as sementes e em quais municípios;
  - lote de sementes e datas;
  - **nunca** a coordenada da árvore, o proprietário, o coletor ou o código da matriz.
- **Regras de publicação:** toda espécie com muda pronta e disponível
  aparece; não precisa marcar nada.
- **Botão Voltar** no catálogo de quem não fez login (aberto direto pelo
  endereço, volta para a tela de entrada).
- **Sem internet:** o catálogo, as fichas já vistas e as fotos ficam guardados
  no aparelho e abrem com o aviso "mostrando o catálogo de [data]".
- **Fotos da espécie:** o gestor envia na ficha, comprimidas no aparelho, por
  parte (muda, árvore, folha, casca, flor, fruto, semente).

O que o Módulo 3 entrega (tudo funciona sem internet):

- **Semeadura** a partir de um lote de sementes com saldo:
  - número de sementes e/ou peso; sem contagem, o app estima pelo peso;
  - recipiente (tubete, saquinho, sementeira ou outros) e canteiro;
  - cria o lote de mudas `LM-AAAA-NNN-A` e baixa as sementes do lote de origem.
- **Contagem de germinação** acumulada:
  - a **taxa real** é plântulas ÷ sementes semeadas;
  - só a diferença para a contagem anterior entra no estoque;
  - contagem menor que a anterior é recusada (para mudas mortas, use "Perda").
- **Perdas**, com causa. **Perda maior que o saldo é bloqueada.**
- **Sem fases intermediárias**: o lote está **em formação** ou **pronto para
  doação**. O botão "Marcar como pronta" libera as mudas para doação.
- **Fotos das mudas** em cada lote. A mais recente aparece no catálogo
  (quando a espécie não tem foto própria, e sempre na ficha).
- **Medição** (altura média), no histórico do lote.
- **Inventário:** contagem por lote; as diferenças viram ajustes no estoque.
- **Lista do viveiro**: prontas para doação ou em formação, com saldo e mudas prontas por espécie.
- **Rastreio:** o lote de mudas leva ao lote de sementes, que leva às matrizes.

O que o Módulo 2 entrega (tudo funciona sem internet):

- **Registrar coleta**, uma coisa por tela:
  - a matriz vem pela plaqueta (QR), pela busca ou pela lista ordenada por distância do GPS;
  - quantidade em kg, g, litros ou frutos (aceita vírgula: "2,5");
  - frutos ou sementes, foto opcional e GPS da coleta.
  - **a matriz recebe coleta assim que é cadastrada** (não precisa de
    aprovação); só não recebe se estiver morta, inativa ou excluída.
- **Rota de coleta:** mapa **híbrido** (imagem de satélite com nomes de
  cidades e estradas), com as matrizes cadastradas, quem teve **fruto
  maduro** nos últimos 45 dias, a posição do coletor e a distância até cada
  matriz.
  - o botão **Satélite** liga e desliga o fundo;
  - **toque numa matriz** (na lista ou no mapa): o mapa mostra só ela e você,
    com a **linha do ponto onde você está até a árvore**, a distância em
    linha reta e a direção (ex.: "78 m em linha reta, para o nordeste").
    Funciona sem internet. O botão **Caminho pelas estradas (Google Maps)**
    abre o trajeto no Google Maps do celular (precisa de internet). O voltar
    do celular ou "Ver todas as matrizes" volta para a lista;
  - as imagens vêm do serviço gratuito da Esri (World Imagery). O híbrido do
    próprio Google não é usado: exige chave paga da Google Maps Platform
    (com cartão de crédito), e baixar as imagens do Google direto viola os
    termos de uso;
  - as imagens já vistas ficam guardadas no aparelho (até 3000 imagens, por
    180 dias) e aparecem no campo sem internet. Sem sinal e sem imagem
    guardada, o mapa mostra só os pontos e as distâncias.
- **Lote de sementes automático** (sem formar, sem aprovação):
  - cada coleta vira um lote sozinha quando chega ao servidor, com código
    `LS-AAAA-NNN` e **etiqueta com QR**. A ligação coleta → lote → matriz
    mantém a **rastreabilidade** até a árvore;
  - coleta de **sementes** pesadas (g ou kg): o peso já entra no saldo;
  - coleta de **frutos**: a ficha do lote mostra "Pesar as sementes limpas"
    (peso e, se quiser, número de sementes); o lote já pode ser semeado antes;
  - coleta de matriz ainda sem espécie: o lote nasce quando a matriz for
    identificada; coletas antigas sem lote ganham o lote quando o servidor liga.
- **Ficha do lote** (abre tocando na coleta em "Últimas coletas", pela
  leitura do QR da etiqueta ou pelo rastreio; não há mais lista de lotes
  nem tela de armazenamento):
  - saldo, que é sempre a soma das movimentações;
  - teste de germinação (%), descarte e ajuste;
  - **saída maior que o saldo é bloqueada**;
  - aviso de validade;
  - **matrizes de origem**, o rastreio do lote até as árvores.

O que o Módulo 1 entrega (tudo funciona sem internet):

- **Espécies:**
  - lista com busca tolerante (sem acento, variação regional, erro de digitação);
  - ficha editável pelo gestor;
  - **vários nomes populares para o mesmo nome científico**, já na
    **Nova espécie** (um de cada vez ou separados por vírgula; nomes
    repetidos não entram de novo);
  - marcação **"revisar"** com o motivo.
- **Importação de espécies** pela tela do gestor, sempre com prévia antes de gravar:
  - **Baixar a lista oficial pelo servidor**: o servidor baixa a lista da
    Flora e Funga do Brasil (JBRJ) só com as espécies do Tocantins (nome
    científico, família e nomes populares) ao ser instalado ou atualizado e
    uma vez por mês (`servidor/deploy/flora.py`). Nada é digitado à mão;
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
- **Número vermelho de pendências** no canto do botão de cada módulo, na
  tela inicial (funciona sem internet). Conta só o que a pessoa pode
  resolver com as permissões que tem:
  - **Doação de mudas**: pedido para analisar; aprovado aguardando a retirada
    (para quem entrega e para quem vai buscar); retirado sem as mudas terem
    saído do estoque.
  - **Pós-plantio**: mudas retiradas sem o plantio registrado (quem pediu);
    plantio sem vistoria técnica (equipe).
  - **Matrizes**: sem espécie ou com a espécie ainda não confirmada.
  - **Coleta e sementes**: lote sem o peso das sementes limpas; lote vencido
    ainda com sementes (testar ou descartar).
  - **Viveiro**: lote com mudas atrasado (passou da data prevista sem ficar
    pronto); inventário aberto.
  - **Espécies**: marcadas para revisar (ex.: nome vindo da Wikipédia).
  - **Equipe**: pedidos de acesso esperando aprovação.
  - **Ajustes**: avisos da sincronização (algo que o servidor recusou).
  Para quem cuida de mais de um viveiro, conta só o viveiro escolhido, como
  as listas. Na lista de pedidos, cada pedido que espera a pessoa vem
  marcado com **Precisa de você**. Zerou, o número some.
  **Depois de vista, a pendência sai do número**: ao abrir o item (o pedido,
  a matriz, o lote, a espécie, a vistoria, a lista de pedidos de acesso, os
  avisos), ele deixa de contar. Se o motivo mudar (ex.: o pedido aprovado
  agora espera a retirada), volta a contar como novo. O "visto" fica
  guardado no aparelho, para cada pessoa. A marca "Precisa de você" na
  lista continua até a ação ser feita.
  Segue o padrão dos "badges" (Material Design): até "99+", vermelho de erro
  com borda branca, aparece com uma animação curta (sem animação para quem
  pediu menos movimento no celular). O leitor de tela ouve o número no nome
  do botão ("Doação de mudas, 3 pendências"). O total vai também para o
  título da aba, "(3) CRAD", e para o ícone do app instalado (Badging API:
  iPhone/iPad com notificações permitidas, Windows e macOS; no Android o
  sistema mostra a bolinha quando chega notificação).
  O vermelho é exceção às cores da logo, pedida para chamar atenção.
- **Manual de utilização** em `docs/tutorial`: série de 12 vídeos curtos
  (criar conta, tela inicial, matriz, coleta, lote de sementes, cadastro de
  mudas, cuidar das mudas, pedir, aprovar, entregar, pós-plantio, gestão) e o
  manual em PDF (`manual-crad.pdf`), gerados das telas reais do app, com
  roteiros e scripts para refazer quando o app mudar.
- **Vários celulares e computadores ao mesmo tempo**: cada aparelho tem a
  sua fila e a sua faixa de códigos. O servidor grava cada envio numa
  transação, e a aprovação de pedidos é feita uma de cada vez, então nunca
  reserva mais mudas do que existem. Edições de campos diferentes do mesmo
  cadastro, feitas em aparelhos diferentes, se juntam. Se duas pessoas
  mudam o mesmo campo, vale o servidor e o conflito fica registrado. O teste
  `servidor/test/concorrencia.test.ts` simula 10 aparelhos enviando juntos,
  dois gestores aprovando ao mesmo tempo pedidos que disputam as mesmas
  mudas, e duas pessoas editando a mesma matriz.
- **Toda foto tem data**: a data em que foi tirada aparece por cima de cada
  foto (matrizes, coleta, lotes, espécies, plantio e catálogo) e no PDF das
  fichas. Nas fotos antigas, sem essa data, vale a data do cadastro.
- **Nova espécie**: só o nome popular é obrigatório. Sem nome científico ou
  família, o app procura na Wikipédia em português (com os dados do
  Wikidata ligados à página) assim que tiver internet, preenche só o que
  estiver vazio e marca a espécie “para revisar”. Se não achar, deixa um
  aviso e tenta de novo no dia seguinte. O grupo “Referência” não aparece
  no cadastro de espécie nova.
- **Botão Editar** em toda matriz, coleta, lote de sementes e lote de mudas (espécie, data da semeadura, sementes semeadas, recipiente, canteiro, observação e fotos das mudas: inserir e apagar, a apagada vai para a lixeira; quantidade e fase seguem pelos registros, para ficar no histórico). A coleta tem
  ficha própria. Só os campos alterados são enviados e tudo fica na
  auditoria.
- **Catálogo**: quando um lote pronto não aparece, o diagnóstico mostra o
  motivo (inclusive “o servidor não tem este lote” ou “no servidor está em
  outra espécie”) e oferece **Reenviar ao servidor**.
- **Perfis por viveiro** (coletor, viveirista, gestor, solicitante). Cada
  pessoa só recebe os dados do seu viveiro.
- **LGPD**: CPF, documento e telefone ficam numa tabela que só o gestor lê.
  Se outra pessoa cadastrou o dado, ele é apagado do aparelho dela depois de
  enviado.
- **Auditoria**: toda criação e alteração fica registrada com usuário,
  aparelho, data no aparelho e data no servidor. Isso vale também para o
  que for feito pelo painel do PocketBase, que não deixa apagar de verdade.
- **App instalável (PWA)** com:
  - tela inicial com a **logomarca do CRAD** no alto (símbolo em alta resolução e o nome em texto, nítido em qualquer tela) e ícones grandes;
  - login que continua valendo sem internet por 30 dias;
  - **sem campo de endereço do servidor**: o app acha o servidor sozinho
    (o que já funcionou no aparelho, o da publicação e o do piloto, nessa
    ordem) e guarda o que respondeu;
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

## Instalar o servidor com um comando

Em qualquer máquina Ubuntu com as portas 80 e 443 abertas (Azure, Oracle ou
servidor do Estado), troque o endereço e rode:

```bash
curl -fsSL https://raw.githubusercontent.com/eduardorisuenho-sys/crad/HEAD/servidor/deploy/instalar.sh | sudo bash -s -- crads-to.brazilsouth.cloudapp.azure.com
```

No **Azure**, há um atalho que também cria a máquina. Abra o Cloud Shell
(ícone `>_` no alto do portal, modo Bash) e rode:

```bash
curl -fsSL https://raw.githubusercontent.com/eduardorisuenho-sys/crad/HEAD/servidor/deploy/azure-criar.sh | bash -s -- seu@email.com
```

Ele testa as regiões e os tamanhos pequenos liberados para a assinatura, cria
a máquina com endereço fixo, instala o CRADS e mostra a senha do administrador.

O script de instalação baixa o CRADS e o PocketBase e deixa o serviço ligando sozinho, com
HTTPS. No fim, mostra como criar o administrador. Para atualizar, rode o mesmo
comando de novo.

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
   sudo git clone <este repositório> /opt/crads && cd /opt/crads/servidor
   sudo npm run baixar-pocketbase
   ```
5. Para o servidor ligar sozinho, use o serviço pronto em
   `servidor/deploy/crads.service`. As instruções estão no começo do arquivo.
   Troque `crads.seudominio.gov.br` pelo seu domínio. O PocketBase pega o
   certificado HTTPS sozinho (Let's Encrypt).
6. Abra `https://seu-dominio/_/` e crie o superusuário. Depois crie o
   primeiro gestor em *users* (marque `gestor_geral`).
7. **Backup:** no painel (`/_/`), vá em *Settings → Backups*, ative o backup
   automático diário e envie para um armazenamento S3 gratuito (Cloudflare R2
   ou Backblaze B2, 10 GB grátis). A Oracle pode recuperar VMs gratuitas
   paradas, então o backup é obrigatório.

### App: Cloudflare (plano gratuito)

Na Cloudflare: **Workers e Pages → Criar → Importar repositório → crad**.

- Comando de build: `npm install && npm run build -w app`
- Comando de deploy: `npx wrangler deploy` (usa o `wrangler.jsonc` da raiz)
- Variáveis de build: `NODE_VERSION=22` e
  `VITE_SERVIDOR_URL=https://crads.seudominio.gov.br`
- O `app/public/_headers` faz o celular conferir sempre se há versão nova.
  As telas como `/catalogo` abrem direto pelo endereço.

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

## Importar os municípios (IBGE)

O gestor faz isso uma vez, em **Ajustes → Municípios (IBGE)**:

1. Confira a UF (TO) e toque em **Baixar do IBGE**. O app busca no IBGE os
   contornos e os nomes dos municípios.
2. Se o IBGE não responder, abra os dois links da tela, salve os arquivos e
   use **Escolher arquivos**, escolhendo os dois de uma vez. Também serve um
   GeoJSON do IBGE com as colunas `CD_MUN`, `NM_MUN` e `SIGLA_UF`.
3. Confira a prévia (novos, atualizados, sem mudança) e toque em **Gravar**.

Depois disso, sem internet:

- a matriz recebe o município pelo GPS e o assistente dá preferência às
  espécies já registradas ali;
- o plantio e o pedido de doação sugerem o município pelo ponto marcado e
  completam o nome enquanto se digita;
- o rastreio público do lote mostra os municípios das matrizes.

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
  - na ficha de cada espécie, o gestor marca as respostas que valem para ela.

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
- O mapa da rota de coleta só funciona sem internet nas áreas já abertas com
  sinal. Ainda não há como baixar antes a região inteira (pacote de campo).
- Se o lote de sementes ainda tem código provisório (criado sem internet e
  sem faixa reservada), o lote de mudas também nasce provisório. Ao
  sincronizar, o servidor gera os dois definitivos (`LS-2026-012` →
  `LM-2026-012-A`).
- Só as fotos das espécies são públicas (para o catálogo). Fotos de
  matrizes, coletas e pessoas continuam protegidas.
- O termo de doação usa um texto padrão (em `app/src/modulos/doacao/pdf.ts`)
  até chegar o modelo da secretaria. O texto pode ser trocado pelo campo
  `texto_termo_doacao` da instalação, sem mexer no código.
- Avisos por WhatsApp ou SMS não foram feitos: custam dinheiro e não estão no
  pedido inicial.
- Campos decimais aceitam vírgula ou ponto ("2,5" ou "2.5").
- Gravação de trilha GPS não existe. Só o ponto da matriz, da coleta e da foto.
- Fotos: lado maior de 1280 px (JPEG) e miniatura de 320 px. A miniatura fica
  no aparelho para ver as fotos sem internet.
- As fotos obrigatórias da matriz (árvore inteira e folhas) e a precisão
  mínima do GPS (30 m) são parâmetros do gestor.
- O QR da plaqueta guarda só o código (ex.: `MT-0123`): qualquer leitor
  mostra o código, e o CRADS abre a ficha.
- **Matriz e sementes não precisam de aprovação**: a matriz cadastrada já
  pode receber coleta e formar lotes. O gestor pode confirmar ou corrigir a
  espécie na ficha, e o que foi cadastrado errado é excluído (lixeira).
- Municípios: os contornos do IBGE são simplificados (cerca de 50 m) para
  ficarem leves no celular. A espécie "registrada no município" vem das
  matrizes já identificadas com certeza ali. Não é usada nenhuma lista
  inventada.
- Visual:
  - O app usa só as cores da logo do CRAD: verde `#48672f`, azul `#259ad4`,
    azul-escuro `#33618d`, branco e tons claros dessas cores. A única exceção
    são as figuras de cor de flor do assistente, porque ali a cor é a resposta.
  - Do sistema SIACOB vêm só a tipografia, os tipos de botão e os grafismos
    (círculos azuis, ondas). A estrutura das telas é a do próprio CRAD.
  - A fonte (Inter, licença SIL OFL) fica dentro do app e funciona sem internet.
  - As cores ficam em `app/src/estilo.css`, nas variáveis do topo.
- Dependências: `npm audit` sem alertas (React Router 7, Vite 6.4, Vitest 5,
  Playwright 1.64).
- Licença: **AGPL-3.0** (arquivo `LICENSE`). Quem adaptar e hospedar o app
  (outros municípios, consórcios) precisa manter o código aberto.

## Pendências

- `especificacao.md`: o projeto segue o prompt inicial. As regras marcadas
  como **[hipótese]** no modelo de dados continuam valendo até haver uma
  especificação.
- Importar os municípios do Tocantins no servidor de produção (Ajustes →
  Municípios). Este ambiente de desenvolvimento não acessa o IBGE.
- Pacote de campo com mapa de fundo sem internet (PMTiles).
- Modelo do termo de doação de mudas: a estrutura está pronta (texto configurável).
- Modelo da ficha de solicitação de mudas.
