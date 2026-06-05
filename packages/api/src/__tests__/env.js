// Sets required env vars in each Jest worker before any module is loaded.
process.env.DATABASE_URL    = process.env.DATABASE_URL    || 'postgresql://postgres:changeme@localhost:5432/llm_observatory_test';
process.env.JWT_SECRET      = process.env.JWT_SECRET      || '00'.repeat(64);
process.env.ENCRYPTION_KEY  = process.env.ENCRYPTION_KEY  || '00'.repeat(32);
process.env.NODE_ENV        = 'test';
