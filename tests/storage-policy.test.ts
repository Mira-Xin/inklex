import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('private storage SQL isolates users and is safe to rerun',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
  create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;
  grant usage on schema auth,storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
  const sql=await readFile(new URL('../supabase/cloud-files.sql',import.meta.url),'utf8');await db.exec(sql);
  const actAs=async(id:string)=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
  await actAs(a);await db.query('insert into storage.objects values($1,$2)',['inklex-material-files',`${a}/material/file.mp3`]);
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await actAs(b);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(db.query('insert into storage.objects values($1,$2)',['inklex-material-files',`${a}/material/other.mp3`]),/row-level security/);
  await assert.rejects(db.query('insert into storage.objects values($1,$2)',['different-bucket',`${b}/material/other.mp3`]),/row-level security/);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from storage.objects'),/permission denied/);
  await db.exec('reset role');await db.exec(sql);const bucket=await db.query<{public:boolean;file_size_limit:bigint}>('select * from storage.buckets');assert.equal(bucket.rows[0].public,false);assert.equal(Number(bucket.rows[0].file_size_limit),52428800);
  await actAs(a);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 }finally{await db.close();}
});
