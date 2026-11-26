-- 译笺：跨浏览器、跨设备附件。原网站已执行 workspace.sql 后，在 SQL Editor 运行一次。
-- 不修改任何现有语料；仅创建本应用的私人存储桶和账号隔离规则。
begin;
insert into storage.buckets(id,name,public,file_size_limit)
values('inklex-material-files','inklex-material-files',false,52428800)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

drop policy if exists inklex_files_read_own on storage.objects;
create policy inklex_files_read_own on storage.objects for select to authenticated
using(bucket_id='inklex-material-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists inklex_files_upload_own on storage.objects;
create policy inklex_files_upload_own on storage.objects for insert to authenticated
with check(bucket_id='inklex-material-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- 每次使用新的文件 ID，避免覆盖同一路径导致其他设备缓存旧音频。
-- 不向匿名访问者或其他账号开放任何读写权限。
commit;
