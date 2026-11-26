import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createMaterialFileStore,materialStoragePath,MAX_MATERIAL_FILE_BYTES} from '../src/lib/cloud-files';
import {normalizeData} from '../src/lib/types';
import {linkEntryToMaterials,materialIdsForEntry} from '../src/lib/material-links';
import type {MaterialFile,Workspace} from '../src/lib/workspace';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
function storageClient(){
 const objects=new Map<string,Blob>(),calls:string[]=[];
 const client={storage:{from:(bucket:string)=>({
  upload:async(path:string,file:Blob,options:{upsert:boolean})=>{calls.push(`upload:${bucket}/${path}`);assert.equal(options.upsert,false);objects.set(path,file);return {data:{path},error:null};},
  download:async(path:string)=>{calls.push(`download:${bucket}/${path}`);return {data:objects.get(path),error:null};}
 })}} as unknown as SupabaseClient;
 return {client,objects,calls};
}
test('a different device reads the uploaded audio from its cloud reference, with no local browser files',async()=>{
 const backend=storageClient(),first=createMaterialFileStore(backend.client,owner,'https://example.supabase.co');
 const audio=new File(['audio bytes'],'演讲录音.m4a',{type:'audio/mp4'}),reference=await first.upload('material','audio',audio);
 assert.equal(reference.name,'演讲录音.m4a');assert.equal(reference.storagePath,`${owner}/material/audio.m4a`);
 const copy=normalizeData({themes:[],entries:[],workspace:{materials:[{id:'material',title:'材料',files:[reference],links:['entry'],durationSeconds:180,cuts:[30]}],activity:[]}});
 const deviceTwo=createMaterialFileStore(backend.client,owner,'https://example.supabase.co');
 const restored=await deviceTwo.read(copy.workspace!.materials[0].files[0]);
 assert.equal(await restored.text(),'audio bytes');assert.equal(restored.name,'演讲录音.m4a');assert.equal(restored.type,'audio/mp4');assert.deepEqual(copy.workspace!.materials[0].cuts,[30]);
});
test('another account cannot request a private file path; invalid paths are rejected before network access',async()=>{
 const backend=storageClient(),store=createMaterialFileStore(backend.client,other,'https://example.supabase.co');
 const reference:MaterialFile={id:'file',name:'x.mp3',type:'audio/mpeg',size:1,storagePath:`${owner}/material/file.mp3`};
 await assert.rejects(store.read(reference),/不属于当前账号/);assert.equal(backend.calls.length,0);
 assert.throws(()=>materialStoragePath(owner,'../bad','file','x.mp3'),/标识无效/);
 await assert.rejects(store.read({...reference,storagePath:`${other}/../file.mp3`}),/不属于当前账号/);assert.equal(backend.calls.length,0);
});
test('oversize and failed uploads never produce successful cloud metadata',async()=>{
 const backend=storageClient(),store=createMaterialFileStore(backend.client,owner,'https://example.supabase.co');
 await assert.rejects(store.upload('material','large',{size:MAX_MATERIAL_FILE_BYTES+1,name:'large.mp3',type:'audio/mpeg'} as File),/50 MB/);assert.equal(backend.calls.length,0);
 const denied={storage:{from:()=>({upload:async()=>({data:null,error:{statusCode:403,message:'new row violates row-level security policy'}})})}} as unknown as SupabaseClient;
 await assert.rejects(createMaterialFileStore(denied,owner,'https://example.supabase.co').upload('material','file',new File(['a'],'x.mp3')),/cloud-files.sql/);
});
test('links edited from a corpus entry update the practice material relation and can be removed from either side',()=>{
 const value=normalizeData({themes:[],entries:[],workspace:{materials:[{id:'first',title:'第一份',links:['other-entry']},{id:'second',title:'第二份',links:[]}],activity:[]}});
 let workspace=value.workspace as Workspace;workspace=linkEntryToMaterials(workspace,'entry',['first','first','unknown']);
 assert.deepEqual(materialIdsForEntry(workspace,'entry'),['first']);assert.deepEqual(workspace.materials[0].links,['other-entry','entry']);
 workspace=linkEntryToMaterials(workspace,'entry',['second']);assert.deepEqual(workspace.materials[0].links,['other-entry']);assert.deepEqual(materialIdsForEntry(workspace,'entry'),['second']);
 workspace={...workspace,materials:workspace.materials.map(material=>({...material,links:material.links.filter(id=>id!=='entry')}))};assert.deepEqual(materialIdsForEntry(workspace,'entry'),[]);
 const restored=normalizeData(JSON.parse(JSON.stringify({...value,workspace})));assert.deepEqual(restored.workspace,workspace);
});
