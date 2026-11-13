const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/services/passwordRecovery.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function load(options={}) {
  const calls=[], exports={};
  const user={id:'reset-user'};
  vm.runInNewContext(compiled,{exports,URL,URLSearchParams,AbortSignal,require(name){
    if(name==='./supabaseConfig')return {isSupabaseConfigured: options.configured!==false,rawSupabaseUrl:'https://test.supabase.co',rawSupabaseAnonKey:'public'};
    assert.equal(name,'@supabase/supabase-js');
    return {createClient(url,key,config){calls.push(['client',config]);return {auth:{
      async getUser(token){calls.push(['verify',token]);if(options.offline)throw Error('offline');return {data:{user:options.absent?null:user},error:options.lookupError||null};},
      async setSession(tokens){calls.push(['session',tokens]);return {data:{user:options.mismatch?{id:'other'}:user},error:options.sessionError||null};},
      async updateUser(data){calls.push(['update',data]);return {data:{user},error:options.updateError||null};},
      async signOut(scope){calls.push(['signOut',scope]);if(options.signOutFails)throw Error('offline');return {error:null};},
    }}}};
  }});
  return {...exports,calls};
}
const href='https://keep.1203.fyi/auth/reset-password#type=recovery&access_token=reset-token&refresh_token=reset-refresh';
test('invalid, signup and expired links never establish a recovery session',async()=>{
  const helper=load();
  for(const url of ['https://keep.1203.fyi/auth/reset-password',href.replace('type=recovery','type=signup'),href.replace('refresh_token=reset-refresh','other=1')])assert.equal((await helper.beginPasswordRecovery(url)).status,'invalid');
  assert.equal((await helper.beginPasswordRecovery(href+'&error_code=otp_expired')).status,'expired');
  assert.equal(helper.calls.length,0);
});
test('server verifies identity before using an isolated, nonpersistent session',async()=>{
  const h=load(), r=await h.beginPasswordRecovery(href);assert.equal(r.status,'ready');
  assert.deepEqual(h.calls.map(c=>c[0]),['client','verify','session']);
  const auth=h.calls[0][1].auth;
  assert.equal(auth.persistSession,false);assert.equal(auth.autoRefreshToken,false);assert.equal(auth.detectSessionInUrl,false);
  assert.equal(auth.storageKey,'study-pet-password-recovery');
  assert.equal(await r.save('short'),'weak');assert.equal(h.calls.length,3);
  assert.equal(await r.save('new-password'),'success');assert.equal(await r.save('another-password'),'expired');
  assert.deepEqual(h.calls.map(c=>c[0]),['client','verify','session','update','signOut']);
});
test('verification failures, missing users and mismatched sessions cannot modify password',async()=>{
  for(const [options,status] of [[{lookupError:{status:401}},'expired'],[{lookupError:{status:503}},'failed'],[{lookupError:{name:'AuthRetryableFetchError'}},'failed'],[{absent:true},'invalid'],[{mismatch:true},'expired'],[{sessionError:{}},'expired'],[{offline:true},'failed'],[{configured:false},'unconfigured']]) {
    const h=load(options);assert.equal((await h.beginPasswordRecovery(href)).status,status);assert.ok(!h.calls.some(c=>c[0]==='update'));
  }
});
test('password update distinguishes weak passwords, expired sessions and network failure',async()=>{
  for(const [error,result] of [[{status:401},'expired'],[{status:403},'expired'],[{code:'weak_password'},'weak'],[{code:'same_password'},'weak'],[{status:503},'failed']]) {
    const r=await load({updateError:error}).beginPasswordRecovery(href);assert.equal(await r.save('new-password'),result);
  }
  const r=await load({signOutFails:true}).beginPasswordRecovery(href);assert.equal(await r.save('new-password'),'success');
});
test('old root recovery callbacks are detected before the ordinary auth client mounts',()=>{
  const h=load();assert.equal(h.isPasswordRecoveryCallback(href.replace('/auth/reset-password','/')),true);
  assert.equal(h.isPasswordRecoveryCallback('https://keep.1203.fyi/'),false);
});
