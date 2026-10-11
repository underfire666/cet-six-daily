#!/usr/bin/env bash
# Export only; restores require a separate, explicitly selected target database.
set -euo pipefail
umask 077
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
env_file="$repo_root/.env.china.local"
output_dir="$repo_root/backups"
while (($#)); do
  case "$1" in
    --env-file|--output-dir)
      [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || { printf 'Missing option value.\n' >&2; exit 1; }
      if [[ "$1" == --env-file ]]; then env_file="$2"; else output_dir="$2"; fi
      shift 2 ;;
    *) printf 'Usage: bash scripts/china-backup.sh [--env-file PATH] [--output-dir PATH]\n' >&2; exit 1 ;;
  esac
done
[[ -f "$env_file" ]] || { printf 'Deployment environment file not found.\n' >&2; exit 1; }
mkdir -p -- "$output_dir"
output_dir=$(cd -- "$output_dir" && pwd)
temp_file=$(mktemp "$output_dir/.cet6-backup.XXXXXXXX")
trap 'rm -f -- "$temp_file"' EXIT
docker compose --env-file "$env_file" -f "$repo_root/compose.china.yaml" exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$temp_file"
[[ -s "$temp_file" ]] || { printf 'Backup was empty; no export was kept.\n' >&2; exit 1; }
backup_file="$output_dir/cet6-$(date -u +%Y%m%dT%H%M%SZ)-${temp_file##*.}.dump"
# A hard link provides an atomic, no-overwrite publication on the same filesystem.
ln -- "$temp_file" "$backup_file"
(cd -- "$output_dir" && sha256sum -- "${backup_file##*/}" > "${backup_file##*/}.sha256")
printf 'Database export and SHA-256 saved in the selected private backup directory.\n'
