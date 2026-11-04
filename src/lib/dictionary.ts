export const ECDICT_VERSION='ab22ad36302c';
export const ECDICT_SOURCE='https://github.com/skywind3000/ECDICT';
export type DictionaryEntry={word:string,phonetic:string,definitions:string[],translations:string[]};
type RawEntry={phonetic?:string,definition?:string,translation?:string};
export function normalizeWord(word:string){return word.trim().toLowerCase().replace(/\s+/g,' ');}
export function dictionaryBucket(word:string){let hash=0;for(const b of new TextEncoder().encode(normalizeWord(word)))hash=(Math.imul(hash,31)+b)>>>0;return (hash%512).toString(16).padStart(3,'0');}
export function dictionaryLines(text=''){return [...new Set(text.replace(/\\+n/g,'\n').split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];}
export function parseDictionaryEntry(word:string,row:RawEntry):DictionaryEntry{
 const ipa=row.phonetic?.trim().replace(/^[/\[\s]+|[/\]\s]+$/g,'')||'';
 return {word,phonetic:ipa?'/'+ipa+'/':'',definitions:dictionaryLines(row.definition),translations:dictionaryLines(row.translation)};
}
const shardCache=new Map<string,Record<string,RawEntry>>();
export async function lookupEcdict(input:string,signal?:AbortSignal):Promise<DictionaryEntry|null>{
 const word=normalizeWord(input);if(!word||word.length>160)return null;
 const bucket=dictionaryBucket(word);let shard=shardCache.get(bucket);
 if(!shard){const response=await fetch(`ecdict/${ECDICT_VERSION}/${bucket}.json`,{signal});if(!response.ok)throw new Error('词库暂时无法加载，请稍后重试');shard=await response.json() as Record<string,RawEntry>;if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(shardCache.size>=12)shardCache.delete(shardCache.keys().next().value!);shardCache.set(bucket,shard);}
 return Object.prototype.hasOwnProperty.call(shard,word)?parseDictionaryEntry(word,shard[word]):null;
}
export function mergeDictionarySelections<T extends {text:string}>(existing:T[],incoming:T[],key:(value:T)=>string){const seen=new Set(existing.map(key));return [...existing,...incoming.filter(value=>{const id=key(value);if(seen.has(id))return false;seen.add(id);return true;})];}
