#!/usr/bin/env bash
# Cria o servidor do CRADS no Azure e instala tudo, sem preencher formulários.
# Rodar no Cloud Shell do portal do Azure (ícone >_ no alto):
#   curl -fsSL https://raw.githubusercontent.com/eduardorisuenho-sys/crad/HEAD/servidor/deploy/azure-criar.sh | bash -s -- seu@email.com
# Tenta as regiões e os tamanhos pequenos liberados para a assinatura até um dar certo.
set -uo pipefail

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then echo "Informe o e-mail do administrador. Ex.: ... | bash -s -- seu@email.com"; exit 1; fi
NOME=crads-servidor
ROTULO="crads-to-$(tr -dc a-z0-9 </dev/urandom | head -c 4)"
REGIOES="brazilsouth eastus2 eastus westus2 centralus southcentralus westus3"
# tamanho:imagem (x64 e Arm). Todos pequenos (1 a 2 vCPU, 1 a 4 GB).
OPCOES="Standard_B1s:x64 Standard_B2ats_v2:x64 Standard_B1ms:x64 Standard_B2s:x64 Standard_B2pts_v2:arm Standard_B2pls_v2:arm"
IMG_X64="Canonical:ubuntu-24_04-lts:server:latest"
IMG_ARM="Canonical:ubuntu-24_04-lts:server-arm64:latest"

echo "==> Procurando uma região e um tamanho liberados para a sua conta (pode levar alguns minutos)…"
CRIADO=""
for R in $REGIOES; do
  for O in $OPCOES; do
    T="${O%%:*}"; A="${O##*:}"
    IMG=$IMG_X64; [ "$A" = arm ] && IMG=$IMG_ARM
    GRUPO="crads-$R"
    echo "   tentando $T em $R…"
    az group create -n "$GRUPO" -l "$R" -o none 2>/dev/null || continue
    if az vm create -g "$GRUPO" -n "$NOME" -l "$R" --image "$IMG" --size "$T" \
        --admin-username crads --generate-ssh-keys \
        --public-ip-sku Standard --public-ip-address-allocation static --public-ip-address-dns-name "$ROTULO" \
        --nsg-rule SSH -o none 2>/tmp/erro-azure.txt; then
      CRIADO="$GRUPO"; break 2
    fi
    echo "     não deu: $(grep -oE '(SkuNotAvailable|NotAvailableForSubscription|RequestDisallowedByPolicy|QuotaExceeded|OperationNotAllowed|InvalidParameter)[^\"]{0,80}' /tmp/erro-azure.txt | head -1)"
    az group delete -n "$GRUPO" --yes --no-wait -o none 2>/dev/null
  done
done
if [ -z "$CRIADO" ]; then
  echo "Nenhuma combinação foi liberada para esta assinatura. Copie as linhas acima e envie para o suporte do projeto."
  exit 1
fi

FQDN=$(az network public-ip list -g "$CRIADO" --query "[0].dnsSettings.fqdn" -o tsv)
echo "==> Máquina criada: $T em $R"
echo "==> Abrindo as portas 80 e 443"
az vm open-port -g "$CRIADO" -n "$NOME" --port 80,443 --priority 900 -o none

echo "==> Instalando o CRADS (uns 2 minutos)…"
SENHA="Crads-$(tr -dc A-Za-z0-9 </dev/urandom | head -c 14)"
az vm run-command invoke -g "$CRIADO" -n "$NOME" --command-id RunShellScript \
  --scripts "curl -fsSL https://raw.githubusercontent.com/eduardorisuenho-sys/crad/HEAD/servidor/deploy/instalar.sh | bash -s -- $FQDN && sudo -u crads /opt/crads/servidor/pocketbase superuser upsert '$EMAIL' '$SENHA' --dir /opt/crads/servidor/pb_data" \
  --query "value[0].message" -o tsv | tail -n 15

cat <<FIM

=====================================================================
 Servidor do CRADS:   https://$FQDN
 Painel:              https://$FQDN/_/
 Administrador:       $EMAIL
 Senha:               $SENHA      (anote e troque depois no painel)
=====================================================================
 Na Cloudflare, coloque a variável de build:
   VITE_SERVIDOR_URL = https://$FQDN
FIM
