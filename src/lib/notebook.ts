import type {SupabaseClient} from '@supabase/supabase-js';
import {normalizeData,type Data,type NotebookStore,type Snapshot} from './types';

function friendlyError(error:{message?:string;code?:string}){
 const message=error.message||'';
 if(message.includes('INKLEX_CONFLICT'))return Error('另一台设备已更新语料。请先复制未保存的内容，关闭编辑后刷新云端内容，再核对并保存。');
 if(message.includes('INKLEX_NOT_AUTHENTICATED')||error.code==='PGRST301'||error.code==='42501')return Error('登录状态或访问权限有问题，请重新登录后重试。');
 if(error.code==='PGRST202'||error.code==='42P01')return Error('数据库尚未初始化，请先执行部署包中的建表脚本。');
 if(message.includes('INKLEX_INVALID'))return Error('语料格式不正确，或单条内容过大，请检查后重试。');
 return Error('云端连接失败，内容尚未保存。请检查网络后重试。');
}
function snapshot(value:unknown):Snapshot{
 const row=value as Partial<Snapshot>|null;
 if(!row||typeof row.revision!=='string')throw Error('云端返回了无效的保存结果，请刷新后重试。');
 return {data:normalizeData(row.data),revision:row.revision};
}
export function createNotebookStore(client:SupabaseClient):NotebookStore{
 let base:Snapshot|null=null;
 return {
  async read(){
   const result=await client.rpc('inklex_read_notebook');if(result.error)throw friendlyError(result.error);
   base=snapshot(result.data);return base;
  },
  async save(next:Data,expectedRevision:string|null){
   if(!base||expectedRevision!==base.revision)throw Error('请先刷新云端语料，再保存修改。');
   const normalized=normalizeData(next),old=new Map(base.data.entries.map(e=>[e.id,JSON.stringify(e)])),ids=new Set(normalized.entries.map(e=>e.id));
   const updates=normalized.entries.filter(e=>old.get(e.id)!==JSON.stringify(e));
   const removed=base.data.entries.filter(e=>!ids.has(e.id)).map(e=>e.id);
   const result=await client.rpc('inklex_save_notebook',{p_expected_revision:expectedRevision,p_entry_updates:updates,p_removed_ids:removed,p_themes:normalized.themes,p_categories:normalized.categories||[]});
   if(result.error)throw friendlyError(result.error);
   if(typeof result.data?.revision!=='string')throw Error('云端未确认保存，请刷新后核对。');
   base={data:normalized,revision:result.data.revision};return {revision:base.revision};
  },
  async changeTrash(ids,action){
   const result=await client.rpc('inklex_change_trash',{p_ids:[...new Set(ids)],p_action:action});if(result.error)throw friendlyError(result.error);
   base=snapshot(result.data);return {...base,count:Number(result.data.count)||0};
  }
 };
}
