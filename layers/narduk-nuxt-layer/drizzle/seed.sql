-- Seed data for local development
-- Run: pnpm run db:seed (after db:migrate)

INSERT OR IGNORE INTO users (id, email, password_hash, name, is_admin, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@example.com', NULL, 'Demo User', 0, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000002', 'admin@example.com', NULL, 'Admin User', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000003', 'admin@nard.uk', '18f82e7d119b7e329f54fbe13d28f044:db5674814f4eb8326e7a8fa6141217dbc434c8921dd9f3ca96aa3b9c96d64cce', 'Nard.uk Admin', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO todos (user_id, title, completed, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Set up local development', 1, '2025-01-01T00:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000001', 'Run database migrations', 1, '2025-01-01T00:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000001', 'Seed the database', 0, '2025-01-01T00:00:00.000Z'),
  ('00000000-0000-0000-0000-000000000002', 'Review admin dashboard', 0, '2025-01-01T00:00:00.000Z');
