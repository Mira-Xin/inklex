export type Meaning={text:string;context:string;example:string;source:string;label:string};
export type Entry={id:string;type:string;en:string;meanings:Meaning[];category:string;themes:string[];note:string;source:string;ipa:string;collocations:string;englishExpression?:string;englishDefinitions?:string[];ipaSource?:string;status:number;links:string[];created:number;updated:number;deleted?:number};
export type Data={entries:Entry[];themes:string[];categories?:string[]};
export type Snapshot={data:Data;revision:string};
export interface NotebookStore{
 read():Promise<Snapshot>;
 save(data:Data,expectedRevision:string|null):Promise<{revision:string}>;
 changeTrash(ids:string[],action:'trash'|'restore'):Promise<Snapshot&{count:number}>;
}
const strings=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==='string').map(v=>v.trim()).filter(Boolean))]:[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const time=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:fallback;
export function normalizeData(value:unknown):Data{
 if(!value||typeof value!=='object'||!Array.isArray((value as Data).entries)||!Array.isArray((value as Data).themes))throw Error('语料格式不正确，请使用译笺导出的完整 JSON 备份。');
 const input=value as Data,ids=new Set<string>(),now=Date.now();
 const entries=input.entries.map(raw=>{
  if(!raw||typeof raw.id!=='string'||!raw.id||raw.id.length>200||ids.has(raw.id)||!['单词','词组','句子','汉语表达'].includes(raw.type)||typeof raw.en!=='string'||!raw.en.trim()||!Array.isArray(raw.meanings))throw Error('语料中有无效或重复的条目，请检查备份。');
  ids.add(raw.id);
  const entry:Entry={id:raw.id,type:raw.type,en:raw.en,meanings:raw.meanings.map(m=>({text:text(m?.text),context:text(m?.context),example:text(m?.example),source:text(m?.source),label:text(m?.label)})),category:text(raw.category)||'其他实词',themes:strings(raw.themes),note:text(raw.note),source:text(raw.source),ipa:text(raw.ipa),collocations:text(raw.collocations),englishExpression:text(raw.englishExpression),englishDefinitions:strings(raw.englishDefinitions),ipaSource:text(raw.ipaSource),status:[0,1,2].includes(raw.status)?raw.status:0,links:strings(raw.links),created:time(raw.created,now),updated:time(raw.updated,now)};
  if(raw.deleted)entry.deleted=time(raw.deleted,now);
  return entry;
 });
 return {entries,themes:strings(input.themes),categories:strings(input.categories)};
}
