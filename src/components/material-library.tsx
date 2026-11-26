import {useEffect,useRef,useState} from 'react';
import {Download,Plus,Search,X} from 'lucide-react';
import AudioSegmenter from './audio-segmenter';
import {createActivity,emptyWorkspace,localDate,type Material,type MaterialFile,type Workspace} from '../lib/workspace';
import type {Entry} from '../lib/types';
import type {MaterialFileStore} from '../lib/cloud-files';
import {formatAudioTime,parseAudioTime} from '../lib/audio-segments';
import {readMaterialFile,saveMaterialFile} from '../lib/material-files';
import './material-library.css';

const blank=():Material=>({id:crypto.randomUUID(),title:'',original:'',translation:'',reflection:'',source:'',links:[],durationSeconds:0,cuts:[],files:[],created:Date.now(),updated:Date.now()});
type Props={workspace?:Workspace;entries:Entry[];account:string;fileStore?:MaterialFileStore;openMaterialId?:string|null;onChange:(workspace:Workspace)=>Promise<boolean>;onEditingChange:(editing:boolean)=>void};
export default function MaterialLibrary({workspace=emptyWorkspace(),entries,account,fileStore,openMaterialId,onChange,onEditingChange}:Props){
 const [q,setQ]=useState(''),[draft,setDraft]=useState<Material|null>(null),[selected,setSelected]=useState<string|null>(null);
 const [audio,setAudio]=useState<File|null>(null),[audioLoading,setAudioLoading]=useState(false),[audioReload,setAudioReload]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[transfer,setTransfer]=useState<{name:string;percent:number}|null>(null);
 const [clock,setClock]=useState<number|null>(null),[elapsed,setElapsed]=useState(0),[recordOpen,setRecordOpen]=useState(false),[recordDate,setRecordDate]=useState(localDate()),[recordMinutes,setRecordMinutes]=useState(''),[recordCount,setRecordCount]=useState('1'),[durationInput,setDurationInput]=useState('');
 const mounted=useRef(true),draftRef=useRef(draft);draftRef.current=draft;
 const active=workspace.materials.find(material=>material.id===selected),audioReference=active?.files.find(file=>file.type.startsWith('audio/'));
 const audioIdentity=audioReference?`${audioReference.id}:${audioReference.storagePath||'local'}`:'';
 const filtered=workspace.materials.filter(material=>[material.title,material.original,material.translation,material.reflection].some(text=>text.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.created-a.created);
 useEffect(()=>{if(openMaterialId)setSelected(openMaterialId);},[openMaterialId]);
 useEffect(()=>{onEditingChange(!!draft||clock!==null||recordOpen||pending);return()=>onEditingChange(false);},[!!draft,clock,recordOpen,pending,onEditingChange]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  setAudio(null);setError('');let alive=true;
  if(!audioReference){setAudioLoading(false);return;}
  const reference=audioReference;setAudioLoading(true);
  const load=reference.storagePath?(fileStore?fileStore.read(reference):Promise.reject(Error('当前页面无法连接云端附件，请刷新后重试。'))):readMaterialFile(account,reference.id);
  void load.then(file=>{if(alive)setAudio(file);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'音频读取失败，请重试。');}).finally(()=>{if(alive)setAudioLoading(false);});
  return()=>{alive=false;};
 },[selected,account,audioIdentity,fileStore,audioReload]);
 useEffect(()=>{if(clock===null)return;const tick=()=>setElapsed((Date.now()-clock)/1000);tick();const timer=window.setInterval(tick,250);return()=>clearInterval(timer);},[clock]);

 function edit(material:Material){setDraft(structuredClone(material));setDurationInput(material.durationSeconds?formatAudioTime(material.durationSeconds):'');setError('');}
 async function save(){
  if(!draft||pending)return;if(!draft.title.trim()){setError('请填写材料标题。');return;}
  const seconds=durationInput.trim()?parseAudioTime(durationInput):0;if(!Number.isFinite(seconds)||seconds<0){setError('材料时长请填写秒数或 分:秒。');return;}
  setPending(true);setError('');
  try{
   const next={...draft,durationSeconds:seconds,title:draft.title.trim(),updated:Date.now()},exists=workspace.materials.some(material=>material.id===next.id);
   if(await onChange({...workspace,materials:exists?workspace.materials.map(material=>material.id===next.id?next:material):[next,...workspace.materials]})){
    setDraft(null);setSelected(next.id);setNotice('材料已保存');
   }else setError('云端尚未确认保存，草稿已保留。请检查网络，并确认已执行素材库升级脚本。');
  }finally{setPending(false);}
 }
 async function upload(files:FileList|null){
  if(!files||!draft||pending)return;if(!fileStore){setError('当前无法上传云端附件，请刷新页面并重新登录后重试。');return;}
  const materialId=draft.id;setPending(true);setError('');
  try{
   for(const file of Array.from(files)){
    const id=crypto.randomUUID();setTransfer({name:file.name,percent:0});
    const reference=await fileStore.upload(materialId,id,file,percent=>{if(mounted.current)setTransfer({name:file.name,percent});});
    // Cache is optional. A browser quota failure must not turn a successful cloud upload into a failure.
    try{await saveMaterialFile(account,id,file);}catch{}
    if(mounted.current&&draftRef.current?.id===materialId)setDraft(current=>current?{...current,files:[...current.files,reference]}:null);
   }
  }catch(e){setError(e instanceof Error?e.message:'附件上传失败，请重试。');}
  finally{setPending(false);setTransfer(null);}
 }
 async function migrateAttachment(reference:MaterialFile,selectedFile?:File){
  if(!active||pending)return;if(!fileStore){setError('当前无法上传云端附件，请刷新并重新登录后重试。');return;}
  setPending(true);setError('');
  try{
   const file=selectedFile||await readMaterialFile(account,reference.id);
   if(!file){setError(`此附件未保存在当前浏览器。请回到原浏览器上传，或选择原文件“${reference.name}”。`);return;}
   if(file.name!==reference.name||reference.size&&file.size!==reference.size){setError(`请选择同名且大小一致的原文件“${reference.name}”，以保留原切割点。`);return;}
   const id=crypto.randomUUID();setTransfer({name:reference.name,percent:0});
   const uploaded=await fileStore.upload(active.id,id,file,percent=>{if(mounted.current)setTransfer({name:reference.name,percent});});
   const next={...active,files:active.files.map(item=>item.id===reference.id?uploaded:item),updated:Date.now()};
   if(await onChange({...workspace,materials:workspace.materials.map(material=>material.id===active.id?next:material)})){
    setNotice('附件已上传到云端，换浏览器或设备登录同一账号即可读取。');
   }else{
    // Preserve uploaded metadata for retry instead of uploading the same file again.
    edit(next);setError('附件已上传，但材料信息尚未保存。请保留编辑窗口并点击“保存材料”重试。');
   }
  }catch(e){setError(e instanceof Error?e.message:'附件同步失败，请重试。');}
  finally{setPending(false);setTransfer(null);}
 }
 async function downloadFile(reference:MaterialFile){
  setError('');
  try{
   const file=reference.storagePath?(fileStore?await fileStore.read(reference):null):await readMaterialFile(account,reference.id);
   if(!file){setError('此附件尚未上传云端。请在原浏览器点击“上传到云端”。');return;}
   const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=reference.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){setError(e instanceof Error?e.message:'附件读取失败，请重试。');}
 }
 async function record(){
  const minutes=Number(recordMinutes),count=Number(recordCount);if(!recordDate||!Number.isFinite(minutes)||minutes<=0||!Number.isInteger(count)||count<1){setError('请填写有效日期、正数练习分钟和完成条数。');return;}
  setPending(true);
  try{const event=createActivity('practice',count,minutes,active?.id,recordDate);if(await onChange({...workspace,activity:[...workspace.activity,event]})){
   setRecordOpen(false);setElapsed(0);setRecordMinutes('');setNotice('已记录练习');
  }else setError('练习记录尚未保存，请检查网络或页面上的云端提示后重试。');}
  catch(e){setError(e instanceof Error?e.message:'记录失败');}finally{setPending(false);}
 }
 const progress=transfer&&<p className="upload-progress" role="status">正在上传 {transfer.name} · {transfer.percent}%<progress value={transfer.percent} max={100}/></p>;
 return <section className="material-library">
  <div className="page-heading"><div><h1>素材库</h1><p>收藏材料，分段练习，留下一次复盘。</p></div><button className="primary" disabled={pending||clock!==null} onClick={()=>edit(blank())}><Plus size={18}/>添加材料</button></div>
  <div className="search"><Search size={19}/><input aria-label="搜索材料" placeholder="搜索材料标题、原文或复盘" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {notice&&<p role="status" className="account-notice">{notice}</p>}{error&&!draft&&<p role="alert" className="editor-save-error">{error}</p>}{!draft&&progress}
  <div className="material-grid"><nav className="material-list" aria-label="材料列表">
   {filtered.map(material=><button key={material.id} aria-pressed={selected===material.id} className={selected===material.id?'selected':''} disabled={pending||clock!==null} onClick={()=>{setSelected(material.id);setRecordOpen(false);setNotice('');}}><strong>{material.title}</strong><small>{material.durationSeconds?`材料时长 ${formatAudioTime(material.durationSeconds)} · `:''}{material.files.length} 个附件</small></button>)}
   {!filtered.length&&<p className="muted">{q?'没有匹配的材料。':'添加第一份文章或音频，开始整理。'}</p>}
  </nav><article className="material-content">{active?<>
   <div className="label-row"><h2>{active.title}</h2><button disabled={pending||clock!==null} onClick={()=>edit(active)}>编辑材料</button></div>
   <p className="muted">材料本身时长：{active.durationSeconds?formatAudioTime(active.durationSeconds):'未填写'}</p>
   {active.source&&(/^(https?:)\/\//i.test(active.source)?<a href={active.source} target="_blank" rel="noreferrer">查看来源</a>:<p>{active.source}</p>)}
   <div className="practice-actions">{clock===null?<button disabled={pending} className="primary" onClick={()=>{setClock(Date.now());setElapsed(0);setError('');}}>开始练习计时</button>:<><span role="timer">练习耗时 {formatAudioTime(elapsed)}</span><button className="primary" onClick={()=>{const seconds=(Date.now()-clock)/1000;setClock(null);setElapsed(seconds);setRecordDate(localDate());setRecordMinutes(String(Math.max(0.1,Math.round(seconds/6)/10)));setRecordCount('1');setRecordOpen(true);}}>结束并记录</button></>}
    <button disabled={pending||clock!==null} onClick={()=>{setRecordOpen(true);setRecordDate(localDate());setRecordMinutes('');setRecordCount('1');setError('');}}>手动补记练习</button>
   </div>
   {recordOpen&&<div className="practice-form"><label className="field">练习日期<input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)}/></label><label className="field">练习耗时（分钟）<input type="number" min="0.1" step="0.1" value={recordMinutes} onChange={e=>setRecordMinutes(e.target.value)}/></label><label className="field">完成条数<input type="number" min="1" step="1" value={recordCount} onChange={e=>setRecordCount(e.target.value)}/></label><button className="primary" disabled={pending} onClick={record}>保存练习记录</button><button disabled={pending} onClick={()=>setRecordOpen(false)}>取消</button></div>}
   {!!active.files.length&&<section className="material-attachments"><h3>附件</h3>
    {active.files.map(file=><div className="material-file-row" key={file.id}><button disabled={pending} onClick={()=>downloadFile(file)}><Download size={15}/>{file.name}</button><small>{file.storagePath?'已存云端':'旧版本机附件'}</small>{!file.storagePath&&<div className="legacy-file-actions"><button disabled={pending} onClick={()=>migrateAttachment(file)}>上传到云端</button><label className="file-button">选择原文件并上传<input type="file" disabled={pending} accept={file.type.startsWith('audio/')?'audio/*,.m4a,.mp3,.wav':undefined} onChange={e=>{const selectedFile=e.target.files?.[0];if(selectedFile)void migrateAttachment(file,selectedFile);e.target.value='';}}/></label></div>}</div>)}
    <p className="muted">已存云端的附件可在同一账号的其他浏览器和设备直接读取。旧版本机附件需在原浏览器上传一次。</p>
   </section>}
   {audioLoading&&<p role="status" className="muted">正在读取{audioReference?.storagePath?'云端':''}音频…</p>}
   {audio&&<AudioSegmenter disabled={pending} key={active.id+audioIdentity} file={audio} cuts={active.cuts} onChange={cuts=>{if(!pending){setPending(true);void onChange({...workspace,materials:workspace.materials.map(material=>material.id===active.id?{...material,cuts,updated:Date.now()}:material)}).then(saved=>{if(!saved)setError('切割点尚未保存，请检查页面上的云端提示后重试。');}).finally(()=>setPending(false));}}}/>}
   {!audio&&!audioLoading&&audioReference?.storagePath&&<button className="outline" disabled={pending} onClick={()=>setAudioReload(n=>n+1)}>重新读取云端音频</button>}
   {(['original','translation','reflection'] as const).map((field,index)=>active[field]&&<section className="material-text" key={field}><h3>{['原文','参考译文','自己的译文 / 复盘'][index]}</h3><p className={field==='original'?'english':''}>{active[field]}</p></section>)}
   {!!active.links.length&&<section><h3>关联语料</h3>{entries.filter(entry=>active.links.includes(entry.id)&&!entry.deleted).map(entry=><p key={entry.id}><strong>{entry.en}</strong>　{entry.meanings[0]?.text}</p>)}</section>}
   <details className="practice-history"><summary>此材料的练习记录</summary>{workspace.activity.filter(event=>event.kind==='practice'&&event.materialId===active.id).sort((a,b)=>b.date.localeCompare(a.date)).map(event=><div key={event.id}>{event.date} · {event.count} 条 · {Number(event.minutes.toFixed(1))} 分钟 <button disabled={pending} onClick={async()=>{if(confirm('删除这条练习记录？热力图也会同步更新。')){setPending(true);try{await onChange({...workspace,activity:workspace.activity.filter(item=>item.id!==event.id)});}finally{setPending(false);}}}}>删除</button></div>)}</details>
  </>:<p className="muted">选择一份材料，查看原文、译文与练习记录。</p>}</article></div>
  {draft&&<div className="overlay"><section className="modal wide" role="dialog" aria-modal="true" aria-label="编辑材料"><div className="modal-head"><h2>{workspace.materials.some(material=>material.id===draft.id)?'编辑材料':'添加材料'}</h2><button disabled={pending} aria-label="关闭材料编辑" onClick={()=>{if(confirm('关闭编辑？尚未保存的文字将丢弃。'))setDraft(null);}}><X/></button></div><div className="modal-body">
   <label className="field">标题 *<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <div className="two-col"><label className="field">材料本身时长<input aria-label="材料本身时长" value={durationInput} placeholder="秒数或 分:秒，如 3:20" onChange={e=>setDurationInput(e.target.value)}/><small>音频／文章对应材料的时长，练习耗时另行记录。</small></label><label className="field">来源链接<input value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}/></label></div>
   {(['original','translation','reflection'] as const).map((field,index)=><label className="field" key={field}>{['原文','参考译文','自己的译文 / 复盘'][index]}<textarea rows={5} className={field==='original'?'english':''} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}
   <label className="file-button">上传文件 / 音频到云端<input type="file" multiple disabled={pending} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label>
   <p className="muted">每个附件不超过50 MB。上传完成并保存材料后，其他浏览器和设备登录同一账号即可使用。</p>{progress}
   {draft.files.map(file=><div className="attachment-edit" key={file.id}><span>{file.name} <small>{file.storagePath?'已上传云端':'旧版本机附件'}</small></span><button disabled={pending} onClick={()=>setDraft({...draft,files:draft.files.filter(item=>item.id!==file.id)})}>移除</button></div>)}
   <fieldset className="field"><legend>关联语料</legend><div className="link-results">{entries.filter(entry=>!entry.deleted).map(entry=><label className="link-option" key={entry.id}><input type="checkbox" checked={draft.links.includes(entry.id)} onChange={e=>setDraft({...draft,links:e.target.checked?[...draft.links,entry.id]:draft.links.filter(id=>id!==entry.id)})}/><span><strong>{entry.en}</strong><em>{entry.meanings[0]?.text}</em></span></label>)}</div></fieldset>
   {error&&<p role="alert" className="editor-save-error">{error}</p>}
  </div><div className="modal-foot"><button className="outline" disabled={pending} onClick={()=>setDraft(null)}>取消</button><button className="primary" disabled={pending} onClick={save}>{pending?'处理中…':'保存材料'}</button></div></section></div>}
 </section>;
}
