CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: Alice@x.com and alice@x.com are one account.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
    -- The token itself is the primary key; we store a SHA-256 of it, never the
    -- raw value, so a leaked database cannot be used to impersonate anyone.
    token_hash text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS chats (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chats_user_id_created_at_idx ON chats (user_id, created_at DESC);

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id    uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    filename   text NOT NULL,
    status     text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: ADD CONSTRAINT has no IF NOT EXISTS, so drop first.
-- Ingestion is asynchronous, so the extracted text must outlive the request.
-- Also lets us re-embed without asking the user to re-upload.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content    text NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS attempts   int  NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error text;
-- When a worker claims a job; used to requeue jobs whose worker died.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- The worker scans for pending work; index the columns it filters on.
CREATE INDEX IF NOT EXISTS documents_status_created_at_idx
    ON documents (status, created_at);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD  CONSTRAINT documents_status_check
    CHECK (status IN ('pending','processing','ready','failed'));

CREATE TABLE IF NOT EXISTS chunks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chat_id     uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    chunk_index int  NOT NULL,
    content     text NOT NULL,
    embedding   vector(384) NOT NULL,
    embedding_model text NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_chat_id_idx ON chunks (chat_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id    uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('user','assistant')),
    content    text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
ALTER TABLE messages ADD  CONSTRAINT messages_role_check
    CHECK (role IN ('user', 'assistant'));

-- Composite: every read is "this chat's messages, oldest first".
CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx
    ON messages (chat_id, created_at);


-- Foreign keys stated separately so they survive a table being recreated.
-- ADD CONSTRAINT has no IF NOT EXISTS, so drop first.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_chat_id_fkey;
ALTER TABLE documents ADD  CONSTRAINT documents_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_chat_id_fkey;
ALTER TABLE chunks ADD  CONSTRAINT chunks_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_fkey;
ALTER TABLE chunks ADD  CONSTRAINT chunks_document_id_fkey
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;
ALTER TABLE messages ADD  CONSTRAINT messages_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
