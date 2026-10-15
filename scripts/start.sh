#!/usr/bin/env bash
# Build and start PawGroove, then expose it to the internet via a cloudflared
# quick tunnel so it can be opened from a local browser.
set -euo pipefail

cd "$(dirname "$0")/.."

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

# Install cloudflared if it's not already available.
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found, installing..."
  ARCH="$(uname -m)"
  case "${ARCH}" in
    x86_64) CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    *) echo "Unsupported architecture: ${ARCH}"; exit 1 ;;
  esac
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" -o /tmp/cloudflared
  chmod +x /tmp/cloudflared
  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared 2>/dev/null || mv /tmp/cloudflared /usr/local/bin/cloudflared
fi

echo "Starting cloudflared tunnel for http://localhost:${PORT} ..."
TUNNEL_LOG="$(mktemp)"
cloudflared tunnel --url "http://localhost:${PORT}" > "${TUNNEL_LOG}" 2>&1 &
TUNNEL_PID=$!

# cloudflared prints the public URL to stderr/stdout once the tunnel is ready.
echo "Waiting for the public URL..."
PUBLIC_URL=""
for i in $(seq 1 60); do
  PUBLIC_URL="$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "${TUNNEL_LOG}" | head -n1 || true)"
  if [ -n "${PUBLIC_URL}" ]; then
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
