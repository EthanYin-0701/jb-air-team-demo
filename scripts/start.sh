#!/usr/bin/env bash
# Start script for Linux and macOS.
# Installs dependencies (if needed), builds the project, and starts the production server.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  for ENV_FILE in ".env.local" ".env"; do
    if [ -f "${ENV_FILE}" ]; then
      ENV_VALUE="$(grep -E '^OPENROUTER_API_KEY=' "${ENV_FILE}" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
      if [ -n "${ENV_VALUE}" ]; then
        export OPENROUTER_API_KEY="${ENV_VALUE}"
        echo "Loaded OPENROUTER_API_KEY from ${ENV_FILE}."
        break
      fi
    fi
  done
fi

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "Warning: OPENROUTER_API_KEY is not set (checked environment, .env.local, .env)." >&2
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not available in PATH." >&2
  echo "Please install Node.js (https://nodejs.org/) and try again." >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building the project..."
npm run build

echo "Starting the server..."
npm run start
