#!/usr/bin/env bash
# Falha se alguma tabela do schema public estiver sem RLS habilitada ou sem
# nenhuma política. É o guarda da invariante do projeto — rode antes de subir
# qualquer migration nova.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project_id="$(grep -m1 '^project_id' "$root/supabase/config.toml" | cut -d'"' -f2)"
container="supabase_db_${project_id}"

if ! docker inspect "$container" >/dev/null 2>&1; then
  echo "erro: container $container não está no ar. Rode 'pnpm db:start' antes." >&2
  exit 1
fi

offenders="$(docker exec -i "$container" psql -U postgres -d postgres -tAc "
  select c.relname
       || case when not c.relrowsecurity then ' (RLS desabilitada)' else '' end
       || case when count(p.polname) = 0 then ' (sem política)' else '' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname, c.relrowsecurity
  having not c.relrowsecurity or count(p.polname) = 0;
")"

if [ -n "$offenders" ]; then
  echo "RLS: reprovado" >&2
  echo "$offenders" | sed 's/^/  - /' >&2
  exit 1
fi

echo "RLS: todas as tabelas de public têm RLS habilitada e ao menos uma política."
