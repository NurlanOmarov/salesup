-- HNSW-индекс для семантического поиска по эмбеддингам (cosine, voyage-3 / 1024 изм. — D-001).
-- HNSW выбран вместо ivfflat (D-006): не требует обучения центроидов на данных,
-- поэтому корректно создаётся ДО загрузки эмбеддингов фабрикой (Sprint 3),
-- когда таблица ещё пуста. Параметры m/ef_construction — дефолтные pgvector.
CREATE INDEX IF NOT EXISTS "transcript_chunk_embedding_hnsw"
  ON "TranscriptChunk"
  USING hnsw ("embedding" vector_cosine_ops);
