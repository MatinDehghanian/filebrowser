#!/usr/bin/env bash
#
# File Browser management script.
#
# Installed to /usr/local/bin/filebrowser by install.sh. Running `filebrowser`
# with no arguments opens an interactive management menu; every menu entry is
# also available as a sub-command (see `filebrowser help`).
#
# File Browser itself runs inside Docker. Everything lives in $FB_APP_DIR
# (default /opt/filebrowser):
#
#   .env                 settings used by this script
#   docker-compose.yml   generated from .env, do not edit by hand
#   data/database        BoltDB database (users, settings, shares)
#   data/config          settings.json used inside the container
#   certs                TLS certificate copied from Let's Encrypt

APP_NAME="filebrowser"
APP_DIR="${FB_APP_DIR:-/opt/filebrowser}"
ENV_FILE="$APP_DIR/.env"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
DB_FILE="$APP_DIR/data/database/filebrowser.db"
CERT_DIR="$APP_DIR/certs"
BIN_PATH="/usr/local/bin/$APP_NAME"
CRON_FILE="/etc/cron.d/$APP_NAME-certbot"
SCRIPT_URL="${FB_SCRIPT_URL:-https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/scripts/filebrowser.sh}"

# The container runs as this UID/GID (see Dockerfile).
CONTAINER_UID=1000
CONTAINER_GID=1000
MIN_PASSWORD_LENGTH=12

# Defaults, overridden by $ENV_FILE once installed.
FB_IMAGE="${FB_IMAGE:-docker.io/themattdev/filebrowser:latest}"
FB_PORT="${FB_PORT:-8080}"
FB_FILES_DIR="${FB_FILES_DIR:-$APP_DIR/files}"
FB_DOMAIN="${FB_DOMAIN:-}"
FB_EMAIL="${FB_EMAIL:-}"
FB_TLS="${FB_TLS:-false}"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

if [ -t 1 ]; then
  C_RED=$'\033[31m' C_GREEN=$'\033[32m' C_YELLOW=$'\033[33m' C_BLUE=$'\033[36m' C_BOLD=$'\033[1m' C_RESET=$'\033[0m'
else
  C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_BOLD="" C_RESET=""
fi

