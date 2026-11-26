import type {SupabaseClient} from '@supabase/supabase-js';
import type {MaterialFile} from './workspace';
export const MATERIAL_BUCKET='inklex-material-files';
export const MAX_MATERIAL_FILE_BYTES=50*1024*1024;
export interface MaterialFileStore{
 upload(materialId:string,id:string,file:File,onProgress?:(percent:number)=>void):Promise<MaterialFile>;
 read(reference:MaterialFile):Promise<File>;
}
export function materialFileType(file:{name:string;type:string}):string{
 if(file.type&&file.type!=='application/octet-stream')return file.type;
 const ext=file.name.split('.').pop()?.toLowerCase();
 return ({mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',wav:'audio/wav',ogg:'audio/ogg',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm'} as Record<string,string>)[ext||'']||file.type||'application/octet-stream';
}
export function materialStoragePath(ownerId:string,materialId:string,id:string,fileName:string){
 if(![ownerId,materialId,id].every(part=>/^[a-zA-Z0-9_-]{1,200}$/.test(part)))throw Error('附件标识无效。');
 const extension=fileName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1].toLowerCase();
 return `${ownerId}/${materialId}/${id}${extension?'.'+extension:''}`;
}
function fileError(error:unknown):Error{
 const item=error as {message?:string;status?:number|string;statusCode?:number|string;originalResponse?:{getStatus():number}};
 const status=Number(item?.statusCode||item?.status||item?.originalResponse?.getStatus?.()),message=item?.message||'';
 if(status===401)return Error('登录状态已失效，请重新登录后重试附件上传。');
 if(status===413||/maximum allowed size|too large|file size/i.test(message))return Error('文件超过上传限制，本版本支持每个附件不超过50 MB。');
 if(/bucket not found|row.level|policy|permission/i.test(message)||status===403)return Error('云端附件权限尚未配置，请在 Supabase SQL Editor 执行 supabase/cloud-files.sql 后重试。');
 if(status===404||/not found/i.test(message))return Error('云端附件不存在或无法读取，请在原浏览器检查文件并重新上传。');
 return Error('云端附件传输失败，请检查网络后重试。');
}
export function createMaterialFileStore(client:SupabaseClient,ownerId:string,projectUrl:string):MaterialFileStore{
 return {
  async upload(materialId,id,file,onProgress){
   if(file.size>MAX_MATERIAL_FILE_BYTES)throw Error('文件超过上传限制，本版本支持每个附件不超过50 MB。');
   if(!file.size)throw Error('不能上传空文件。');
   const storagePath=materialStoragePath(ownerId,materialId,id,file.name),type=materialFileType(file);
   onProgress?.(0);
   if(file.size<=6*1024*1024){
    const result=await client.storage.from(MATERIAL_BUCKET).upload(storagePath,file,{contentType:type,upsert:false,cacheControl:'3600'});
    if(result.error)throw fileError(result.error);
   }else{
    const {data:{session},error}=await client.auth.getSession();if(error||!session)throw Error('登录状态已失效，请重新登录后重试附件上传。');
    const tus=await import('tus-js-client');
    const project=new URL(projectUrl);if(project.hostname.endsWith('.supabase.co'))project.hostname=project.hostname.replace('.supabase.co','.storage.supabase.co');
    const endpoint=project.origin+'/storage/v1/upload/resumable';
    await new Promise<void>((resolve,reject)=>{
     const transfer=new tus.Upload(file,{endpoint,headers:{authorization:`Bearer ${session.access_token}`,'x-upsert':'false'},chunkSize:6*1024*1024,uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,retryDelays:[0,1000,3000,5000],metadata:{bucketName:MATERIAL_BUCKET,objectName:storagePath,contentType:type,cacheControl:'3600'},fingerprint:async()=>`inklex:${storagePath}:${file.size}:${file.lastModified}`,onProgress:(sent,total)=>onProgress?.(total?Math.min(99,Math.round(sent/total*100)):0),onError:e=>reject(fileError(e)),onSuccess:()=>resolve()});
     void transfer.findPreviousUploads().then(previous=>{if(previous.length)transfer.resumeFromPreviousUpload(previous[0]);transfer.start();}).catch(e=>reject(fileError(e)));
    });
   }
   onProgress?.(100);return {id,name:file.name,type,size:file.size,storagePath};
  },
  async read(reference){
   if(!reference.storagePath||!reference.storagePath.startsWith(ownerId+'/')||reference.storagePath.split('/').some(part=>part==='..'||part==='.'||!part))throw Error('附件不属于当前账号，无法读取。');
   const {data,error}=await client.storage.from(MATERIAL_BUCKET).download(reference.storagePath);if(error||!data)throw fileError(error);
   return new File([data],reference.name,{type:reference.type||data.type});
  }
 };
}
