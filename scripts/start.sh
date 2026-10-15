#!/usr/bin/env bash
# Build and start PawGroove, then expose it to the internet via a cloudflared
# quick tunnel so it can be opened from a local browser.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

PORT="${PORT:-3000}"

echo "Building the project..."
npm run build

echo "Starting the server on 0.0.0.0:${PORT}..."
npx next start -H 0.0.0.0 -p "${PORT}" &
SERVER_PID=$!

cleanup() {
  echo "Stopping server and tunnel..."
  kill "${SERVER_PID}" 2>/dev/null || true
  [ -n "${TUNNEL_PID:-}" ] && kill "${TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the app to start responding before opening the tunnel.
echo "Waiting for the app to become ready..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}" | grep -q "200"; then
    echo "App is up."
    break
  fi
  sleep 1
done

is_runnable_cloudflared() {
  local candidate="$1"
  [ -n "${candidate}" ] || return 1
  [ -x "${candidate}" ] || return 1
  "${candidate}" --version >/dev/null 2>&1
}

# Resolve a cloudflared binary that actually runs on *this* OS/CPU.
# NOTE: macOS cannot execute the Linux builds — installing `cloudflared-linux-*`
# on a Mac fails with "cannot execute binary file".
CLOUDFLARED_BIN=""

if command -v cloudflared >/dev/null 2>&1 && is_runnable_cloudflared "$(command -v cloudflared)"; then
  CLOUDFLARED_BIN="$(command -v cloudflared)"
  echo "Using cloudflared at ${CLOUDFLARED_BIN} ($(cloudflared --version 2>/dev/null | head -n1))"
fi

if [ -z "${CLOUDFLARED_BIN}" ] && is_runnable_cloudflared "${PROJECT_ROOT}/.tools/cloudflared"; then
  CLOUDFLARED_BIN="${PROJECT_ROOT}/.tools/cloudflared"
  echo "Using cloudflared at ${CLOUDFLARED_BIN}"
fi

if [ -z "${CLOUDFLARED_BIN}" ]; then
  if command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared at $(command -v cloudflared) cannot run on this platform (built for another OS/CPU). Installing a matching build..."
  else
    echo "cloudflared not found, installing..."
  fi

  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "${OS}" in
    Darwin) CF_OS="darwin" ;;
    Linux) CF_OS="linux" ;;
    *)
      echo "Unsupported OS: ${OS}. Please install cloudflared manually:" >&2
      echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
      exit 1
      ;;
  esac
  case "${ARCH}" in
    x86_64|amd64) CF_ARCH="amd64" ;;
    arm64|aarch64) CF_ARCH="arm64" ;;
    *)
      echo "Unsupported architecture: ${ARCH}. Please install cloudflared manually." >&2
      exit 1
      ;;
  esac

  CF_BASE="https://github.com/cloudflare/cloudflared/releases/latest/download"
  CF_TMP="$(mktemp -d)"
  if [ "${CF_OS}" = "darwin" ]; then
    # The macOS builds are published as .tgz archives.
    echo "Downloading cloudflared-darwin-${CF_ARCH}.tgz ..."
    curl -fsSL "${CF_BASE}/cloudflared-darwin-${CF_ARCH}.tgz" -o "${CF_TMP}/cloudflared.tgz"
    tar -xzf "${CF_TMP}/cloudflared.tgz" -C "${CF_TMP}"
  else
    echo "Downloading cloudflared-linux-${CF_ARCH} ..."
    curl -fsSL "${CF_BASE}/cloudflared-linux-${CF_ARCH}" -o "${CF_TMP}/cloudflared"
  fi
  chmod +x "${CF_TMP}/cloudflared"

  # Install inside the project (always writable, no sudo) and always call it by
  # path, so a stale/broken cloudflared earlier in PATH cannot shadow it.
  mkdir -p "${PROJECT_ROOT}/.tools"
  DEST="${PROJECT_ROOT}/.tools/cloudflared"
  mv -f "${CF_TMP}/cloudflared" "${DEST}"
  rm -rf "${CF_TMP}"

  if ! is_runnable_cloudflared "${DEST}"; then
    echo "The downloaded cloudflared at ${DEST} cannot run on this platform either." >&2
    exit 1
  fi

  CLOUDFLARED_BIN="${DEST}"
  echo "Installed cloudflared to ${CLOUDFLARED_BIN}"

  BROKEN_CF="$(command -v cloudflared 2>/dev/null || true)"
  if [ -n "${BROKEN_CF}" ]; then
    echo "Note: ${BROKEN_CF} is not usable on this platform, the tunnel will use ${CLOUDFLARED_BIN} instead."
    echo "      You can remove the stale binary with: sudo rm -f ${BROKEN_CF}"
  fi
fi

echo "Starting cloudflared tunnel for http://localhost:${PORT} ..."
TUNNEL_LOG="$(mktemp)"
"${CLOUDFLARED_BIN}" tunnel --url "http://localhost:${PORT}" > "${TUNNEL_LOG}" 2>&1 &
TUNNEL_PID=$!

# cloudflared prints the public URL to stderr/stdout once the tunnel is ready.
echo "Waiting for the public URL..."
PUBLIC_URL=""
for i in $(seq 1 60); do
  PUBLIC_URL="$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "${TUNNEL_LOG}" | head -n1 || true)"
  if [ -n "${PUBLIC_URL}" ]; then
    break
  fi
  # Stop early instead of waiting a full minute if the tunnel process died.
  if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ -n "${PUBLIC_URL}" ]; then
  echo ""
  echo "=============================================="
  echo " PawGroove is accessible at: ${PUBLIC_URL}"
  echo "=============================================="
  echo ""
else
  echo "Could not detect the public tunnel URL. Full cloudflared log:"
  cat "${TUNNEL_LOG}"
fi

# Keep the script running so the server and tunnel stay alive.
wait "${SERVER_PID}"
