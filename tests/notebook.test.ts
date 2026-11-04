import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createNotebookStore} from '../src/lib/notebook';
import {normalizeData} from '../src/lib/types';
const data=()=>normalizeData({themes:['科技'],entries:[{id:'one',type:'单词',en:'one',meanings:[{text:'一'}],themes:['科技'],created:1,updated:1},{id:'two',type:'词组',en:'of all places',meanings:[{text:'偏偏'}],created:1,updated:1}]});
test('only changed entries are sent; a failed save keeps the previous base',async()=>{
 const calls:any[]=[];let fail=false;
 const client={rpc:async(name:string,args?:unknown)=>{calls.push({name,args});if(name==='inklex_read_notebook')return {data:{data:data(),revision:'v1'},error:null};if(fail)return {data:null,error:{message:'INKLEX_CONFLICT'}};return {data:{revision:'v2'},error:null};}} as unknown as SupabaseClient;
 const store=createNotebookStore(client);const original=await store.read(),next=structuredClone(original.data);next.entries[0].note='edited';fail=true;
 await assert.rejects(store.save(next,'v1'),/另一台设备/);fail=false;await store.save(next,'v1');
 assert.equal(calls[2].args.p_entry_updates.length,1);assert.equal(calls[2].args.p_entry_updates[0].id,'one');assert.deepEqual(calls[2].args.p_removed_ids,[]);
 await assert.rejects(store.save(next,'v1'),/刷新云端/);
});
test('old site backups get missing optional fields safely normalized',()=>{const value=data();assert.equal(value.entries[0].collocations,'');assert.equal(value.entries[0].status,0);assert.deepEqual(value.entries[0].links,[]);assert.throws(()=>normalizeData({...value,entries:[value.entries[0],value.entries[0]]}),/重复/);});
