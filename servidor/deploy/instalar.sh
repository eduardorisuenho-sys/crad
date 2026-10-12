#!/usr/bin/env bash
# Instala (ou atualiza) o servidor CRADS numa máquina Ubuntu.
# Uso:  curl -fsSL https://raw.githubusercontent.com/eduardorisuenho-sys/crad/HEAD/servidor/deploy/instalar.sh | sudo bash -s -- crads-to.brazilsouth.cloudapp.azure.com
set -euo pipefail

DOMINIO="${1:-}"
REPO="${CRADS_REPO:-https://github.com/eduardorisuenho-sys/crad.git}"
PASTA=/opt/crads
if [ -z "$DOMINIO" ]; then echo "Informe o endereço do servidor. Ex.: ... | sudo bash -s -- crads-to.duckdns.org"; exit 1; fi
if [ "$(id -u)" != 0 ]; then echo "Rode com sudo."; exit 1; fi

echo "==> Programas básicos"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git unzip curl ca-certificates >/dev/null

echo "==> Usuário de serviço"
id crads >/dev/null 2>&1 || useradd --system --home "$PASTA" --shell /usr/sbin/nologin crads

echo "==> Código do CRADS"
if [ -d "$PASTA/.git" ]; then
  # A pasta é do usuário crads; o git (rodando como root) precisa desta liberação.
  git -c safe.directory="$PASTA" -C "$PASTA" pull --ff-only
else
  git clone --depth 1 "$REPO" "$PASTA"
fi

echo "==> PocketBase"
VERSAO=$(grep -oP "VERSAO = '\K[0-9.]+" "$PASTA/servidor/scripts/baixar-pocketbase.mjs")
case "$(uname -m)" in x86_64) ARQ=amd64 ;; aarch64|arm64) ARQ=arm64 ;; *) echo "Processador não suportado"; exit 1 ;; esac
ATUAL=$("$PASTA/servidor/pocketbase" --version 2>/dev/null | grep -oP '[0-9]+\.[0-9]+\.[0-9]+' || true)
if [ "$ATUAL" != "$VERSAO" ]; then
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/pb.zip" "https://github.com/pocketbase/pocketbase/releases/download/v${VERSAO}/pocketbase_${VERSAO}_linux_${ARQ}.zip"
  unzip -o -q "$TMP/pb.zip" pocketbase -d "$PASTA/servidor"
  rm -rf "$TMP"
fi
chmod 755 "$PASTA/servidor/pocketbase"
chown -R crads:crads "$PASTA"

echo "==> Serviço (liga sozinho com a máquina)"
sed "s#crads.seudominio.gov.br#${DOMINIO}#" "$PASTA/servidor/deploy/crads.service" > /etc/systemd/system/crads.service
systemctl daemon-reload
systemctl enable crads >/dev/null
systemctl restart crads

# Firewall da própria máquina (se estiver ligado)
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

sleep 3
if systemctl is-active --quiet crads; then
  echo
  echo "Pronto! Servidor no ar: https://${DOMINIO}"
  echo "O certificado HTTPS é pedido no primeiro acesso (pode levar até 1 minuto)."
  echo
  echo "Crie o administrador (troque e-mail e senha):"
  echo "  sudo -u crads $PASTA/servidor/pocketbase superuser upsert seu@email.com SenhaForte123 --dir $PASTA/servidor/pb_data"
  echo
  echo "Para atualizar no futuro, rode o mesmo comando de instalação de novo."
else
  echo "O serviço não subiu. Veja o motivo com:  journalctl -u crads -n 50"
  exit 1
fi
