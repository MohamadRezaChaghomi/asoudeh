#!/usr/bin/env bash
set -e
npm ci --prefix backend
npm ci --prefix frontend
echo "Dependencies installed."
