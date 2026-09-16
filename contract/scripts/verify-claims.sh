#!/usr/bin/env bash
# Verify that every number claimed in the docs matches what the code actually does.
#
# This exists because the numbers drifted four separate times. One sweep updated a
# test count by regex that replaced the leading digit but not the parenthesised one,
# shipping "24 passed (22)" and "22 / 24 passed" into the README. Counting by hand
# does not scale. This does.
#
#   bash contract/scripts/verify-claims.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ROOT=".."
fail=0

TESTS=$(npx vitest run 2>&1 | grep -oE "Tests +[0-9]+ passed" | grep -oE "[0-9]+" | head -1)
CIRCUITS=$(ls out/zkir/*.zkir 2>/dev/null | wc -l | tr -d ' ')
PROVERS=$(ls out-full/keys/* 2>/dev/null | wc -l | tr -d ' ')
DISCLOSE=$(grep -v '^[[:space:]]*//' src/inflight.compact | grep -c 'disclose(')
LEDGER8=$(ls out-ledger8/zkir/*.zkir 2>/dev/null | wc -l | tr -d ' ')

echo "ACTUAL: tests=$TESTS circuits=$CIRCUITS provingfiles=$PROVERS disclose=$DISCLOSE ledger8=$LEDGER8"
echo

for f in "$ROOT/README.md" "$ROOT/PRD.md" "$ROOT/ARCHITECTURE.md" "$ROOT/submission/proof.md" "$ROOT/submission/wave1-progress.md"; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  # ignore the guard's own sample output and any quoted historical example
  bad=$(grep -v 'ACTUAL:' "$f" | sed 's/"[^"]*"//g' | grep -oE "[0-9]+ passed \([0-9]+\)" | grep -v "^$TESTS passed ($TESTS)$" | head -1)
  if [ -n "$bad" ]; then printf "  FAIL  %-30s test-count: %s\n" "$base" "$bad"; fail=1; fi
  bad=$(grep -v 'ACTUAL:' "$f" | grep -oE "[0-9]+ passing tests" | grep -v "^$TESTS passing tests$" | head -1)
  if [ -n "$bad" ]; then printf "  FAIL  %-30s passing: %s\n" "$base" "$bad"; fail=1; fi
  bad=$(grep -v 'ACTUAL:' "$f" | grep -oE "(^|[^=0-9])[0-9]+ circuits" | grep -oE "[0-9]+ circuits" | grep -v "^$CIRCUITS circuits$" | head -1)
  if [ -n "$bad" ]; then printf "  FAIL  %-30s circuits: %s\n" "$base" "$bad"; fail=1; fi
  bad=$(grep -oE "[0-9]+ explicit .disclose" "$f" | grep -v "^$DISCLOSE explicit .disclose$" | head -1)
  if [ -n "$bad" ]; then printf "  FAIL  %-30s disclose: %s\n" "$base" "$bad"; fail=1; fi
done

python3 - "$ROOT/ARCHITECTURE.md" src/inflight.compact <<'PY'
import re, sys, pathlib
doc = pathlib.Path(sys.argv[1]).read_text()
src = pathlib.Path(sys.argv[2]).read_text().rstrip()
m = re.search(r'```compact\n(pragma language_version.*?)\n```', doc, re.S)
ok = bool(m) and m.group(1).rstrip() == src
print(("  ok    " if ok else "  FAIL  ") + "ARCHITECTURE.md embedded contract == contract/src/inflight.compact")
sys.exit(0 if ok else 1)
PY
if [ $? -ne 0 ]; then fail=1; fi

echo
if [ $fail -eq 0 ]; then
  echo "ALL CLAIMS VERIFIED against the code"
else
  echo "CLAIM MISMATCH — fix before submitting"
fi
exit $fail
