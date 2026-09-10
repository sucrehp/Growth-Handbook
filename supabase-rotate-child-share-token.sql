-- Growth Portfolio Lite V1 / GP-L5.1E
-- Minimal authenticated share-token rotation for an existing child.
-- Production application must be performed manually in Supabase SQL Editor.

begin;

create or replace function public.rotate_child_share_token(p_child_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $func$
declare
  v_new_token text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'authentication required';
  end if;

  if p_child_id is null then
    raise exception 'child id required';
  end if;

  v_new_token := replace(gen_random_uuid()::text, '-', '')
              || replace(gen_random_uuid()::text, '-', '');

  update public.children
  set share_token = v_new_token,
      updated_at = now()
  where id = p_child_id
  returning share_token into v_new_token;

  if not found then
    raise exception 'child not found';
  end if;

  return v_new_token;
end;
$func$;

revoke all on function public.rotate_child_share_token(uuid)
  from public, anon, authenticated;
grant execute on function public.rotate_child_share_token(uuid)
  to authenticated;

commit;
