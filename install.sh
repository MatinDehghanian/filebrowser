#!/usr/bin/env bash
#
# This script installs File Browser on a Linux server using Docker.
#
# It can be run directly like this:
# 		bash <(curl -fsSL https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/install.sh)
# or
# 		curl -fsSL https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/install.sh | sudo bash
#
# What it does:
#   - installs Docker and the Docker Compose plugin if they are missing
#   - installs the `filebrowser` management command to /usr/local/bin
#   - runs File Browser in a Docker container (data in /opt/filebrowser)
#   - optionally gets a Let's Encrypt certificate and enables HTTPS
#
# After installation, type `filebrowser` to open the management menu
# (start/stop, logs, users and passwords, certificates, updates).
#
# Optional environment variables:
#   FB_IMAGE               Docker image (default docker.io/themattdev/filebrowser:latest)
#   FB_APP_DIR             Installation directory (default /opt/filebrowser)
#   FB_SCRIPT_URL          Where to download the management script from
#   DOCKER_INSTALL_MIRROR  Mirror for get.docker.com (e.g. Aliyun, AzureChinaCloud)

set -e

SCRIPT_URL="${FB_SCRIPT_URL:-https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/scripts/filebrowser.sh}"
BIN_PATH="/usr/local/bin/filebrowser"

if [ "$(uname -s)" != "Linux" ]; then
  echo "This installer supports Linux servers only."
  echo "For other systems, download a binary from https://github.com/MatinDehghanian/filebrowser/releases"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this installer as root, e.g.:"
  echo "  curl -fsSL https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/install.sh | sudo bash"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Installing curl..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq curl ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q curl
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q curl
  else
    echo "Please install curl and run this installer again."
    exit 1
  fi
fi

# Prefer the management script next to this file (when run from a clone).
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
TMP_SCRIPT="$(mktemp)"
trap 'rm -f "$TMP_SCRIPT"' EXIT

if [ -n "$SOURCE_DIR" ] && [ -f "$SOURCE_DIR/scripts/filebrowser.sh" ]; then
  cp "$SOURCE_DIR/scripts/filebrowser.sh" "$TMP_SCRIPT"
else
  echo "Downloading the management script from $SCRIPT_URL"
  curl -fsSL "$SCRIPT_URL" -o "$TMP_SCRIPT"
fi
bash -n "$TMP_SCRIPT"

# Earlier versions of this installer put the filebrowser binary here.
if [ -f "$BIN_PATH" ] && ! head -c 64 "$BIN_PATH" | grep -q 'bash'; then
  echo "Moving the old filebrowser binary to $BIN_PATH.bin.bak"
  mv "$BIN_PATH" "$BIN_PATH.bin.bak"
fi

install -m 755 "$TMP_SCRIPT" "$BIN_PATH"
echo "Installed the management command to $BIN_PATH"

# Prompts read from /dev/tty inside the script, so piping this file works.
exec "$BIN_PATH" install
