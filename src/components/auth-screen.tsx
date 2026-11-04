import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {BookOpen,ArrowRight} from 'lucide-react';
export default function AuthScreen({client,recovery,onRecovered}:{client:SupabaseClient;recovery:boolean;onRecovered:()=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[reset,setReset]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(event:React.FormEvent){
  event.preventDefault();setError('');setNotice('');
  if(recovery&&(password.length<8||password!==confirm)){setError('新密码至少8位，两次输入需要一致。');return;}
  setBusy(true);
  try{
   if(recovery){const result=await client.auth.updateUser({password});if(result.error)throw result.error;setPassword('');setConfirm('');onRecovered();}
   else if(reset){const result=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});if(result.error)throw result.error;setNotice('如果此邮箱已注册，你将收到重设密码的邮件。请在同一浏览器打开邮件中的链接。');}
   else{const result=await client.auth.signInWithPassword({email:email.trim(),password});if(result.error)throw result.error;setPassword('');}
  }catch(err){const message=err instanceof Error?err.message:'';setError(message.includes('Invalid login credentials')?'邮箱或密码不正确，请检查后重试。':message.includes('Email not confirmed')?'请先确认邮箱，再登录。':message.includes('rate limit')?'请求较频繁，请稍后再试。':'暂时无法完成操作，请检查网络或稍后重试。');}
  finally{setBusy(false);}
 }
 return <main className="account-page"><section className="account-card"><div className="account-brand"><BookOpen size={30}/><span>译笺<small>THE LANGUAGE NOTEBOOK</small></span></div><p className="eyebrow">COLLECT WORDS. CULTIVATE EXPRESSION.</p><h1>{recovery?'设置新密码':reset?'找回你的手记':'打开你的手记'}</h1><p className="account-description">{recovery?'设置完成后，即可继续整理语料。':reset?'输入登录邮箱，我们会发送重设密码的邮件。':'把遇见的好表达，写进自己的语言里。'}</p><form onSubmit={submit}>
 {!recovery&&<label className="field">邮箱<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="你的登录邮箱" disabled={busy}/></label>}
 {(!reset||recovery)&&<label className="field">{recovery?'新密码':'密码'}<input type="password" autoComplete={recovery?'new-password':'current-password'} minLength={recovery?8:undefined} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={recovery?'至少8位':'输入密码'} disabled={busy}/></label>}
 {recovery&&<label className="field">再次输入新密码<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy}/></label>}
 {error&&<p className="account-error" role="alert">{error}</p>}{notice&&<p className="account-notice" role="status">{notice}</p>}
 <button className="primary account-submit" disabled={busy} type="submit">{busy?'正在处理…':recovery?'保存新密码':reset?'发送重设邮件':'登录'}<ArrowRight size={17}/></button>
 </form>{!recovery&&<button className="account-link" type="button" disabled={busy} onClick={()=>{setReset(!reset);setError('');setNotice('');setPassword('');}}>{reset?'返回登录':'忘记密码？'}</button>}<p className="account-footnote">你的语料随账号保存，可在电脑和手机上继续积累。</p></section></main>;
}
