export type MaterialFile={id:string;name:string;type:string;size:number};
export type Material={id:string;title:string;original:string;translation:string;reflection:string;source:string;links:string[];durationSeconds:number;cuts:number[];files:MaterialFile[];created:number;updated:number};
export type Activity={id:string;date:string;kind:'practice'|'input'|'output';count:number;minutes:number;materialId?:string};
export type Workspace={materials:Material[];activity:Activity[]};
export const emptyWorkspace=():Workspace=>({materials:[],activity:[]});
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function createActivity(kind:Activity['kind'],count:number,minutes=0,materialId?:string,date=localDate()):Activity{return {id:crypto.randomUUID(),date,kind,count,minutes,...(materialId?{materialId}:{})};}
const text=(v:unknown)=>typeof v==='string'?v:'';
const nonnegative=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
const strings=(v:unknown)=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string'):[];
export function normalizeWorkspace(value:unknown):Workspace{
 if(value===undefined||value===null)return emptyWorkspace();
 if(typeof value!=='object'||!Array.isArray((value as Workspace).materials)||!Array.isArray((value as Workspace).activity))throw Error('素材库或练习记录格式无效。');
 const input=value as Workspace,ids=new Set<string>();
 const materials=input.materials.map(m=>{
  if(!m||typeof m.id!=='string'||!m.id||ids.has(m.id)||typeof m.title!=='string'||!m.title.trim())throw Error('素材库中有无效或重复的材料。');ids.add(m.id);
  return {id:m.id,title:m.title,original:text(m.original),translation:text(m.translation),reflection:text(m.reflection),source:text(m.source),links:strings(m.links),durationSeconds:nonnegative(m.durationSeconds),cuts:Array.isArray(m.cuts)?m.cuts.filter(n=>typeof n==='number'&&Number.isFinite(n)&&n>0).sort((a,b)=>a-b):[],files:Array.isArray(m.files)?m.files.filter(f=>f&&typeof f.id==='string'&&typeof f.name==='string').map(f=>({id:f.id,name:f.name,type:text(f.type),size:nonnegative(f.size)})):[],created:nonnegative(m.created),updated:nonnegative(m.updated)};
 });
 const eventIds=new Set<string>();
 const activity=input.activity.map(a=>{if(!a||typeof a.id!=='string'||!a.id||eventIds.has(a.id)||!['practice','input','output'].includes(a.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||localDate(new Date(a.date+'T12:00:00'))!==a.date)throw Error('活动记录格式无效。');eventIds.add(a.id);return {id:a.id,date:a.date,kind:a.kind,count:nonnegative(a.count),minutes:nonnegative(a.minutes),...(a.materialId?{materialId:text(a.materialId)}:{})};});
 return {materials,activity};
}
export function aggregateActivity(activity:Activity[],kind:Activity['kind'],metric:'count'|'minutes'){
 const days=new Map<string,number>();for(const item of activity)if(item.kind===kind)days.set(item.date,(days.get(item.date)||0)+item[metric]);return days;
}
