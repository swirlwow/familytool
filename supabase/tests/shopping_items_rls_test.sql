begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.workspaces (id, name) values
  ('31000000-0000-0000-0000-000000000001', 'Shopping Workspace One'),
  ('32000000-0000-0000-0000-000000000002', 'Shopping Workspace Two');
insert into auth.users (id)
values ('31000000-0000-0000-0000-000000000101');
insert into public.user_workspaces (id, user_id, workspace_id) values
  ('31000000-0000-0000-0000-000000000011', '31000000-0000-0000-0000-000000000101', '31000000-0000-0000-0000-000000000001');
insert into public.shopping_items (id, workspace_id, name) values
  ('31000000-0000-0000-0000-000000000111', '31000000-0000-0000-0000-000000000001', 'Own item'),
  ('32000000-0000-0000-0000-000000000222', '32000000-0000-0000-0000-000000000002', 'Other item');

set local role anon;
select throws_ok(
  'select count(*)::bigint from public.shopping_items',
  '42501',
  'permission denied for table shopping_items',
  'Anonymous users cannot read shopping items'
);

set local role authenticated;
set local request.jwt.claim.sub = '31000000-0000-0000-0000-000000000101';
select results_eq(
  'select count(*)::bigint from public.shopping_items',
  array[1::bigint],
  'Members see shopping items in their own workspace only'
);
select lives_ok(
  $$insert into public.shopping_items (workspace_id, name)
    values ('31000000-0000-0000-0000-000000000001', 'Allowed item')$$,
  'Members can create shopping items in their own workspace'
);
select throws_ok(
  $$insert into public.shopping_items (workspace_id, name)
    values ('32000000-0000-0000-0000-000000000002', 'Blocked item')$$,
  '42501',
  'new row violates row-level security policy for table "shopping_items"',
  'Members cannot create shopping items in another workspace'
);
select results_eq(
  $$update public.shopping_items set name = 'Blocked update'
    where id = '32000000-0000-0000-0000-000000000222' returning 1$$,
  $$select 1 where false$$,
  'Members cannot update another workspace'
);

reset role;
select * from finish();
rollback;
