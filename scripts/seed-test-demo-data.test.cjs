const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildDemoData,seedAccount,DATASET}=require('./seed-test-demo-data.cjs');

function database({onboarded=true,seeded=false,existingIndex=-1}={}) {
  const writes=[];let committed=false;
  return {writes,get committed(){return committed;},
    collection:collection=>({doc:id=>({collection,id,get:async()=>({exists:collection==='users'||seeded,data:()=>({isOnboardingComplete:onboarded})})})}),
    getAll:async(...refs)=>refs.map((_,i)=>({exists:i===existingIndex})),
    batch:()=>({create:(ref,data)=>writes.push({ref,data}),commit:async()=>{committed=true;}}),
  };
}
test('all demo documents belong to one account, are labeled, and use stable IDs',()=>{
  const records=buildDemoData('tester',new Date(2026,10,15));
  assert.equal(records.length,54);
  assert.equal(new Set(records.map(r=>r.collection+'/'+r.id)).size,54);
  assert.ok(records.every(r=>r.data.userId==='tester'&&r.data.isDemo&&r.data.demoDataset===DATASET));
  assert.deepEqual(records.map(r=>r.id),buildDemoData('tester',new Date(2026,10,16)).map(r=>r.id));
  assert.ok(records.filter(r=>r.collection==='tracker-entries').every(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.data.date)&&r.data.mood<=10));
});
test('seeding is rejected before onboarding and without explicit test-account scope',async()=>{
  const db=database({onboarded:false});
  await assert.rejects(seedAccount({db,userId:'tester',confirmedTestAccount:true,apply:true}),/finish onboarding/);
  await assert.rejects(seedAccount({db,userId:'tester',apply:true}),/test-account scope/);
  assert.equal(db.writes.length,0);
});
test('dry run never writes and completed seeds are idempotent',async()=>{
  const db=database();
  assert.equal((await seedAccount({db,userId:'tester',confirmedTestAccount:true})).planned,54);
  assert.equal(db.writes.length,0);
  assert.equal((await seedAccount({db:database({seeded:true}),userId:'tester',confirmedTestAccount:true,apply:true})).status,'already-seeded');
});
test('apply only creates missing sample documents; never overwrites a profile or existing record',async()=>{
  const db=database({existingIndex:0});
  const result=await seedAccount({db,userId:'tester',confirmedTestAccount:true,apply:true});
  assert.equal(result.created,53);
  assert.equal(db.writes.length,54);
  assert.equal(db.writes.filter(w=>w.ref.collection==='users').length,0);
  assert.ok(!db.writes.some(w=>w.ref.id===buildDemoData('tester')[0].id));
  assert.ok(db.committed);
});