info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok() { printf '%s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
err() { printf '%s✘%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
die() { err "$*"; exit 1; }

# Prompts read from the terminal so they still work when the script itself
# arrives on stdin (curl ... | bash).
has_tty() { [ -r /dev/tty ] && [ -w /dev/tty ] && { : </dev/tty; } 2>/dev/null; }

# ask <var> <question> [default]
ask() {
  local __var="$1" __question="$2" __default="${3:-}" __answer=""
  if has_tty; then
    if [ -n "$__default" ]; then
      printf '%s [%s]: ' "$__question" "$__default" >/dev/tty
    else
      printf '%s: ' "$__question" >/dev/tty
    fi
    IFS= read -r __answer </dev/tty
  fi
  printf -v "$__var" '%s' "${__answer:-$__default}"
}

# confirm <question> [default y|n]
confirm() {
  local answer default="${2:-n}" hint="y/N"
  [ "$default" = "y" ] && hint="Y/n"
  has_tty || { [ "$default" = "y" ]; return; }
  printf '%s [%s]: ' "$1" "$hint" >/dev/tty
  IFS= read -r answer </dev/tty
  answer="${answer:-$default}"
  case "$answer" in [yY] | [yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

random_password() {
  local pw=""
  while [ "${#pw}" -lt 20 ]; do
    pw="$pw$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 20)"
  done
  printf '%s' "${pw:0:20}"
}

# ask_password <var>: empty input generates a random password.
ask_password() {
  local __var="$1" __pw="" __pw2=""
  if ! has_tty; then
    printf -v "$__var" '%s' "$(random_password)"
    return
  fi
  while :; do
    printf 'Password (min %d chars, empty = generate one): ' "$MIN_PASSWORD_LENGTH" >/dev/tty
    IFS= read -rs __pw </dev/tty
    printf '\n' >/dev/tty
    if [ -z "$__pw" ]; then
      __pw="$(random_password)"
      break
    fi
    if [ "${#__pw}" -lt "$MIN_PASSWORD_LENGTH" ]; then
      err "Password must be at least $MIN_PASSWORD_LENGTH characters."
      continue
    fi
    printf 'Repeat password: ' >/dev/tty
    IFS= read -rs __pw2 </dev/tty
    printf '\n' >/dev/tty
    [ "$__pw" = "$__pw2" ] && break
    err "Passwords do not match."
  done
  printf -v "$__var" '%s' "$__pw"
}

pause() {
  has_tty || return 0
  printf '\nPress Enter to continue...' >/dev/tty
  IFS= read -r _ </dev/tty
}

# ---------------------------------------------------------------------------
# Environment / prerequisites
# ---------------------------------------------------------------------------

require_root() {
  [ "$(id -u)" -eq 0 ] && return
  if command -v sudo >/dev/null 2>&1 && [ -f "$0" ]; then
    exec sudo -E "$0" "$@"
  fi
  die "This command must be run as root."
}

require_linux() {
  [ "$(uname -s)" = "Linux" ] || die "Only Linux servers are supported."
}

is_installed() { [ -f "$ENV_FILE" ] && [ -f "$COMPOSE_FILE" ]; }

require_installed() {
  is_installed || die "File Browser is not installed. Run '$APP_NAME install' first."
}

load_env() {
  # shellcheck disable=SC1090
  [ -f "$ENV_FILE" ] && . "$ENV_FILE"
}

save_env() {
  mkdir -p "$APP_DIR"
  {
    echo "# Managed by '$APP_NAME'. Run '$APP_NAME' to change these settings."
    printf 'FB_IMAGE=%q\n' "$FB_IMAGE"
    printf 'FB_PORT=%q\n' "$FB_PORT"
    printf 'FB_FILES_DIR=%q\n' "$FB_FILES_DIR"
    printf 'FB_DOMAIN=%q\n' "$FB_DOMAIN"
    printf 'FB_EMAIL=%q\n' "$FB_EMAIL"
    printf 'FB_TLS=%q\n' "$FB_TLS"
  } >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

pkg_install() {
  if command -v apt-get >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q "$@"
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$@"
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm "$@"
  else
    return 1
  fi
}

ensure_curl() {
  command -v curl >/dev/null 2>&1 && return
  info "Installing curl..."
  pkg_install curl ca-certificates || die "Could not install curl, please install it manually."
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -p "$APP_NAME" -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -p "$APP_NAME" -f "$COMPOSE_FILE" "$@"
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    info "Installing Docker (get.docker.com)..."
    ensure_curl
    local installer
    installer="$(mktemp)"
    curl -fsSL https://get.docker.com -o "$installer" || die "Could not download the Docker installer."
    # DOCKER_INSTALL_MIRROR (e.g. Aliyun, AzureChinaCloud) helps where Docker's servers are blocked.
    if [ -n "${DOCKER_INSTALL_MIRROR:-}" ]; then
      sh "$installer" --mirror "$DOCKER_INSTALL_MIRROR" || die "Docker installation failed."
    else
      sh "$installer" || die "Docker installation failed."
    fi
    rm -f "$installer"
  fi

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || true
  fi

  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    info "Installing the Docker Compose plugin..."
    pkg_install docker-compose-plugin || die "Could not install the Docker Compose plugin."
  fi

  docker info >/dev/null 2>&1 || die "Docker is installed but not running. Try: systemctl start docker"
  ok "Docker is ready ($(docker --version | sed 's/,.*//'))."
}

write_compose() {
  local tls_env="" tls_volume="" healthcheck=""
  if [ "$FB_TLS" = "true" ]; then
    tls_env="
    environment:
      - FB_CERT=/certs/fullchain.pem
      - FB_KEY=/certs/privkey.pem"
    tls_volume="
      - \"$CERT_DIR:/certs:ro\""
    # The image's healthcheck speaks plain HTTP only.
    healthcheck="
    healthcheck:
      disable: true"
  fi

  cat >"$COMPOSE_FILE" <<EOF
# Generated by '$APP_NAME' from $ENV_FILE. Do not edit by hand.
services:
  filebrowser:
    image: $FB_IMAGE
    container_name: $APP_NAME
    restart: unless-stopped
    ports:
      - "$FB_PORT:80"
    volumes:
      - "$FB_FILES_DIR:/srv"
      - "$APP_DIR/data/database:/database"
      - "$APP_DIR/data/config:/config"$tls_volume$tls_env$healthcheck
EOF
}

prepare_dirs() {
  mkdir -p "$APP_DIR/data/database" "$APP_DIR/data/config" "$CERT_DIR"
  chown -R "$CONTAINER_UID:$CONTAINER_GID" "$APP_DIR/data" "$CERT_DIR"
  if [ ! -d "$FB_FILES_DIR" ]; then
    mkdir -p "$FB_FILES_DIR"
    chown "$CONTAINER_UID:$CONTAINER_GID" "$FB_FILES_DIR"
  elif [ "$(stat -c %u "$FB_FILES_DIR" 2>/dev/null)" != "$CONTAINER_UID" ]; then
    warn "$FB_FILES_DIR is not owned by UID $CONTAINER_UID; File Browser may not be able to write to it."
    warn "Fix with: chown -R $CONTAINER_UID:$CONTAINER_GID $FB_FILES_DIR"
  fi
}

is_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$APP_NAME" 2>/dev/null)" = "true" ]
}

base_url() {
  local scheme="http" host port_suffix=""
  [ "$FB_TLS" = "true" ] && scheme="https"
  host="${FB_DOMAIN:-$(server_ip)}"
  if ! { [ "$scheme" = "http" ] && [ "$FB_PORT" = "80" ]; } && ! { [ "$scheme" = "https" ] && [ "$FB_PORT" = "443" ]; }; then
    port_suffix=":$FB_PORT"
  fi
  printf '%s://%s%s' "$scheme" "$host" "$port_suffix"
}

server_ip() {
  local ip
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
  [ -z "$ip" ] && ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s' "${ip:-localhost}"
}

wait_healthy() {
  local scheme="http"
  [ "$FB_TLS" = "true" ] && scheme="https"
  for _ in $(seq 1 60); do
    if curl -fsSk --max-time 2 "$scheme://127.0.0.1:$FB_PORT/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# fb_cli <args...> runs the filebrowser binary inside a one-off container.
# BoltDB allows only one process at a time, so the server is stopped while
# the command runs and started again afterwards.
fb_cli() {
  local was_running=0 rc
  if is_running; then
    was_running=1
    compose stop >/dev/null 2>&1
  fi
  compose run --rm --no-deps -T filebrowser "$@"
  rc=$?
  if [ "$was_running" -eq 1 ]; then
    compose start >/dev/null 2>&1 || err "Could not start File Browser again, run '$APP_NAME start'."
  fi
  return "$rc"
}

# fb_cli_quiet hides the "Using database" log noise from the output.
fb_cli_quiet() {
  fb_cli "$@" 2>&1 | grep -vE 'Using database|WARNING: filebrowser.db'
  return "${PIPESTATUS[0]}"
}

# ---------------------------------------------------------------------------
# Commands: lifecycle
# ---------------------------------------------------------------------------

# cleanup_legacy removes leftovers of the old non-Docker setup from the
# README (a systemd unit running the binary and an nginx + certbot proxy),
# which hold the ports the container and certbot need.
cmd_cleanup_legacy() {
  require_root cleanup-legacy
  local unit found=0
  for unit in /etc/systemd/system/filebrowser.service /lib/systemd/system/filebrowser.service; do
    [ -f "$unit" ] || continue
    found=1
    warn "Found the old File Browser systemd service: $unit"
    if confirm "Stop and remove it? (its config and database in /etc/filebrowser are kept)" y; then
      systemctl disable --now filebrowser.service >/dev/null 2>&1 || true
      rm -f "$unit"
      systemctl daemon-reload
      systemctl reset-failed filebrowser.service >/dev/null 2>&1 || true
      ok "Removed the old systemd service."
    fi
  done

  local sites=() site domains=()
  for site in /etc/nginx/sites-enabled/filebrowser /etc/nginx/sites-available/filebrowser /etc/nginx/conf.d/filebrowser.conf; do
    [ -e "$site" ] || [ -L "$site" ] || continue
    sites+=("$site")
    if [ -f "$site" ]; then
      # shellcheck disable=SC2207
      domains+=($(awk '$1 == "server_name" { for (i = 2; i <= NF; i++) { gsub(";", "", $i); print $i } }' "$site" | sort -u))
    fi
  done
  if [ "${#sites[@]}" -gt 0 ]; then
    found=1
    warn "Found an old nginx site for File Browser: ${sites[*]}"
    if confirm "Remove it? (nginx would otherwise keep ports 80/443 busy)" y; then
      rm -f "${sites[@]}"
      ok "Removed the nginx site."
      remove_nginx_if_unused
      remove_nginx_certs "${domains[@]}"
    fi
  fi

  [ "$found" -eq 0 ] && ok "No leftovers of an old installation found."
  return 0
}

remove_nginx_if_unused() {
  command -v nginx >/dev/null 2>&1 || return 0
  local others
  others="$(find /etc/nginx/sites-enabled /etc/nginx/conf.d -mindepth 1 -maxdepth 1 ! -name default 2>/dev/null)"
  if [ -n "$others" ]; then
    warn "nginx still serves other sites, keeping it:"
    printf '%s\n' "$others" | sed 's/^/    /' >&2
    nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1
    warn "nginx keeps ports 80/443, so use another port for File Browser and keep HTTPS in nginx."
    return 0
  fi
  if confirm "nginx serves nothing else now. Stop and uninstall nginx?" y; then
    systemctl disable --now nginx >/dev/null 2>&1 || true
    if command -v apt-get >/dev/null 2>&1; then
      DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq 'nginx*' python3-certbot-nginx >/dev/null 2>&1
      apt-get autoremove -y -qq >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then
      dnf remove -y -q nginx python3-certbot-nginx >/dev/null 2>&1
    elif command -v yum >/dev/null 2>&1; then
      yum remove -y -q nginx python3-certbot-nginx >/dev/null 2>&1
    fi
    ok "nginx stopped and uninstalled."
  fi
}

# remove_nginx_certs deletes certificates that certbot can only renew through
# nginx; `cert issue` gets a new one that renews without it.
remove_nginx_certs() {
  command -v certbot >/dev/null 2>&1 || return 0
  command -v nginx >/dev/null 2>&1 && return 0
  local domain conf
  for domain in "$@"; do
    conf="/etc/letsencrypt/renewal/$domain.conf"
    if [ ! -f "$conf" ] || ! grep -qE '^(authenticator|installer) *= *nginx' "$conf"; then
      continue
    fi
    if confirm "Delete the nginx-based certificate for $domain? (it cannot renew without nginx)" y; then
      certbot delete --non-interactive --cert-name "$domain" >/dev/null 2>&1 && ok "Deleted the certificate for $domain."
    fi
  done
}

cmd_install() {
  require_root "install" "$@"
  require_linux
  ensure_curl
  ensure_docker
  cmd_cleanup_legacy

  if is_installed; then
    load_env
    warn "File Browser is already installed in $APP_DIR."
    confirm "Reinstall? Your files, users and settings are kept" n || return 0
  fi

  echo
  printf '%sFile Browser setup%s\n' "$C_BOLD" "$C_RESET"
  ask FB_FILES_DIR "Directory to share" "$FB_FILES_DIR"
  ask FB_PORT "Port to listen on" "$FB_PORT"
  ask FB_IMAGE "Docker image" "$FB_IMAGE"

  local fresh_db=1 admin_user="admin" admin_pass=""
  [ -f "$DB_FILE" ] && fresh_db=0
  if [ "$fresh_db" -eq 1 ]; then
    ask admin_user "Admin username" "admin"
    ask_password admin_pass
  fi

  local want_cert=0
  if confirm "Set up HTTPS with a free Let's Encrypt certificate now? (needs a domain pointing to this server)" n; then
    want_cert=1
    ask FB_DOMAIN "Domain" "$FB_DOMAIN"
    ask FB_EMAIL "Email for Let's Encrypt notices (optional)" "$FB_EMAIL"
  fi

  # The first boot always runs over plain HTTP; HTTPS is switched on below.
  [ "$fresh_db" -eq 1 ] && FB_TLS="false"

  save_env
  prepare_dirs
  write_compose

  if ! is_running && port_in_use "$FB_PORT"; then
    err "Port $FB_PORT is already in use:"
    ss -ltnpH "sport = :$FB_PORT" >&2
    die "Free the port or run '$APP_NAME install' again and choose another one."
  fi

  info "Pulling $FB_IMAGE..."
  compose pull || die "Could not pull $FB_IMAGE. Set a reachable image with: FB_IMAGE=... $APP_NAME install"
  compose up -d --remove-orphans || die "Could not start the container."

  info "Waiting for File Browser to start..."
  wait_healthy || die "File Browser did not become ready. Check '$APP_NAME logs'."

  if [ "$fresh_db" -eq 1 ]; then
    info "Setting admin credentials..."
    if ! fb_cli_quiet users update admin --username "$admin_user" --password "$admin_pass" --perm.admin; then
      err "Could not set the admin credentials. The random password is in '$APP_NAME logs'."
    fi
  fi

  install_self

  if [ "$want_cert" -eq 1 ] && [ -n "$FB_DOMAIN" ]; then
    cmd_cert_issue || warn "Certificate setup failed; File Browser keeps running over HTTP. Retry with '$APP_NAME cert issue'."
  fi

  echo
  ok "File Browser is installed and running."
  printf '  URL:      %s\n' "$(base_url)"
  if [ "$fresh_db" -eq 1 ]; then
    printf '  Username: %s\n' "$admin_user"
    printf '  Password: %s\n' "$admin_pass"
    warn "Save this password now, it will not be shown again."
  fi
  printf '\nRun %s%s%s any time to open the management menu.\n' "$C_BOLD" "$APP_NAME" "$C_RESET"
}

# install_self copies this script to $BIN_PATH so `filebrowser` opens the menu.
install_self() {
  local self
  self="$(readlink -f "$0" 2>/dev/null || echo "$0")"
  [ "$self" = "$BIN_PATH" ] && return
  if [ -f "$BIN_PATH" ] && ! head -c 64 "$BIN_PATH" | grep -q 'bash'; then
    warn "Moving the old filebrowser binary to $BIN_PATH.bin.bak"
    mv "$BIN_PATH" "$BIN_PATH.bin.bak"
  fi
  if [ -f "$self" ]; then
    install -m 755 "$self" "$BIN_PATH"
  else
    curl -fsSL "$SCRIPT_URL" -o "$BIN_PATH" && chmod 755 "$BIN_PATH"
  fi
}

cmd_start() { require_root start; require_installed; compose up -d && ok "Started. $(base_url)"; }
cmd_stop() { require_root stop; require_installed; compose stop && ok "Stopped."; }
cmd_restart() { require_root restart; require_installed; compose up -d && compose restart && ok "Restarted."; }

cmd_logs() {
  require_root logs
  require_installed
  compose logs -f --tail 200
}

cmd_status() {
  require_root status
  require_installed
  local state
  state="$(docker inspect -f '{{.State.Status}}' "$APP_NAME" 2>/dev/null || echo "not created")"
  printf '%sFile Browser%s\n' "$C_BOLD" "$C_RESET"
  printf '  Status:     %s\n' "$state"
  printf '  URL:        %s\n' "$(base_url)"
  printf '  Image:      %s\n' "$FB_IMAGE"
  printf '  Files:      %s\n' "$FB_FILES_DIR"
  printf '  Data:       %s\n' "$APP_DIR/data"
  printf '  HTTPS:      %s\n' "$([ "$FB_TLS" = "true" ] && echo "on ($FB_DOMAIN)" || echo "off")"
  if [ "$FB_TLS" = "true" ] && [ -f "$CERT_DIR/fullchain.pem" ] && command -v openssl >/dev/null 2>&1; then
    printf '  Cert until: %s\n' "$(openssl x509 -enddate -noout -in "$CERT_DIR/fullchain.pem" | cut -d= -f2)"
  fi
}

cmd_update() {
  require_root update
  require_installed
  info "Pulling the latest image..."
  compose pull && compose up -d --remove-orphans && ok "File Browser updated."
  docker image prune -f >/dev/null 2>&1 || true
}

cmd_self_update() {
  require_root self-update
  ensure_curl
  local tmp
  tmp="$(mktemp)"
  curl -fsSL "$SCRIPT_URL" -o "$tmp" || die "Could not download $SCRIPT_URL"
  bash -n "$tmp" || die "Downloaded script is invalid, keeping the current one."
  install -m 755 "$tmp" "$BIN_PATH"
  rm -f "$tmp"
  ok "Management script updated."
}

cmd_set_port() {
  require_root set-port
  require_installed
  local port="${1:-}"
  [ -z "$port" ] && ask port "New port" "$FB_PORT"
  case "$port" in '' | *[!0-9]*) die "Invalid port: $port" ;; esac
  FB_PORT="$port"
  save_env
  write_compose
  compose up -d && ok "File Browser now listens on $(base_url)"
}

cmd_uninstall() {
  require_root uninstall
  require_installed
  confirm "Remove the File Browser container?" n || return 0
  compose down --remove-orphans
  rm -f "$CRON_FILE"
  if confirm "Also DELETE all data in $APP_DIR/data (users, settings, shares)? Shared files in $FB_FILES_DIR are not touched" n; then
    rm -rf "$APP_DIR/data" "$CERT_DIR"
  fi
  rm -f "$COMPOSE_FILE" "$ENV_FILE"
  rm -f "$BIN_PATH"
  ok "File Browser uninstalled."
}

# ---------------------------------------------------------------------------
# Commands: users
# ---------------------------------------------------------------------------

cmd_users() {
  local sub="${1:-}"
  shift || true
  require_root users "$sub" "$@"
  require_installed
  case "$sub" in
    ls | list | "") fb_cli_quiet users ls ;;
    add) user_add "$@" ;;
    passwd | password) user_passwd "$@" ;;
    rename) user_rename "$@" ;;
    rm | remove | delete) user_rm "$@" ;;
    admin) user_admin "$@" ;;
    *) die "Unknown users command: $sub (ls, add, passwd, rename, rm, admin)" ;;
  esac
}

