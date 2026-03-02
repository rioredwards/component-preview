#!/bin/sh
set -e

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Install pnpm and project dependencies
npm install -g pnpm
pnpm install

# Alias claude to always skip permissions prompts inside this container
echo "alias claude='claude --dangerously-skip-permissions'" >> /home/node/.bashrc
cd /workspaces/component-preview/

# Install Playwright's Chromium browser and its OS dependencies
npx playwright install chromium
sudo npx playwright install-deps chromium
