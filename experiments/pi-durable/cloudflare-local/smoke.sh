#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
WRANGLER=${WRANGLER:-../../node_modules/.bin/wrangler}
state=$(mktemp -d)
pid=''
cleanup() { if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi; rm -rf "$state"; }
trap cleanup EXIT
start() {
  "$WRANGLER" dev --local --ip 127.0.0.1 --port 8794 --config cloudflare-local/wrangler.jsonc --persist-to "$state/data" >"$state/log" 2>&1 & pid=$!
  for _ in {1..30}; do if curl --noproxy '*' -s -o /dev/null http://127.0.0.1:8794/; then return; fi; sleep 1; done
  cat "$state/log"; return 1
}
request() { curl --noproxy '*' -fsS -H 'content-type: application/json' --data "$1" http://127.0.0.1:8794/; }
start
first=$(request '{"session":"a","operationId":"one","prompt":"hello"}')
kill "$pid"; wait "$pid" || true; pid=''
start
retry=$(request '{"session":"a","operationId":"one","prompt":"hello"}')
other=$(request '{"session":"b","operationId":"one","prompt":"hello"}')
node - "$first" "$retry" "$other" <<'NODE'
const assert = require('node:assert/strict');
const [first, retry, other] = process.argv.slice(2).map(JSON.parse);
assert.equal(first.accepted, true); assert.equal(first.status, 'done');
assert.equal(first.text, 'Local Pi Durable response.');
assert.equal(retry.accepted, false); assert.equal(retry.text, first.text);
assert.equal(other.accepted, true); assert.equal(other.status, 'done');
console.log('PiHarness local Worker: submission, restart, idempotent retry, and session isolation passed.');
NODE
