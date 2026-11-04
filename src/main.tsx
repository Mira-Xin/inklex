import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {BookOpen} from 'lucide-react';
import {supabase} from './lib/supabase';
import {createNotebookStore} from './lib/notebook';
import AuthScreen from './components/auth-screen';
import Home from './Home';
import './style.css';
import './independent.css';

class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="account-page"><div className="account-card"><h1>页面未能加载</h1><p>请刷新页面重试。语料仍保存在云端。</p><button className="primary" onClick={()=>location.reload()}>刷新页面</button></div></main>:this.props.children;}
}
function App(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[recovery,setRecovery]=useState(false),[authError,setAuthError]=useState('');
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(!alive)return;setSession(next);setReady(true);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_OUT')setRecovery(false);});
  supabase.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setAuthError('登录状态暂时无法读取，请刷新页面重试。');setSession(data.session);setReady(true);});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const store=useMemo(()=>supabase&&session?createNotebookStore(supabase):null,[session?.user.id]);
 if(!supabase)return <main className="account-page"><section className="account-card"><BookOpen size={30}/><h1>译笺</h1><p>网站的上线配置尚未完成。</p><p className="muted">完成数据库连接后，即可使用自己的邮箱登录。</p></section></main>;
 if(!ready)return <main className="account-page"><section className="account-card"><p>正在打开你的手记…</p></section></main>;
 if(authError)return <main className="account-page"><section className="account-card"><p role="alert">{authError}</p><button className="primary" onClick={()=>location.reload()}>刷新页面</button></section></main>;
 if(!session||recovery)return <AuthScreen client={supabase} recovery={recovery} onRecovered={()=>setRecovery(false)}/>;
 return <Home key={session.user.id} store={store!} accountEmail={session.user.email||''} onSignOut={async()=>{const {error}=await supabase!.auth.signOut({scope:'local'});if(error)throw Error('退出失败，请稍后重试。');}}/>;
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
