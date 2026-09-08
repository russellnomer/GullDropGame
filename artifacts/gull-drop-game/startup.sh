#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null http://127.0.0.1:8080/; then
  echo "dev server already up"
  exit 0
fi
npm run dev > /tmp/gull-drop-dev.log 2>&1 &
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null http://127.0.0.1:8080/; then
    echo "dev server ready"
    exit 0
  fi
  i=$((i + 1))
  sleep 0.4
done
echo "dev server failed to start"
tail -n 40 /tmp/gull-drop-dev.log || true
exit 1
