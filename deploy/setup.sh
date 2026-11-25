#!/usr/bin/env bash
# Veyra Academy: install or update on the Veyra server (Ubuntu, already running Veyra Dine In with Caddy).
#   curl -fsSL https://raw.githubusercontent.com/veyracreatives/veyra-dine/claude/project-thread-7g2j4d/deploy/setup.sh | sudo bash
# Safe to run again: it updates the code and never touches /opt/veyra-academy/data.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
DOMAIN="${1:-academy.veyracreatives.com}"
REPO=https://github.com/veyracreatives/veyra-dine
BRANCH=claude/project-thread-7g2j4d
DIR=/opt/veyra-academy
echo "==> Setting up Veyra Academy at https://$DOMAIN"

export DEBIAN_FRONTEND=noninteractive
command -v git >/dev/null || { apt-get update -y; apt-get install -y git curl; }
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# code (data folder is kept)
id veyra >/dev/null 2>&1 || useradd -r -m -d /opt/veyra-dine-home veyra
if [ -d $DIR/.git ]; then git -C $DIR fetch --depth 1 origin $BRANCH && git -C $DIR reset --hard FETCH_HEAD
else git clone --depth 1 --branch $BRANCH $REPO $DIR; fi
mkdir -p $DIR/data
(cd $DIR && npm install --omit=dev --no-audit --no-fund nodemailer@6 >/dev/null 2>&1 || true)
chown -R veyra:veyra $DIR

cat > /etc/systemd/system/veyra-academy.service <<UNIT
[Unit]
Description=Veyra Academy server
After=network.target

[Service]
WorkingDirectory=$DIR
ExecStart=/usr/bin/node server.js
Environment=PORT=3100
Environment=HOST=127.0.0.1
Environment=BASE_URL=https://$DOMAIN
Environment=DATA_DIR=$DIR/data
Restart=always
User=veyra

[Install]
WantedBy=multi-user.target
UNIT

# add our site to Caddy without touching the Dine In site
if ! grep -q "^$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null; then
  cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F-%H%M) 2>/dev/null || true
  printf '\n%s {\n  encode gzip\n  reverse_proxy localhost:3100\n}\n' "$DOMAIN" >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile >/dev/null

systemctl daemon-reload
systemctl enable veyra-academy >/dev/null 2>&1
systemctl restart veyra-academy
systemctl reload caddy || systemctl restart caddy
sleep 3
CODE=$(cat $DIR/data/hq-setup-code.txt 2>/dev/null || true)
echo
echo "=============================================================="
echo " Veyra Academy is online:  https://$DOMAIN"
echo " Demo academy:             https://$DOMAIN/demo"
echo " Veyra HQ:                 https://$DOMAIN/hq"
[ -n "$CODE" ] && echo " HQ setup code:            $CODE   (enter it on /hq, then pick your HQ password)"
echo " HTTPS can take 1 minute the first time."
echo "=============================================================="
curl -fsS -o /dev/null -w " Local check: %{http_code}\n" http://127.0.0.1:3100/healthz || echo " Local check failed: journalctl -u veyra-academy -n 30"
