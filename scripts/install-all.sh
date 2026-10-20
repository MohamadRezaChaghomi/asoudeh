#!/usr/bin/env bash
set -e
npm --prefix backend install
npm --prefix frontend install
echo "Dependencies installed."
