#!/bin/bash
# OpenClaw Agent Dashboard Server
# Simple HTTP server to serve the dashboard

PORT="${1:-3000}"
DASHBOARD_DIR="/root/.openclaw/workspace/dashboard"

echo "🎯 OpenClaw Agent Command Center"
echo "================================"
echo "Starting server on http://0.0.0.0:${PORT}"
echo ""
echo "Access from other machines: http://$(hostname -I | awk '{print $1}'):${PORT}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Check if Python is available (most universal)
if command -v python3 &> /dev/null; then
    cd "$DASHBOARD_DIR" && python3 -m http.server "$PORT" --bind 0.0.0.0
elif command -v python &> /dev/null; then
    cd "$DASHBOARD_DIR" && python -m SimpleHTTPServer "$PORT"
# Node.js fallback
elif command -v npx &> /dev/null; then
    cd "$DASHBOARD_DIR" && npx serve -l "tcp://0.0.0.0:${PORT}"
else
    echo "Error: No suitable HTTP server found. Install Python or Node.js."
    exit 1
fi
