#!/usr/bin/env bash
# VitalNoteAI — Local Android Build Script
# Usage: bash build-local.sh
#
# API keys are loaded automatically from .env via .easignore.
# No env var exports needed — just run this script.

set -e
echo "[build-local] Starting EAS local Android build..."
# NODE_OPTIONS: disables the experimental fetch implementation in Node 18+
# which has known HTTP/2 socket hang-up issues in WSL2. Forces Node to use
# the stable http/https modules instead, which resolves EAS GraphQL failures.
NODE_OPTIONS="--no-experimental-fetch" eas build -p android --profile preview --local --non-interactive
