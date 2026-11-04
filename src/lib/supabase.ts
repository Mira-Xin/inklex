import {createClient} from '@supabase/supabase-js';
const projectUrl=import.meta.env.VITE_SUPABASE_URL?.trim()||'';
const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()||'';
function safePublicKey(key:string){
 if(key.startsWith('sb_publishable_'))return true;
 try{return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}
}
function validConfiguration(){try{const url=new URL(projectUrl);return url.protocol==='https:'&&safePublicKey(publicKey);}catch{return false;}}
export const supabase=validConfiguration()?createClient(projectUrl,publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
