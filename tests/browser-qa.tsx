import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../src/Home';
import {normalizeData,type NotebookStore} from '../src/lib/types';
import type {MaterialFileStore} from '../src/lib/cloud-files';
import {saveMaterialFile} from '../src/lib/material-files';
import {encodeWav} from '../src/lib/audio-segments';
import '../src/style.css';
import '../src/independent.css';
const channel=new Float32Array(8000*185.5),fake={sampleRate:8000,length:channel.length,numberOfChannels:1,getChannelData:()=>channel} as unknown as AudioBuffer;
const wave=encodeWav(fake,0,185.5),sample=new File([wave],'练习音频.wav',{type:'audio/wav'});
await saveMaterialFile('qa@example.com','local-audio',sample);
const meaning=(text:string,example='')=>({text,example});
let data=normalizeData(JSON.parse(localStorage.getItem('inklex-qa-refinements-v1')||'null')||{
 entries:[{id:'one',type:'单词',en:'accountability',meanings:[meaning('问责')],category:'其他实词',themes:['政治'],created:1,updated:1},{id:'phrase',type:'词组',en:'bridge the gap',meanings:[meaning('弥合差距')],category:'其他实词',themes:['教育'],collocations:'bridge the digital divide',created:2,updated:2},{id:'sentence',type:'句子',en:'One child can change the world.',meanings:[meaning('一个孩子也能改变世界。','can 在此表达可能性。')],themes:['教育'],created:3,updated:3},{id:'chinese',type:'汉语表达',en:'把复杂的事讲清楚。',meanings:[],created:4,updated:4}],
 themes:['政治','教育'],workspace:{materials:[{id:'cloud-material',title:'云端音频练习',original:'A practice audio clip.',translation:'一段练习音频。',reflection:'复盘文字',source:'',links:['one'],durationSeconds:185.5,cuts:[60,120,180],files:[{id:'cloud-audio',name:sample.name,type:sample.type,size:sample.size,storagePath:'qa-owner/cloud-material/cloud-audio.wav'}],created:2,updated:2},{id:'local-material',title:'旧音频迁移测试',original:'Old audio stored in this browser.',translation:'旧版本机音频',reflection:'',source:'',links:[],durationSeconds:185.5,cuts:[60,120],files:[{id:'local-audio',name:sample.name,type:sample.type,size:sample.size}],created:1,updated:1}],activity:[]}});
let revision='0';
const store:NotebookStore={read:async()=>({data,revision}),save:async(next,expected)=>{if(expected!==revision)throw Error('revision conflict');data=normalizeData(next);revision=String(Number(revision)+1);localStorage.setItem('inklex-qa-refinements-v1',JSON.stringify(data));return {revision};},changeTrash:async(ids,action)=>{data={...data,entries:data.entries.map(entry=>ids.includes(entry.id)?{...entry,deleted:action==='trash'?Date.now():undefined}:entry)};revision=String(Number(revision)+1);return {data,revision,count:ids.length};}};
const fileStore:MaterialFileStore={upload:async(materialId,id,file,onProgress)=>{onProgress?.(100);return {id,name:file.name,type:file.type,size:file.size,storagePath:`qa-owner/${materialId}/${id}.wav`};},read:async(reference)=>new File([wave],reference.name,{type:reference.type})};
createRoot(document.getElementById('root')!).render(<><p style={{margin:0,padding:8,background:'#dceaf0',color:'#29495d',textAlign:'right',fontSize:14}}>交互验收预览 · 虚构材料 · 模拟云端附件</p><Home fileStore={fileStore} store={store} accountEmail="qa@example.com" onSignOut={async()=>{}}/></>);
