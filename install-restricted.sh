#!/bin/sh
#
# This script is for installing filebrowser from a custom domain (for restricted environments)
#
# You can run this script like this:
# 		curl -fsSL http://artist.mattweb.ir/filebrowser/install.sh | bash
# or
# 		wget -qO- http://artist.mattweb.ir/filebrowser/install.sh | bash
#
# After installation, you can run filebrowser by typing `filebrowser` in your terminal.
#
# You can also specify a version to install by setting the VERSION environment variable:
# 		VERSION=v2.22.0 curl -fsSL http://artist.mattweb.ir/filebrowser/install.sh | bash
#
# You can also specify a custom installation directory by setting the INSTALL_DIR environment variable:
# 		INSTALL_DIR=/usr/local/bin curl -fsSL http://artist.mattweb.ir/filebrowser/install.sh | bash

set -e

# Function to detect the operating system
detect_os() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$OS" in
    linux)
      OS='linux'
      ;;
    darwin)
      OS='darwin'
      ;;
    *)
      echo "Unsupported OS: $OS"
      exit 1
      ;;
  esac
}

# Function to detect the architecture
detect_arch() {
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)
      ARCH='amd64'
      ;;
    armv8*)
      ARCH='arm64'
      ;;
    aarch64)
      ARCH='arm64'
      ;;
    armv*)
      ARCH='armv7'
      ;;
    *)
      echo "Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac
}

# Function to get the latest version from the custom domain
get_latest_version() {
  if [ -z "$VERSION" ]; then
    VERSION=$(curl -s "http://artist.mattweb.ir/filebrowser/latest")
  fi
}

# Main installation function
main() {
  detect_os
  detect_arch
  get_latest_version

  INSTALL_DIR=${INSTALL_DIR:-/usr/local/bin}
  FILENAME="filebrowser_${OS}_${ARCH}.tar.gz"
  DOWNLOAD_URL="http://artist.mattweb.ir/filebrowser/releases/${VERSION}/${FILENAME}"

  echo "Downloading filebrowser $VERSION for $OS/$ARCH from $DOWNLOAD_URL"
  curl -fsSL "$DOWNLOAD_URL" -o "/tmp/$FILENAME"

  echo "Extracting filebrowser to $INSTALL_DIR"
  tar -xzf "/tmp/$FILENAME" -C "/tmp"
  sudo mv "/tmp/filebrowser" "$INSTALL_DIR/filebrowser"

  echo "Cleaning up"
  rm "/tmp/$FILENAME"

  echo "Filebrowser installed successfully to $INSTALL_DIR/filebrowser"
  echo "You can now run filebrowser by typing 'filebrowser' in your terminal."
}

main
