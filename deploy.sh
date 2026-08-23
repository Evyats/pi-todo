#!/usr/bin/env bash
set -euo pipefail

readonly app_user="pi-todo"
readonly repository="/opt/pi-todo/app"
readonly backend="${repository}/backend"
readonly venv="/opt/pi-todo/venv"
readonly frontend_build="${repository}/frontend/dist"
readonly web_root="/var/www/pi-server/todo"
readonly deployment_marker="/var/lib/pi-todo/last-deployed-sha"
readonly deployment_lock="/run/lock/pi-todo-deploy.lock"

if (( EUID != 0 )); then
    echo "Run this script with sudo." >&2
    exit 1
fi

exec 9>"$deployment_lock"
if ! flock --nonblock 9; then
    echo "Another Pi Todo deployment is already running; skipping." >&2
    exit 0
fi

for directory in "$repository" "$backend" "$venv"; do
    if [[ ! -d "$directory" ]]; then
        echo "Required directory not found: $directory" >&2
        exit 1
    fi
done

current_branch="$(runuser -u "$app_user" -- git -C "$repository" branch --show-current)"
if [[ "$current_branch" != "deploy" ]]; then
    echo "Expected the repository to be on deploy, found: $current_branch" >&2
    exit 1
fi

echo "Pulling ready-to-run deployment..."
runuser -u "$app_user" -- git -C "$repository" pull --ff-only origin deploy

if [[ ! -f "${frontend_build}/index.html" ]]; then
    echo "Built frontend not found at ${frontend_build}/index.html" >&2
    echo "Check the GitHub Actions build for the deploy branch." >&2
    exit 1
fi

echo "Installing backend dependencies..."
runuser -u "$app_user" -- \
    "${venv}/bin/python" -m pip install -r "${backend}/requirements.txt"

echo "Publishing frontend..."
readonly web_parent="$(dirname "$web_root")"
readonly previous_web_root="${web_root}.previous"
staging_web_root="$(mktemp -d "${web_parent}/.todo-staging.XXXXXX")"
cleanup_staging() {
    if [[ -n "${staging_web_root:-}" && "$staging_web_root" == "${web_parent}/.todo-staging."* && -d "$staging_web_root" ]]; then
        rm -rf -- "$staging_web_root"
    fi
}
trap cleanup_staging EXIT
cp -a "${frontend_build}/." "${staging_web_root}/"
find "$staging_web_root" -type d -exec chmod 755 {} +
find "$staging_web_root" -type f -exec chmod 644 {} +
chown -R root:root "$staging_web_root"

if [[ ! -e "$web_root" && -d "$previous_web_root" && ! -L "$previous_web_root" ]]; then
    mv -- "$previous_web_root" "$web_root"
fi
if [[ -e "$previous_web_root" ]]; then
    if [[ -L "$previous_web_root" || "$previous_web_root" != "${web_parent}/todo.previous" ]]; then
        echo "Unexpected previous frontend path: $previous_web_root" >&2
        exit 1
    fi
    rm -rf -- "$previous_web_root"
fi
if [[ -e "$web_root" ]]; then
    mv -- "$web_root" "$previous_web_root"
fi
if ! mv -- "$staging_web_root" "$web_root"; then
    [[ -d "$previous_web_root" && ! -e "$web_root" ]] && mv -- "$previous_web_root" "$web_root"
    exit 1
fi
staging_web_root=""
rm -rf -- "$previous_web_root"

echo "Refreshing service configuration..."
install -m 644 "${repository}/deploy/systemd/pi-todo.service" \
    /etc/systemd/system/pi-todo.service
install -m 644 "${repository}/deploy/systemd/pi-todo-backup.service" \
    /etc/systemd/system/pi-todo-backup.service
install -m 644 "${repository}/deploy/systemd/pi-todo-backup.timer" \
    /etc/systemd/system/pi-todo-backup.timer
install -m 644 "${repository}/deploy/systemd/pi-todo-update.service" \
    /etc/systemd/system/pi-todo-update.service
install -m 644 "${repository}/deploy/systemd/pi-todo-update.timer" \
    /etc/systemd/system/pi-todo-update.timer
systemctl daemon-reload
systemctl restart pi-todo
systemctl enable --now pi-todo-backup.timer
systemctl enable --now pi-todo-update.timer

echo "Waiting for the API..."
for attempt in {1..60}; do
    if curl --fail --silent http://127.0.0.1:8000/todo/api/health >/dev/null; then
        deployed_sha="$(runuser -u "$app_user" -- git -C "$repository" rev-parse HEAD)"
        marker_temp="${deployment_marker}.tmp"
        printf '%s\n' "$deployed_sha" >"$marker_temp"
        chmod 644 "$marker_temp"
        mv -- "$marker_temp" "$deployment_marker"
        echo "Deployment completed successfully."
        exit 0
    fi
    sleep 1
done

echo "Deployment finished, but the API health check failed." >&2
echo "Inspect it with: sudo journalctl -u pi-todo -n 50 --no-pager" >&2
exit 1
