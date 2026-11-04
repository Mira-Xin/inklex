import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('database ownership, conflict protection, trash and atomic import',async t=>{
 const db=new PGlite();
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
 const owner=async(id:string)=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const read=async()=>{const r=await db.query<{value:any}>('select public.inklex_read_notebook() value');return r.rows[0].value;};
 const entry=(id:string,en=id)=>({id,type:'单词',en,meanings:[{text:'译法',context:'',example:'',source:'',label:''}],themes:['科技'],links:[],category:'其他实词',note:'',source:'',ipa:'',collocations:'',status:0,created:1,updated:1});
 const save=async(revision:string,updates:any[],removed:string[]=[],themes=['科技'])=>{
  const r=await db.query<{value:any}>('select public.inklex_save_notebook($1::uuid,$2::jsonb,$3::text[],$4::jsonb,$5::jsonb) value',[revision,JSON.stringify(updates),removed,JSON.stringify(themes),'[]']);return r.rows[0].value;
 };
 let initial:any,latest:any;
 await t.test('a fresh account has its own empty notebook',async()=>{await owner(a);initial=await read();assert.equal(initial.data.entries.length,0);assert.ok(initial.revision);});
 await t.test('saved entries and custom themes persist together',async()=>{await save(initial.revision,[entry('one'),entry('two')]);latest=await read();assert.equal(latest.data.entries.length,2);assert.deepEqual(latest.data.themes,['科技']);assert.notEqual(latest.revision,initial.revision);});
 await t.test('an old device cannot overwrite a newer revision',async()=>{await assert.rejects(save(initial.revision,[entry('one','stale change')]),/INKLEX_CONFLICT/);assert.equal((await read()).data.entries.find((e:any)=>e.id==='one').en,'one');});
 await t.test('invalid or duplicate entries roll back the whole request',async()=>{await assert.rejects(save(latest.revision,[entry('valid'),{...entry('invalid'),en:''}]),/INKLEX_INVALID/);assert.equal((await read()).data.entries.length,2);await assert.rejects(save(latest.revision,[entry('one'),entry('one')]),/INKLEX_INVALID_DUPLICATE/);});
 await t.test('another account cannot read or write the first account rows',async()=>{await owner(b);assert.equal((await read()).data.entries.length,0);const r=await db.query('select * from public.inklex_entries where owner_id=$1',[a]);assert.equal(r.rows.length,0);await assert.rejects(db.query('insert into public.inklex_entries(owner_id,entry_id,payload) values($1,$2,$3::jsonb)',[a,'intrusion',JSON.stringify(entry('intrusion'))]),/row-level security/);});
 await t.test('trash operations use the latest copy and are recoverable',async()=>{await owner(a);let r=await db.query<{value:any}>("select public.inklex_change_trash(array['one'],'trash') value");assert.equal(r.rows[0].value.count,1);assert.ok(r.rows[0].value.data.entries.find((e:any)=>e.id==='one').deleted);assert.equal(r.rows[0].value.data.entries.find((e:any)=>e.id==='two').en,'two');r=await db.query<{value:any}>("select public.inklex_change_trash(array['one'],'restore') value");assert.equal(r.rows[0].value.count,1);assert.equal(r.rows[0].value.data.entries.find((e:any)=>e.id==='one').deleted,undefined);});
 await t.test('confirmed backup replacement is atomic',async()=>{const before=await read();await save(before.revision,[entry('replacement')],['one','two'],['文学']);const after=await read();assert.deepEqual(after.data.entries.map((e:any)=>e.id),['replacement']);assert.deepEqual(after.data.themes,['文学']);});
 await t.test('anonymous visitors have no table or function access',async()=>{await db.exec('reset role;set role anon');await assert.rejects(read(),/permission denied/);await assert.rejects(db.query('select * from public.inklex_entries'),/permission denied/);});
 await t.test('rerunning setup preserves saved data',async()=>{await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));await owner(a);assert.equal((await read()).data.entries[0].id,'replacement');});
 await db.close();
});
