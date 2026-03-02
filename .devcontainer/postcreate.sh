#!/bin/sh
set -e

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Install pnpm and project dependencies
npm install -g pnpm
pnpm install

# Alias claude to always skip permissions prompts inside this container
echo "alias claude='claude --dangerously-skip-permissions'" >> /home/node/.bashrc
cd 
