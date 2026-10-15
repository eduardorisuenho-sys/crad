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
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git unzip curl ca-certificates python3 xz-utils >/dev/null

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

echo "==> Carteiro de avisos no celular (Node.js + Web Push)"
NODE_VERSAO=22.12.0
case "$(uname -m)" in x86_64) NODE_ARQ=x64 ;; aarch64|arm64) NODE_ARQ=arm64 ;; esac
if [ "$("$PASTA/node/bin/node" --version 2>/dev/null)" != "v$NODE_VERSAO" ]; then
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/node.tar.xz" "https://nodejs.org/dist/v${NODE_VERSAO}/node-v${NODE_VERSAO}-linux-${NODE_ARQ}.tar.xz"
  rm -rf "$PASTA/node" && mkdir -p "$PASTA/node"
  tar -xJf "$TMP/node.tar.xz" -C "$PASTA/node" --strip-components=1
  rm -rf "$TMP"
fi
(cd "$PASTA/servidor/push" && PATH="$PASTA/node/bin:$PATH" npm ci --omit=dev --no-audit --no-fund --loglevel=error)

echo "==> Lista oficial de espécies (Flora e Funga do Brasil, só o Tocantins)"
# Fica em pb_public/flora/flora-TO.zip; o app baixa daqui em Espécies → Importar.
# Atualiza se não existir ou tiver mais de 30 dias; se o site do JBRJ falhar, segue sem ela.
FLORA="$PASTA/servidor/pb_public/flora/flora-TO.zip"
mkdir -p "$(dirname "$FLORA")"
if [ ! -s "$FLORA" ] || [ -n "$(find "$FLORA" -mtime +30 2>/dev/null)" ]; then
  python3 "$PASTA/servidor/deploy/flora.py" "$FLORA.novo" TO && mv "$FLORA.novo" "$FLORA" || echo "   (não deu para baixar a lista agora; rode a atualização de novo mais tarde)"
fi
# Uma vez por mês, sozinho.
cat > /etc/cron.monthly/crads-flora <<CRON
#!/bin/sh
python3 $PASTA/servidor/deploy/flora.py $FLORA.novo TO && mv $FLORA.novo $FLORA && chown crads:crads $FLORA
CRON
chmod 755 /etc/cron.monthly/crads-flora
chown -R crads:crads "$PASTA/servidor/pb_public"

chown -R crads:crads "$PASTA"

echo "==> Serviço (liga sozinho com a máquina)"
sed "s#crads.seudominio.gov.br#${DOMINIO}#" "$PASTA/servidor/deploy/crads.service" > /etc/systemd/system/crads.service
systemctl daemon-reload
systemctl enable crads >/dev/null
systemctl restart crads
cp "$PASTA/servidor/deploy/crads-push.service" /etc/systemd/system/crads-push.service
systemctl daemon-reload
systemctl enable crads-push >/dev/null
systemctl restart crads-push

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
