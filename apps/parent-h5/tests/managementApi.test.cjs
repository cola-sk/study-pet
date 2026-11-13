const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const reply=(body,status=200)=>({body,status}),failure=e=>reply({error:e.message},e.status||503);
function compile(file,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require,Date});return exports;}
const management=compile('server/management.ts',()=>({ApiError}));
const id='11111111-1111-4111-8111-111111111111',child='22222222-2222-4222-8222-222222222222',version='2026-11-13T00:00:00.123456Z';
function setup(file,options={}){
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{success:true,credits:12},error:options.error||null};},from(table){calls.push({table});const chain={update(value){calls.push({update:value});return chain;},eq(key,value){calls.push({eq:[key,value]});return chain;},select(){return chain;},async maybeSingle(){return {data:options.missing?null:{id:child},error:options.error||null};}};return chain;}};
 const api={ApiError,reply,failure,parentContext:async()=>({db,familyId:'trusted-family'}),deviceContext:async()=>({db,device:{id}})};
 return {calls,route:compile(file,name=>name.endsWith('/api')?api:name.endsWith('/management')?management:name.endsWith('/shop')?{uuid:management.uuidPattern}:{})};
}
const req=body=>({json:async()=>body}),params={params:{id}};
test('rename/unlink use authenticated family and full version, stale writes return 409',async()=>{
 for(const method of ['PATCH','DELETE']){
 const h=setup('app/api/v1/devices/[id]/route.ts');assert.equal((await h.route[method](req({alias:'  device  ',expectedVersion:version,familyId:'attacker'}),params)).status,200);
 assert.equal(h.calls[0].args.p_family_id,'trusted-family');assert.equal(h.calls[0].args.p_expected_version,version);assert.equal(h.calls[0].args.p_action,method==='PATCH'?'rename':'unlink');}
 const h=setup('app/api/v1/devices/[id]/route.ts',{error:{code:'40001'}});assert.equal((await h.route.DELETE(req({expectedVersion:version}),params)).status,409);
});
test('invalid names and missing version cannot invoke management RPC',async()=>{
 for(const body of [{alias:'',expectedVersion:version},{alias:'x\n',expectedVersion:version},{alias:'valid'},{alias:'a'.repeat(51),expectedVersion:version}]){
 const h=setup('app/api/v1/devices/[id]/route.ts');assert.equal((await h.route.PATCH(req(body),params)).status,400);assert.equal(h.calls.length,0);}
});
test('reassignment uses versioned management; initial pairing remains compatible',async()=>{
 for(const scoped of [true,false]){
 const h=setup('app/api/v1/devices/[id]/child/route.ts');assert.equal((await h.route.PATCH(req({childId:child,...(scoped?{expectedVersion:version}:{})}),params)).status,200);
 assert.equal(h.calls[0].name,scoped?'manage_family_device':'assign_device_child');assert.equal(h.calls[0].args.p_family_id,'trusted-family');}
});
test('child name updates filter family and cannot overwrite coins',async()=>{
 const h=setup('app/api/v1/family/children/[id]/route.ts');assert.equal((await h.route.PATCH(req({nickname:' baby ',petName:' dog ',coins_balance:1000}),params)).status,200);
 const update=h.calls.find(c=>c.update).update;assert.equal(update.nickname,'baby');assert.equal(update.pet_name,'dog');assert.ok(!('coins_balance' in update));assert.ok(h.calls.some(c=>c.eq?.[0]==='family_id'&&c.eq[1]==='trusted-family'));
 const missing=setup('app/api/v1/family/children/[id]/route.ts',{missing:true});assert.equal((await missing.route.PATCH(req({nickname:'baby',petName:'dog'}),params)).status,404);
});
test('purchase forwards binding to scoped RPC; legacy confirmation uses NULL',async()=>{
 for(const scoped of [true,false]){
 const h=setup('app/api/v1/device/shop/purchase/route.ts');assert.equal((await h.route.POST(req({itemId:child,requestId:id,expectedPrice:1,expectedVersion:version,...(scoped?{expectedBindingVersion:id}:{})}))).status,200);assert.equal(h.calls[0].name,'purchase_family_shop_item_scoped');assert.equal(h.calls[0].args.p_expected_binding,scoped?id:null);}
 const h=setup('app/api/v1/device/shop/purchase/route.ts',{error:{code:'40001'}});const r=await h.route.POST(req({itemId:child,requestId:id,expectedPrice:1,expectedVersion:version,expectedBindingVersion:id}));assert.equal(r.status,409);assert.equal(r.body.code,'item_changed');
});
