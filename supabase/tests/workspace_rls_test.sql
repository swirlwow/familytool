BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(13);

INSERT INTO public.workspaces (id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Workspace One'),
  ('20000000-0000-0000-0000-000000000002', 'Workspace Two');

INSERT INTO public.user_workspaces (id, user_id, workspace_id) VALUES
  (
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000022',
    '20000000-0000-0000-0000-000000000202',
    '20000000-0000-0000-0000-000000000002'
  );

INSERT INTO public.notes (id, workspace_id) VALUES
  ('10000000-0000-0000-0000-000000000111', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000222', '20000000-0000-0000-0000-000000000002');

INSERT INTO public.stickies (id, workspace_id) VALUES
  ('10000000-0000-0000-0000-000000001111', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000002222', '20000000-0000-0000-0000-000000000002');

INSERT INTO public.sticky_items (id, sticky_id) VALUES
  ('10000000-0000-0000-0000-000000011111', '10000000-0000-0000-0000-000000001111'),
  ('20000000-0000-0000-0000-000000022222', '20000000-0000-0000-0000-000000002222');

SELECT results_eq(
  $$
    SELECT count(*)::bigint
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
  $$,
  ARRAY[0::bigint],
  'No application policy is unconditionally open'
);

SELECT results_eq(
  $$
    SELECT count(*)::bigint
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee = 'anon'
  $$,
  ARRAY[0::bigint],
  'Anonymous role has no application table grants'
);

SET LOCAL ROLE anon;

SELECT throws_ok(
  'SELECT count(*)::bigint FROM public.notes',
  '42501',
  'permission denied for table notes',
  'Anonymous users cannot read notes'
);

SELECT throws_ok(
  $$
    INSERT INTO public.notes (id, workspace_id)
    VALUES (
      '30000000-0000-0000-0000-000000000333',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'permission denied for table notes',
  'Anonymous users cannot create notes'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000101';

SELECT results_eq(
  'SELECT count(*)::bigint FROM public.notes',
  ARRAY[1::bigint],
  'Members see notes in their own workspace only'
);

SELECT results_eq(
  'SELECT count(*)::bigint FROM public.user_workspaces',
  ARRAY[1::bigint],
  'Members see only their own workspace links'
);

SELECT lives_ok(
  $$
    INSERT INTO public.notes (id, workspace_id)
    VALUES (
      '10000000-0000-0000-0000-000000000333',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  'Members can create data in their own workspace'
);

SELECT throws_ok(
  $$
    INSERT INTO public.notes (id, workspace_id)
    VALUES (
      '20000000-0000-0000-0000-000000000333',
      '20000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "notes"',
  'Members cannot create data in another workspace'
);

SELECT results_eq(
  $$
    UPDATE public.notes
    SET workspace_id = '10000000-0000-0000-0000-000000000001'
    WHERE id = '20000000-0000-0000-0000-000000000222'
    RETURNING 1
  $$,
  $$ SELECT 1 WHERE false $$,
  'Members cannot update rows in another workspace'
);

SELECT results_eq(
  'SELECT count(*)::bigint FROM public.sticky_items',
  ARRAY[1::bigint],
  'Child rows inherit workspace access from their sticky'
);

SELECT throws_ok(
  $$
    INSERT INTO public.sticky_items (id, sticky_id)
    VALUES (
      '20000000-0000-0000-0000-000000033333',
      '20000000-0000-0000-0000-000000002222'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "sticky_items"',
  'Members cannot add child rows to another workspace'
);

SELECT throws_ok(
  $$
    INSERT INTO public.user_workspaces (id, user_id, workspace_id)
    VALUES (
      '10000000-0000-0000-0000-000000000099',
      '10000000-0000-0000-0000-000000000101',
      '20000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'permission denied for table user_workspaces',
  'Members cannot self-assign another workspace'
);

RESET ROLE;

SELECT results_eq(
  $$
    SELECT count(*)::bigint
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles @> ARRAY['public']::name[]
  $$,
  ARRAY[0::bigint],
  'No application policy targets the public role'
);

SELECT * FROM finish();
ROLLBACK;
