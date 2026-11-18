#!/usr/bin/env bash
# Veyra Dine In: one-command server setup for a fresh Ubuntu 22.04/24.04 VPS.
#   curl -fsSL https://raw.githubusercontent.com/veyracreatives/veyra-dine/main/deploy/setup.sh | sudo bash
#   (optional) add your domain at the end:  ... | sudo bash -s dinein.yourdomain.com
# Without a domain it uses <server-ip>.sslip.io, which still gets free HTTPS.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }

IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="${1:-$(echo "$IP" | tr . -).sslip.io}"
echo "==> Setting up Veyra Dine In at https://$DOMAIN"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https ufw

# Node.js 20
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Caddy (automatic HTTPS)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# App
id veyra >/dev/null 2>&1 || useradd -r -m -d /opt/veyra-dine-home veyra
if [ -d /opt/veyra-dine/.git ]; then git -C /opt/veyra-dine pull --ff-only; else git clone --depth 1 https://github.com/veyracreatives/veyra-dine /opt/veyra-dine; fi
cd /opt/veyra-dine && npm ci --omit=dev --no-audit --no-fund
chown -R veyra:veyra /opt/veyra-dine

cat > /etc/systemd/system/veyra-dine.service <<UNIT
[Unit]
Description=Veyra Dine In server
After=network.target

[Service]
WorkingDirectory=/opt/veyra-dine
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Environment=PUBLIC_URL=https://$DOMAIN
Restart=always
User=veyra

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
  encode gzip
  reverse_proxy localhost:3000
}
CADDY

# daily backup of the data folder, kept 14 days
cat > /etc/cron.daily/veyra-dine-backup <<'BAK'
#!/bin/sh
mkdir -p /var/backups/veyra-dine
tar -czf /var/backups/veyra-dine/data-$(date +%F).tar.gz -C /opt/veyra-dine data 2>/dev/null
find /var/backups/veyra-dine -name 'data-*.tar.gz' -mtime +14 -delete
BAK
chmod +x /etc/cron.daily/veyra-dine-backup

ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null

systemctl daemon-reload
systemctl enable --now veyra-dine
systemctl restart caddy
sleep 4
PW=$(journalctl -u veyra-dine --no-pager | grep -o 'password: [^ ]*' | tail -1 | cut -d' ' -f2 || true)

echo
echo "=============================================================="
echo " Veyra Dine In is online:  https://$DOMAIN"
echo " Restaurant sign-up:       https://$DOMAIN/signup"
echo " Restaurant admin:         https://$DOMAIN/admin"
echo " Veyra platform:           https://$DOMAIN/platform"
[ -n "$PW" ] && echo " Platform password:        $PW   (change it after logging in)"
echo " HTTPS can take 1 minute the first time."
echo "=============================================================="
