const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
let valid=false;try{valid=new URL(url).protocol==='https:';}catch{}
let publicKey=key.startsWith('sb_publishable_');if(!publicKey){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}}
if(!valid||!publicKey||url.includes('YOUR-PROJECT')||key.includes('REPLACE_ME')){console.error('请在仓库 Settings → Secrets and variables → Actions → Variables 中填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY。仅使用公开密钥。');process.exit(1);}
console.log('Supabase public configuration is present.');
