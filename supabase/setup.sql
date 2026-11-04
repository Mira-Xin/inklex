-- 译笺独立版：在自己的 Supabase 项目 → SQL Editor 中执行。
-- 不包含旧网站的私人语料；重复执行不会清空现有数据。
begin;

create or replace function public.inklex_valid_strings(p_value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
begin
 if p_value is null or jsonb_typeof(p_value) <> 'array' then return false; end if;
 return not exists(select 1 from jsonb_array_elements(p_value) item where jsonb_typeof(item) <> 'string');
end; $$;

create or replace function public.inklex_valid_entry(p_value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
begin
 if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 1048576 then return false; end if;
 if coalesce(jsonb_typeof(p_value->'id'),'') <> 'string' or length(p_value->>'id') not between 1 and 200 then return false; end if;
 if coalesce(p_value->>'type','') not in ('单词','词组','句子','汉语表达') then return false; end if;
 if coalesce(jsonb_typeof(p_value->'en'),'') <> 'string' or length(trim(p_value->>'en')) = 0 then return false; end if;
 if coalesce(jsonb_typeof(p_value->'meanings'),'') <> 'array' then return false; end if;
 if exists(select 1 from jsonb_array_elements(p_value->'meanings') item where jsonb_typeof(item) <> 'object' or coalesce(jsonb_typeof(item->'text'),'') <> 'string') then return false; end if;
 if not public.inklex_valid_strings(p_value->'themes') or not public.inklex_valid_strings(p_value->'links') then return false; end if;
 if coalesce(jsonb_typeof(p_value->'created'),'') <> 'number' or coalesce(jsonb_typeof(p_value->'updated'),'') <> 'number' then return false; end if;
 if p_value ? 'deleted' and (jsonb_typeof(p_value->'deleted') <> 'number' or (p_value->>'deleted')::numeric <= 0) then return false; end if;
 return true;
end; $$;

create table if not exists public.inklex_notebooks (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision uuid not null default gen_random_uuid(),
 themes jsonb not null default '["政治","经济","科技","教育","通用表达"]'::jsonb check (public.inklex_valid_strings(themes)),
 categories jsonb not null default '[]'::jsonb check (public.inklex_valid_strings(categories)),
 updated_at timestamptz not null default now()
);
create table if not exists public.inklex_entries (
 owner_id uuid not null references auth.users(id) on delete cascade,
 entry_id text not null,
 payload jsonb not null check (public.inklex_valid_entry(payload)),
 updated_at timestamptz not null default now(),
 primary key(owner_id,entry_id),
 constraint inklex_matching_id check(payload->>'id'=entry_id)
);

alter table public.inklex_notebooks enable row level security;
alter table public.inklex_entries enable row level security;
revoke all on public.inklex_notebooks,public.inklex_entries from public,anon,authenticated;
grant select,insert,update,delete on public.inklex_notebooks,public.inklex_entries to authenticated;
drop policy if exists inklex_own_notebook on public.inklex_notebooks;
create policy inklex_own_notebook on public.inklex_notebooks for all to authenticated
 using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
drop policy if exists inklex_own_entries on public.inklex_entries;
create policy inklex_own_entries on public.inklex_entries for all to authenticated
 using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

create or replace function public.inklex_read_notebook()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid:=auth.uid();v_meta public.inklex_notebooks%rowtype;v_entries jsonb;
begin
 if v_owner is null then raise exception 'INKLEX_NOT_AUTHENTICATED'; end if;
 insert into public.inklex_notebooks(owner_id) values(v_owner) on conflict(owner_id) do nothing;
 -- One shared lock gives metadata and entries from the same saved revision.
 select * into v_meta from public.inklex_notebooks where owner_id=v_owner for share;
 select coalesce(jsonb_agg(payload order by entry_id),'[]'::jsonb) into v_entries from public.inklex_entries where owner_id=v_owner;
 return jsonb_build_object('data',jsonb_build_object('entries',v_entries,'themes',v_meta.themes,'categories',v_meta.categories),'revision',v_meta.revision);
end; $$;

create or replace function public.inklex_save_notebook(
 p_expected_revision uuid,p_entry_updates jsonb,p_removed_ids text[],p_themes jsonb,p_categories jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid:=auth.uid();v_revision uuid;v_next uuid:=gen_random_uuid();v_entry jsonb;
begin
 if v_owner is null then raise exception 'INKLEX_NOT_AUTHENTICATED'; end if;
 if p_entry_updates is null or jsonb_typeof(p_entry_updates) <> 'array' or p_removed_ids is null or not public.inklex_valid_strings(p_themes) or not public.inklex_valid_strings(p_categories) then raise exception 'INKLEX_INVALID_DATA'; end if;
 if exists(select 1 from jsonb_array_elements(p_entry_updates) item where not public.inklex_valid_entry(item)) then raise exception 'INKLEX_INVALID_ENTRY'; end if;
 if exists(select 1 from jsonb_array_elements(p_entry_updates) item group by item->>'id' having count(*)>1) then raise exception 'INKLEX_INVALID_DUPLICATE'; end if;
 if exists(select 1 from jsonb_array_elements(p_entry_updates) item where item->>'id'=any(p_removed_ids)) then raise exception 'INKLEX_INVALID_OVERLAP'; end if;
 insert into public.inklex_notebooks(owner_id) values(v_owner) on conflict(owner_id) do nothing;
 select revision into v_revision from public.inklex_notebooks where owner_id=v_owner for update;
 if p_expected_revision is null or p_expected_revision <> v_revision then raise exception 'INKLEX_CONFLICT'; end if;
 for v_entry in select value from jsonb_array_elements(p_entry_updates) loop
  insert into public.inklex_entries(owner_id,entry_id,payload) values(v_owner,v_entry->>'id',v_entry)
  on conflict(owner_id,entry_id) do update set payload=excluded.payload,updated_at=now();
 end loop;
 -- Used only when the user confirms replacing the notebook with a JSON backup.
 delete from public.inklex_entries where owner_id=v_owner and entry_id=any(p_removed_ids);
 update public.inklex_notebooks set themes=p_themes,categories=p_categories,revision=v_next,updated_at=now() where owner_id=v_owner;
 return jsonb_build_object('revision',v_next);
end; $$;

create or replace function public.inklex_change_trash(p_ids text[],p_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid:=auth.uid();v_entry record;v_payload jsonb;v_count integer:=0;v_now numeric:=floor(extract(epoch from clock_timestamp())*1000);
begin
 if v_owner is null then raise exception 'INKLEX_NOT_AUTHENTICATED'; end if;
 if p_action is null or p_action not in ('trash','restore') or p_ids is null or cardinality(p_ids)=0 then raise exception 'INKLEX_INVALID_ACTION'; end if;
 perform 1 from public.inklex_notebooks where owner_id=v_owner for update;
 if not found then raise exception 'INKLEX_INVALID_NOTEBOOK'; end if;
 for v_entry in select entry_id,payload from public.inklex_entries where owner_id=v_owner and entry_id=any(p_ids) loop
  v_payload:=v_entry.payload;
  if p_action='trash' and not(v_payload ? 'deleted') then
   v_payload:=jsonb_set(v_payload,'{deleted}',to_jsonb(v_now));
  elsif p_action='restore' and v_payload ? 'deleted' and (v_payload->>'deleted')::numeric >= v_now-2592000000 then
   v_payload:=v_payload-'deleted';
  else continue;
  end if;
  v_payload:=jsonb_set(v_payload,'{updated}',to_jsonb(v_now));
  update public.inklex_entries set payload=v_payload,updated_at=now() where owner_id=v_owner and entry_id=v_entry.entry_id;
  v_count:=v_count+1;
 end loop;
 if v_count>0 then update public.inklex_notebooks set revision=gen_random_uuid(),updated_at=now() where owner_id=v_owner; end if;
 return public.inklex_read_notebook()||jsonb_build_object('count',v_count);
end; $$;

revoke all on function public.inklex_valid_strings(jsonb),public.inklex_valid_entry(jsonb),public.inklex_read_notebook(),public.inklex_save_notebook(uuid,jsonb,text[],jsonb,jsonb),public.inklex_change_trash(text[],text) from public,anon,authenticated;
grant execute on function public.inklex_valid_strings(jsonb),public.inklex_valid_entry(jsonb),public.inklex_read_notebook(),public.inklex_save_notebook(uuid,jsonb,text[],jsonb,jsonb),public.inklex_change_trash(text[],text) to authenticated;
commit;