user_add() {
  local username="${1:-}" password="${2:-}" admin=""
  [ -z "$username" ] && ask username "New username"
  [ -z "$username" ] && die "Username is required."
  [ -z "$password" ] && ask_password password
  confirm "Give '$username' admin rights?" n && admin="--perm.admin"
  fb_cli_quiet users add "$username" "$password" $admin || die "Could not add '$username'."
  ok "User '$username' added. Password: $password"
}

user_passwd() {
  local username="${1:-}" password="${2:-}"
  [ -z "$username" ] && { fb_cli_quiet users ls; ask username "Username (or ID) to change password for"; }
  [ -z "$username" ] && die "Username is required."
  [ -z "$password" ] && ask_password password
  fb_cli_quiet users update "$username" --password "$password" || die "Could not change the password of '$username'."
  ok "Password for '$username' changed. New password: $password"
}

user_rename() {
  local username="${1:-}" new_name="${2:-}"
  [ -z "$username" ] && { fb_cli_quiet users ls; ask username "Current username (or ID)"; }
  [ -z "$new_name" ] && ask new_name "New username"
  { [ -z "$username" ] || [ -z "$new_name" ]; } && die "Both usernames are required."
  fb_cli_quiet users update "$username" --username "$new_name" || die "Could not rename '$username'."
  ok "User '$username' renamed to '$new_name'."
}

