export const SEGMENT_PRESETS = [30, 60, 120, 180] as const;
export type AudioSegment = {start:number;end:number};
export function normalizeCuts(cuts:number[],duration:number):number[]{
 if(!Number.isFinite(duration)||duration<=0)return [];
 const ordered=cuts.filter(n=>Number.isFinite(n)&&n>0&&n<duration).map(n=>Math.round(n*1000)/1000).filter(n=>n>0&&n<duration).sort((a,b)=>a-b);
 return ordered.filter((n,i)=>i===0||n-ordered[i-1]>=0.05);
}
export function presetCuts(duration:number,seconds:number):number[]{
 if(!Number.isFinite(duration)||!Number.isFinite(seconds)||duration<=0||seconds<=0)return [];
 const cuts:number[]=[];for(let n=seconds;n<duration;n+=seconds){cuts.push(n);if(cuts.length>=10000)break;}
 return normalizeCuts(cuts,duration);
}
export function audioSegments(duration:number,cuts:number[]):AudioSegment[]{
 if(!Number.isFinite(duration)||duration<=0)return [];
 const points=[0,...normalizeCuts(cuts,duration),duration];
 return points.slice(0,-1).map((start,i)=>({start,end:points[i+1]}));
}
export function formatAudioTime(seconds:number):string{
 const tenths=Math.round(Math.max(0,Number.isFinite(seconds)?seconds:0)*10),whole=Math.floor(tenths/10);
 return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}.${tenths%10}`;
}
export function parseAudioTime(value:string):number{
 const match=value.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
 if(!match)return NaN;
 const seconds=Number(match[2]);if(match[1]&&seconds>=60)return NaN;
 return Number(match[1]||0)*60+seconds;
}
export function encodeWav(buffer:AudioBuffer,start:number,end:number):Blob{
 const first=Math.max(0,Math.floor(start*buffer.sampleRate)),last=Math.min(buffer.length,Math.ceil(end*buffer.sampleRate));
 if(last<=first)throw Error('片段时长无效');
 const channels=buffer.numberOfChannels,frames=last-first,bytes=frames*channels*2;
 const result=new ArrayBuffer(44+bytes),view=new DataView(result);
 const write=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 write(0,'RIFF');view.setUint32(4,36+bytes,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes,true);
 const source=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let offset=44;
 for(let frame=first;frame<last;frame++)for(let channel=0;channel<channels;channel++){
  const sample=Math.max(-1,Math.min(1,source[channel][frame]));view.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);offset+=2;
 }
 return new Blob([result],{type:'audio/wav'});
}
