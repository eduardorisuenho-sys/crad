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
| 2. Módulo 1, Matrizes, com o assistente de identificação | próxima |
| 3 a 8. Coleta, Viveiro, Catálogo, Doação (com Plantando Água), Pós-plantio, Relatórios | a fazer |

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

Chega com o Módulo 1, a próxima etapa. Os campos da ficha já estão no esquema
(tabela `especie` e as tabelas ligadas a ela).

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
- Licença ainda não escolhida. Sugestão: GPL-3.0 ou AGPL-3.0, para que as
  melhorias feitas por outros municípios voltem abertas.

## Pendências

- `especificacao.md`: ainda **não foi adicionada** ao repositório. As regras
  marcadas como **[hipótese]** no modelo de dados serão conferidas contra ela.
- Tabela de sementes e mudas (para os campos de espécie, lote e estoque e para
  a importação inicial).
- Modelo do termo de doação de mudas (PDF da retirada, Módulo 5).
- Modelo da ficha de solicitação de mudas.