user_rm() {
  local username="${1:-}"
  [ -z "$username" ] && { fb_cli_quiet users ls; ask username "Username (or ID) to delete"; }
  [ -z "$username" ] && die "Username is required."
  confirm "Delete user '$username'?" n || return 0
  fb_cli_quiet users rm "$username" || die "Could not delete '$username'."
  ok "User '$username' deleted."
}

user_admin() {
  local username="${1:-}" value="${2:-}"
  [ -z "$username" ] && { fb_cli_quiet users ls; ask username "Username (or ID)"; }
  [ -z "$username" ] && die "Username is required."
  if [ -z "$value" ]; then
    confirm "Make '$username' an admin? (No = remove admin rights)" y && value=true || value=false
  fi
  case "$value" in true | false) ;; *) die "Expected true or false, got: $value" ;; esac
  fb_cli_quiet users update "$username" --perm.admin="$value" || die "Could not update '$username'."
  ok "Admin rights for '$username': $value"
}

# ---------------------------------------------------------------------------
# Commands: certificates (Let's Encrypt via certbot, standalone mode)
# ---------------------------------------------------------------------------

ensure_certbot() {
  command -v certbot >/dev/null 2>&1 && return
  info "Installing certbot..."
  if ! pkg_install certbot; then
    if command -v snap >/dev/null 2>&1; then
      snap install --classic certbot && ln -sf /snap/bin/certbot /usr/bin/certbot
    fi
  fi
  command -v certbot >/dev/null 2>&1 || die "Could not install certbot, please install it manually."
}

