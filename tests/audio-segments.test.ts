import {test} from 'node:test';
import assert from 'node:assert/strict';
import {audioSegments,encodeWav,formatAudioTime,normalizeCuts,parseAudioTime,presetCuts} from '../src/lib/audio-segments';
import {aggregateActivity,normalizeWorkspace} from '../src/lib/workspace';
test('presets retain a short final segment and do not create empty edge segments',()=>{
 assert.deepEqual(presetCuts(125,30),[30,60,90,120]);assert.deepEqual(audioSegments(60,presetCuts(60,30)),[{start:0,end:30},{start:30,end:60}]);
 for(const preset of [30,60,120,180]){const segments=audioSegments(185.5,presetCuts(185.5,preset));assert.equal(segments[0].start,0);assert.equal(segments.at(-1)?.end,185.5);assert.equal(segments.reduce((n,s)=>n+s.end-s.start,0),185.5);}
 assert.deepEqual(presetCuts(Infinity,30),[]);assert.deepEqual(presetCuts(120,0),[]);
});
test('manual cuts are sorted, deduplicated and restricted to interior finite timestamps',()=>{assert.deepEqual(normalizeCuts([NaN,0,100,101,Infinity,-1,60,20,20.02,60],100),[20,60]);assert.deepEqual(audioSegments(100,[60,20]),[{start:0,end:20},{start:20,end:60},{start:60,end:100}]);assert.equal(parseAudioTime('1:30.5'),90.5);assert.equal(parseAudioTime('45.5'),45.5);assert.ok(Number.isNaN(parseAudioTime('1:90')));});
test('exported WAV uses only the selected samples, interleaves channels and clips PCM',async()=>{
 const fake={sampleRate:4,length:4,numberOfChannels:2,getChannelData:(channel:number)=>Float32Array.from(channel?[0.1,0.2,0.3,0.4]:[-2,-1,0.5,2])} as AudioBuffer;
 const view=new DataView(await encodeWav(fake,0.25,0.75).arrayBuffer());assert.equal(view.byteLength,52);assert.equal(view.getUint32(40,true),8);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),4);assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(46,true),6553);assert.equal(view.getInt16(48,true),16384);assert.equal(view.getInt16(50,true),9830);
});
test('activity totals are explicit events; material duration never counts as practice time',()=>{
 const value=normalizeWorkspace({materials:[{id:'m',title:'材料',durationSeconds:180,cuts:[],files:[]}],activity:[{id:'a',kind:'practice',date:'2026-11-25',count:2,minutes:5},{id:'b',kind:'input',date:'2026-11-25',count:3,minutes:0}]});assert.equal(aggregateActivity(value.activity,'practice','minutes').get('2026-11-25'),5);assert.equal(aggregateActivity(value.activity,'practice','count').get('2026-11-25'),2);assert.equal(aggregateActivity(value.activity,'output','count').size,0);assert.deepEqual(normalizeWorkspace(undefined),{materials:[],activity:[]});assert.throws(()=>normalizeWorkspace({...value,activity:[{...value.activity[0],date:'2026-02-30'}]}),/无效/);
});

test("timestamps do not drift due to floating point decimal truncation",()=>{assert.equal(formatAudioTime(60.3),"1:00.3");assert.equal(formatAudioTime(59.999),"1:00.0");});
