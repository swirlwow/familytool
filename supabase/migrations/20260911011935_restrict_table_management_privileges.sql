-- Browser roles use row-level SELECT/INSERT/UPDATE/DELETE, not table management.
-- Requires PostgreSQL 17+ (the verified Supabase baseline).
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
 ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;
