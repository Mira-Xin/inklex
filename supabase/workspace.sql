-- 素材库与活动记录升级。先执行 setup.sql，再执行本文件；重复执行保留数据。
begin;
alter table public.inklex_notebooks add column if not exists workspace jsonb not null default '{"materials":[],"activity":[]}'::jsonb;
create or replace function public.inklex_read_notebook()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid:=auth.uid();v_meta public.inklex_notebooks%rowtype;v_entries jsonb;
begin
 if v_owner is null then raise exception 'INKLEX_NOT_AUTHENTICATED'; end if;
 insert into public.inklex_notebooks(owner_id) values(v_owner) on conflict(owner_id) do nothing;
 select * into v_meta from public.inklex_notebooks where owner_id=v_owner for share;
 select coalesce(jsonb_agg(payload order by entry_id),'[]'::jsonb) into v_entries from public.inklex_entries where owner_id=v_owner;
 return jsonb_build_object('data',jsonb_build_object('entries',v_entries,'themes',v_meta.themes,'categories',v_meta.categories,'workspace',v_meta.workspace),'revision',v_meta.revision);
end; $$;
create or replace function public.inklex_save_notebook_v2(
 p_expected_revision uuid,p_entry_updates jsonb,p_removed_ids text[],p_themes jsonb,p_categories jsonb,p_workspace jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'INKLEX_NOT_AUTHENTICATED'; end if;
 if p_workspace is null or jsonb_typeof(p_workspace)<>'object' or coalesce(jsonb_typeof(p_workspace->'materials'),'')<>'array' or coalesce(jsonb_typeof(p_workspace->'activity'),'')<>'array' or octet_length(p_workspace::text)>16777216 then raise exception 'INKLEX_INVALID_WORKSPACE'; end if;
 if exists(select 1 from jsonb_array_elements(p_workspace->'materials') m where coalesce(jsonb_typeof(m),'')<>'object' or coalesce(jsonb_typeof(m->'id'),'')<>'string' or length(coalesce(m->>'id',''))=0 or coalesce(jsonb_typeof(m->'title'),'')<>'string' or length(trim(m->>'title'))=0) then raise exception 'INKLEX_INVALID_MATERIAL'; end if;
 if exists(select 1 from jsonb_array_elements(p_workspace->'materials') m group by m->>'id' having count(*)>1) then raise exception 'INKLEX_INVALID_DUPLICATE'; end if;
 if exists(select 1 from jsonb_array_elements(p_workspace->'activity') a where coalesce(jsonb_typeof(a),'')<>'object' or coalesce(jsonb_typeof(a->'id'),'')<>'string' or length(coalesce(a->>'id',''))=0 or coalesce(a->>'kind','') not in ('practice','input','output') or coalesce(a->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(jsonb_typeof(a->'count'),'')<>'number' or coalesce(jsonb_typeof(a->'minutes'),'')<>'number') then raise exception 'INKLEX_INVALID_ACTIVITY'; end if;
 if exists(select 1 from jsonb_array_elements(p_workspace->'activity') a group by a->>'id' having count(*)>1) then raise exception 'INKLEX_INVALID_DUPLICATE'; end if;
 -- The original function locks and checks the notebook revision. Both saves share this transaction.
 v_result:=public.inklex_save_notebook(p_expected_revision,p_entry_updates,p_removed_ids,p_themes,p_categories);
 update public.inklex_notebooks set workspace=p_workspace where owner_id=auth.uid();
 return v_result;
end; $$;
revoke all on function public.inklex_save_notebook_v2(uuid,jsonb,text[],jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.inklex_save_notebook_v2(uuid,jsonb,text[],jsonb,jsonb,jsonb) to authenticated;
commit;