# ensure_renewal makes sure `certbot renew` runs regularly. Most packages ship
# a systemd timer; otherwise a cron job is added.
ensure_renewal() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -qE '^(certbot|snap\.certbot\.renew)\.timer'; then
    systemctl enable --now certbot.timer >/dev/null 2>&1 || systemctl enable --now snap.certbot.renew.timer >/dev/null 2>&1 || true
    rm -f "$CRON_FILE"
    ok "Automatic renewal is handled by the certbot systemd timer."
  else
    echo "17 3 * * * root certbot renew --quiet" >"$CRON_FILE"
    chmod 644 "$CRON_FILE"
    ok "Automatic renewal scheduled daily via $CRON_FILE."
  fi
}

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "sport = :$1" 2>/dev/null | grep -q .
  else
    return 1
  fi
}

cmd_cert() {
  local sub="${1:-}"
  shift || true
  case "$sub" in
    issue | new) cmd_cert_issue "$@" ;;
    renew) cmd_cert_renew "$@" ;;
    disable | off) cmd_cert_disable ;;
    *) die "Unknown cert command: $sub (issue, renew, disable)" ;;
  esac
}

cmd_cert_issue() {
  require_root cert issue "$@"
  require_installed
  local domain="${1:-$FB_DOMAIN}" email="${2:-$FB_EMAIL}"
  [ -z "$domain" ] && ask domain "Domain (must point to this server)" "$FB_DOMAIN"
  [ -z "$domain" ] && die "A domain is required."
  if [ -z "$email" ] && [ $# -eq 0 ]; then
    ask email "Email for Let's Encrypt notices (optional)" "$FB_EMAIL"
  fi

  ensure_certbot

  # certbot's standalone server needs port 80. If File Browser itself holds
  # it, stop it for the challenge and on every renewal.
  local hooks=() stopped=0
  if [ "$FB_PORT" = "80" ] && is_running; then
    compose stop >/dev/null 2>&1 && stopped=1
    hooks=(--pre-hook "$BIN_PATH stop" --post-hook "$BIN_PATH start")
  fi
  if port_in_use 80; then
    warn "Port 80 is used by another program; certbot needs it free to verify your domain:"
    ss -ltnpH "sport = :80" >&2
  fi

  local email_args=(--register-unsafely-without-email)
  [ -n "$email" ] && email_args=(-m "$email")

  # An existing certificate obtained another way (e.g. certbot --nginx) would
  # keep renewing that way, so replace it with a standalone one.
  local mode=(--keep-until-expiring)
  local renewal_conf="/etc/letsencrypt/renewal/$domain.conf"
  if [ -f "$renewal_conf" ] && ! grep -qE '^authenticator *= *standalone' "$renewal_conf"; then
    mode=(--force-renewal)
  fi

  info "Requesting a certificate for $domain..."
  if ! certbot certonly --standalone --non-interactive --agree-tos "${email_args[@]}" \
    -d "$domain" "${mode[@]}" "${hooks[@]}" \
    --deploy-hook "$BIN_PATH cert-deploy"; then
    [ "$stopped" -eq 1 ] && compose start >/dev/null 2>&1
    err "certbot failed. Check that $domain points to this server and port 80 is reachable."
    return 1
  fi

  FB_DOMAIN="$domain"
  FB_EMAIL="$email"
  FB_TLS="true"
  if [ "$FB_PORT" = "80" ] || [ "$FB_PORT" = "8080" ]; then
    FB_PORT=443
  fi
  save_env
  deploy_cert "/etc/letsencrypt/live/$domain" || return 1
  write_compose
  compose up -d
  ensure_renewal
  ok "HTTPS enabled: $(base_url)"
}

cmd_cert_renew() {
  require_root cert renew "$@"
  require_installed
  ensure_certbot
  local force=()
  [ "${1:-}" = "--force" ] && force=(--force-renewal)
  [ -n "$FB_DOMAIN" ] && force+=(--cert-name "$FB_DOMAIN")
  info "Renewing certificates..."
  certbot renew "${force[@]}" || die "Renewal failed."
  # The deploy hook only runs when something was actually renewed; copying
  # again is harmless and keeps certs in sync after manual changes.
  [ -n "$FB_DOMAIN" ] && deploy_cert "/etc/letsencrypt/live/$FB_DOMAIN" && restart_if_running
  ok "Certificates are up to date."
}

cmd_cert_disable() {
  require_root cert disable
  require_installed
  FB_TLS="false"
  save_env
  write_compose
  compose up -d && ok "HTTPS disabled: $(base_url)"
}

# deploy_cert copies the certificate where the non-root container can read it.
deploy_cert() {
  local live="$1"
  [ -f "$live/fullchain.pem" ] || { err "No certificate found in $live"; return 1; }
  mkdir -p "$CERT_DIR"
  install -m 644 -o "$CONTAINER_UID" -g "$CONTAINER_GID" "$live/fullchain.pem" "$CERT_DIR/fullchain.pem"
  install -m 600 -o "$CONTAINER_UID" -g "$CONTAINER_GID" "$live/privkey.pem" "$CERT_DIR/privkey.pem"
}

restart_if_running() {
  is_running && compose restart >/dev/null 2>&1
  return 0
}

# Called by certbot after every successful issue/renewal.
cmd_cert_deploy() {
  require_root cert-deploy
  require_installed
  deploy_cert "${RENEWED_LINEAGE:-/etc/letsencrypt/live/$FB_DOMAIN}" && restart_if_running
}

# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------

menu_header() {
  clear 2>/dev/null || true
  local state="not installed"
  if is_installed; then
    if is_running; then state="${C_GREEN}running${C_RESET}"; else state="${C_RED}stopped${C_RESET}"; fi
  fi
  printf '%s╭──────────────────────────────────────╮%s\n' "$C_BLUE" "$C_RESET"
  printf '%s│%s   %sFile Browser management%s            %s│%s\n' "$C_BLUE" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_BLUE" "$C_RESET"
  printf '%s╰──────────────────────────────────────╯%s\n' "$C_BLUE" "$C_RESET"
  printf '  Status: %s\n' "$state"
  is_installed && printf '  URL:    %s\n' "$(base_url)"
  echo
}

menu() {
  has_tty || { usage; exit 1; }
  require_root
  while :; do
    load_env
    menu_header
    cat <<EOF
  ${C_BOLD}Service${C_RESET}
   1) Install / reinstall
   2) Start            3) Stop            4) Restart
   5) Status           6) Logs            7) Update

  ${C_BOLD}Users${C_RESET}
   8) List users       9) Add user       10) Change password
  11) Change username 12) Admin rights   13) Delete user

  ${C_BOLD}HTTPS certificate${C_RESET}
  14) Issue certificate
  15) Renew certificate
  16) Disable HTTPS

  ${C_BOLD}Other${C_RESET}
  17) Change port     18) Update this script
  19) Uninstall        0) Exit

