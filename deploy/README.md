# Put Veyra Dine In online (VPS)

1. Ubuntu 24.04 VPS, point your domain's A record to its IP.
2. `sudo apt install -y nodejs npm caddy git`
3. `sudo useradd -r veyra && sudo git clone https://github.com/veyracreatives/veyra-dine /opt/veyra-dine && cd /opt/veyra-dine && sudo npm ci --omit=dev && sudo chown -R veyra /opt/veyra-dine`
4. Copy `veyra-dine.service` to `/etc/systemd/system/`, set PUBLIC_URL, then `sudo systemctl enable --now veyra-dine`
5. Copy `Caddyfile` to `/etc/caddy/Caddyfile`, set the domain, `sudo systemctl reload caddy`
6. Platform password is printed once in `journalctl -u veyra-dine`.
Back up `/opt/veyra-dine/data/` every day.
