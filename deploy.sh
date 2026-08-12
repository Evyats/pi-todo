#!/usr/bin/env bash
set -euo pipefail

readonly app_user="pi-todo"
readonly repository="/opt/pi-todo/app"
readonly backend="${repository}/backend"
readonly venv="/opt/pi-todo/venv"
readonly frontend_upload="/home/evyats/pi-todo-dist"
readonly web_root="/var/www/pi-todo"

if (( EUID != 0 )); then
    echo "Run this script with sudo." >&2
    exit 1
fi

for directory in "$repository" "$backend" "$venv" "$frontend_upload"; do
    if [[ ! -d "$directory" ]]; then
        echo "Required directory not found: $directory" >&2
        exit 1
    fi
done

if [[ ! -f "${frontend_upload}/index.html" ]]; then
    echo "Frontend build not found at ${frontend_upload}/index.html" >&2
    echo "Build it on Windows and upload dist first." >&2
    exit 1
fi

echo "Pulling source code..."
runuser -u "$app_user" -- git -C "$repository" pull --ff-only

echo "Installing backend dependencies..."
runuser -u "$app_user" -- \
    "${venv}/bin/python" -m pip install -r "${backend}/requirements.txt"

echo "Publishing frontend..."
install -d -m 755 -o root -g root "$web_root"
cp -a "${frontend_upload}/." "${web_root}/"
find "$web_root" -type d -exec chmod 755 {} +
find "$web_root" -type f -exec chmod 644 {} +
chown -R root:root "$web_root"

echo "Refreshing service configuration..."
install -m 644 "${repository}/deploy/systemd/pi-todo.service" \
    /etc/systemd/system/pi-todo.service
install -m 644 "${repository}/deploy/systemd/pi-todo-backup.service" \
    /etc/systemd/system/pi-todo-backup.service
install -m 644 "${repository}/deploy/systemd/pi-todo-backup.timer" \
    /etc/systemd/system/pi-todo-backup.timer
install -m 644 "${repository}/deploy/nginx/pi-todo" \
    /etc/nginx/sites-available/pi-todo

systemctl daemon-reload
nginx -t
systemctl restart pi-todo
systemctl restart nginx
systemctl enable --now pi-todo-backup.timer

echo "Waiting for the API..."
for attempt in {1..60}; do
    if curl --fail --silent http://127.0.0.1/api/health >/dev/null; then
        echo "Deployment completed successfully."
        exit 0
    fi
    sleep 1
done

echo "Deployment finished, but the API health check failed." >&2
echo "Inspect it with: sudo journalctl -u pi-todo -n 50 --no-pager" >&2
exit 1