EOF
    local choice
    ask choice "Choose an option"
    echo
    # Each action runs in a subshell so a failing command (die) returns to the menu.
    case "$choice" in
      1) (cmd_install) ;;
      2) (cmd_start) ;;
      3) (cmd_stop) ;;
      4) (cmd_restart) ;;
      5) (cmd_status) ;;
      6) (trap 'exit 0' INT; cmd_logs) ;;
      7) (cmd_update) ;;
      8) (cmd_users ls) ;;
      9) (cmd_users add) ;;
      10) (cmd_users passwd) ;;
      11) (cmd_users rename) ;;
      12) (cmd_users admin) ;;
      13) (cmd_users rm) ;;
      14) (cmd_cert_issue) ;;
      15) (cmd_cert_renew) ;;
      16) (cmd_cert_disable) ;;
      17) (cmd_set_port) ;;
      18) (cmd_self_update) && exec "$BIN_PATH" ;;
      19) (cmd_uninstall) && ! is_installed && exit 0 ;;
      0 | q | exit) exit 0 ;;
      *) err "Invalid option: $choice" ;;
    esac
    pause
  done
}

usage() {
  cat <<EOF
Usage: $APP_NAME [command]

Without a command an interactive management menu opens.

Service:
  install                   Install Docker (if needed) and File Browser
  start | stop | restart    Control the container
  status                    Show status, URL and certificate expiry
  logs                      Follow container logs
  update                    Pull the latest image and recreate the container
  set-port <port>           Change the published port
  cleanup-legacy            Remove an old systemd service / nginx site for File Browser
  uninstall                 Remove File Browser

Users:
  users ls                          List users
  users add [user] [password]       Add a user
  users passwd [user] [password]    Change a password
  users rename [user] [new-name]    Change a username
  users admin [user] [true|false]   Grant or revoke admin rights
  users rm [user]                   Delete a user

HTTPS (Let's Encrypt):
  cert issue [domain] [email]       Get a certificate and enable HTTPS
  cert renew [--force]              Renew now (also renewed automatically)
  cert disable                      Go back to plain HTTP

Other:
  cli <args...>             Run the filebrowser binary inside the container
                            (e.g. '$APP_NAME cli config cat')
  self-update               Update this management script
  help                      Show this help
EOF
}

main() {
  load_env
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    "") menu ;;
    install) cmd_install "$@" ;;
    start) cmd_start ;;
    stop) cmd_stop ;;
    restart) cmd_restart ;;
    status) cmd_status ;;
    logs) cmd_logs ;;
    update) cmd_update ;;
    set-port) cmd_set_port "$@" ;;
    uninstall) cmd_uninstall ;;
    cleanup-legacy) cmd_cleanup_legacy ;;
    users | user) cmd_users "$@" ;;
    cert | certs | ssl) cmd_cert "$@" ;;
    cert-deploy) cmd_cert_deploy ;;
    cli) require_root cli "$@"; require_installed; fb_cli "$@" ;;
    self-update) cmd_self_update ;;
    help | -h | --help) usage ;;
    *) err "Unknown command: $cmd"; usage; exit 1 ;;
  esac
}

main "$@"
