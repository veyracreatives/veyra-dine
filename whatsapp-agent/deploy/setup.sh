#!/usr/bin/env bash
# Veyra WhatsApp agent: install or update on the same VPS as Dine In / Academy.
#   curl -fsSL https://raw.githubusercontent.com/veyracreatives/veyra-dine/claude/project-thread-r4isup/whatsapp-agent/deploy/setup.sh | sudo bash -s wa.veyracreatives.com
# Keeps existing Caddy sites; adds one block for this domain. Re-run the same line to update.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
DOMAIN="${1:-wa.veyracreatives.com}"
BRANCH="${BRANCH:-claude/project-thread-r4isup}"
SRC=/opt/veyra-wa-src APP=/opt/veyra-wa ENVF=/etc/veyra-wa.env
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; }
command -v caddy >/dev/null || { echo "Caddy missing: run the Dine In setup first."; exit 1; }
id veyra >/dev/null 2>&1 || useradd -r -m -d /opt/veyra-dine-home veyra
git config --global --add safe.directory "$SRC" || true
if [ -d "$SRC/.git" ]; then git -C "$SRC" fetch --depth 1 origin "$BRANCH" && git -C "$SRC" reset --hard FETCH_HEAD
else git clone --depth 1 --branch "$BRANCH" https://github.com/veyracreatives/veyra-dine "$SRC"; fi
mkdir -p "$APP/data"
find /opt/veyra-wa -mindepth 1 -maxdepth 1 ! -name data ! -name node_modules -exec rm -r -- {} +
cp -r /opt/veyra-wa-src/whatsapp-agent/. /opt/veyra-wa/
cd "$APP" && npm install --omit=dev --no-audit --no-fund
chown -R veyra:veyra "$APP"

if [ ! -f "$ENVF" ]; then
  PW=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)
  VT=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)
  cat > "$ENVF" <<ENV
PORT=3200
PUBLIC_URL=https://$DOMAIN
DATA_DIR=$APP/data
INBOX_PASSWORD=$PW
WA_VERIFY_TOKEN=$VT
SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
NOTIFY_EMAIL=marketing@veyracreatives.com
ENV
  chmod 600 "$ENVF"
fi

cat > /etc/systemd/system/veyra-wa.service <<UNIT
[Unit]
Description=Veyra WhatsApp agent
After=network.target
[Service]
WorkingDirectory=$APP
EnvironmentFile=$ENVF
ExecStart=/usr/bin/node server.js
Restart=always
User=veyra
[Install]
WantedBy=multi-user.target
UNIT

if ! grep -q "^$DOMAIN " /etc/caddy/Caddyfile; then
  printf '\n%s {\n  encode gzip\n  reverse_proxy localhost:3200\n}\n' "$DOMAIN" >> /etc/caddy/Caddyfile
fi
systemctl daemon-reload && systemctl enable --now veyra-wa && systemctl restart veyra-wa
systemctl reload caddy || systemctl restart caddy
sleep 2
echo
echo "==> Veyra WhatsApp agent is running at https://$DOMAIN"
echo "    Inbox password : $(grep ^INBOX_PASSWORD $ENVF | cut -d= -f2)"
echo "    Webhook URL    : https://$DOMAIN/webhook"
echo "    Verify token   : $(grep ^WA_VERIFY_TOKEN $ENVF | cut -d= -f2)"
curl -fsS http://localhost:3200/health && echo
