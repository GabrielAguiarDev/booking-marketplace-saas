#!/usr/bin/env bash
# Usa apenas o banco local DESTE projeto, mesmo com outros Supabase no Docker.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# -ne 1 || ! -f "$project_root/$1" ]]; then
  echo "Uso: bash scripts/run-db-sql.sh <arquivo.sql relativo à raiz>" >&2
  exit 1
fi

project_id="$(sed -n 's/^project_id = "\([^"]*\)".*/\1/p' "$project_root/supabase/config.toml" | head -1)"
if [[ -z "$project_id" ]]; then
  echo "Erro: project_id ausente em supabase/config.toml." >&2
  exit 1
fi
db_container="supabase_db_${project_id}"
if [[ "$(docker inspect --format '{{.State.Running}}' "$db_container" 2>/dev/null || true)" != "true" ]]; then
  echo "Erro: banco local $db_container indisponível. Rode pnpm db:start." >&2
  exit 1
fi

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$project_root/$1"
