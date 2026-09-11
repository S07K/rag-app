#!/usr/bin/env bash
# Drops every table and recreates the schema.
#
# Needed when changing EMBEDDING_PROVIDER: vectors from different models are not
# comparable and the vector(N) column width is fixed, so stored embeddings are
# unusable. Destroys all accounts, chats and documents.
set -euo pipefail

DB=${1:-rag_app}

read -rp "Drop ALL data in '$DB'? [y/N] " reply
[[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "aborted"; exit 1; }

psql -d "$DB" -q -c "DROP TABLE IF EXISTS chunks, messages, documents, chats, sessions, users CASCADE"
psql -d "$DB" -f "$(dirname "$0")/../repository/db/schema.sql"
echo "reset complete"
