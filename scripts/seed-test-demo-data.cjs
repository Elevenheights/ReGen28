// Operator-only sample data. No credentials, passwords, access grants or account resets.
// Dry run: node scripts/seed-test-demo-data.cjs --uid UID --confirmed-test-account
// Apply: add --apply. Only accounts that have already completed onboarding are accepted.
const path = require('node:path');
const { createRequire } = require('node:module');
const DATASET = 'indigo-muse-demo-v1';

function buildDemoData(userId, now = new Date()) {
  if (!userId || !/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Invalid test account UID.');
  const day = (offset, hour = 9) => { const value = new Date(now); value.setDate(value.getDate() - offset); value.setHours(hour, 0, 0, 0); return value; };
  const dateKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  const prefix = `demo_${DATASET}_${userId}`;
  const records = [];
  const add = (collection, suffix, data) => {
    const id = `${prefix}_${suffix}`;
    records.push({collection, id, data:{...data,id,userId,isDemo:true,demoDataset:DATASET,updatedAt:now}});
    return id;
  };
  const definitions = [
    { key:'light', name:'Morning light', category:'mind', icon:'fa-sun', color:'#9576bd', target:10, offsets:[0,1,2,3,4,5,6,7,8,9,10,11] },
    { key:'strength', name:'Strength', category:'body', icon:'fa-dumbbell', color:'#75ac92', target:20, offsets:[1,2,3,5,6,7,8,9,10,11] },
    { key:'winddown', name:'Wind-down', category:'soul', icon:'fa-moon', color:'#ad91c7', target:15, offsets:[1,2,3,4,5,6,7,8,9,10,11] },
  ];
  const trackerIds = definitions.map(t => add('trackers',t.key,{
    name:`[Sample] ${t.name}`,category:t.category,icon:t.icon,color:t.color,target:t.target,unit:'minutes',type:'duration',frequency:'daily',
    durationDays:28,startDate:day(11),endDate:day(-17),isActive:true,isCompleted:false,isOngoing:false,isDefault:false,timesExtended:0,
    config:{loggingFields:{value:true,mood:true,energy:true,notes:true,tags:true,photos:true}},createdAt:day(11),
  }));
  definitions.forEach((tracker,index) => tracker.offsets.forEach(offset => add('tracker-entries',`${tracker.key}_${offset}`,{
    trackerId:trackerIds[index],date:dateKey(day(offset)),value:tracker.target,mood:[8,7,9,8][offset%4],energy:[4,3,4][offset%3],
    notes:'Sample data · an example entry for beta testing. This is not a real activity record.',tags:['sample'],createdAt:day(offset),
  })));
  const reflections = [
    ['Finding my rhythm','A quiet morning walk helped me slow down and make a little space for myself.'],
    ['Progress over perfection','I showed up for a short session today. Keeping it manageable helped me stay consistent.'],
    ['A little more energy','Moving my body and taking a break outside were the highlights of my day.'],
    ['Three things I appreciate','Fresh air, time to reflect, and a meaningful conversation.'],
  ];
  [0,1,2,3,5,7,9,11].forEach((offset,i) => {
    const [title,content]=reflections[i%reflections.length];
    add('journal-entries',`journal_${offset}`,{title:`[Sample] ${title}`,content:`Sample reflection · ${content}`,date:dateKey(day(offset)),mood:[8,7,9,8][i%4],energy:4,category:'reflection',tags:['sample','mindfulness'],wordCount:content.split(/\s+/).length,readingTime:1,createdAt:day(offset,10)});
  });
  ['Build a calmer morning','Move with more energy','Make room to recharge'].forEach((title,i)=>add('goals',`goal_${i}`,{
    title:`[Sample] ${title}`,description:'Sample goal for exploring progress and milestones.',category:definitions[i].category,status:'active',priority:'medium',progress:[43,36,50][i],
    linkedTrackerIds:[trackerIds[i]],startDate:day(11),targetDate:day(-17),createdAt:day(11),
    milestones:[{id:'week-one',title:'Complete the first week',isCompleted:true,completedAt:day(5),order:0},{id:'week-two',title:'Keep going for two weeks',isCompleted:false,order:1}],
  }));
  const baseFeed={visibility:'private',tags:['sample'],author:{name:'Sample progress'},likesCount:0,commentsCount:0};
  add('feed-items','progress',{...baseFeed,type:'activity',title:'[Sample] Morning light',body:'Sample activity · completed',source:{kind:'manual',trackerId:trackerIds[0]},metrics:[{label:'Mood',value:8,unit:'of 10'}],media:{status:'ready',images:[{url:'assets/images/indigo-muse/morning-light.webp',kind:'card'}]},createdAt:day(0,8)});
  add('feed-items','insight',{...baseFeed,type:'insight',title:'[Sample] Your consistency',body:'Sample coaching · Seven morning sessions this week. Keep the next one manageable.',source:{kind:'manual',trackerId:trackerIds[0],trackerName:'[Sample] Morning light'},metadata:{dataPoint:'7 sample sessions this week',reason:'This is a fictional coaching example for testing the app. No AI request was made for this sample.'},createdAt:day(0,10)});
  add('feed-items','journal',{...baseFeed,type:'journal',title:'[Sample] Finding my rhythm',body:'Sample reflection · A little more space to breathe today.',source:{kind:'manual'},createdAt:day(1,18)});
  add('feed-items','milestone',{...baseFeed,type:'milestone',title:'[Sample] A week of showing up',body:'Sample milestone · Seven days of consistent practice.',source:{kind:'manual'},createdAt:day(2,12)});
  [
    ['tracker_entry','Morning light complete','An example ten-minute session'],
    ['journal_entry','Finding my rhythm','An example reflection'],
    ['goal_created','Build a calmer morning','An example goal'],
  ].forEach(([type,title,description],i)=>add('activities',`activity_${i}`,{type,title:`[Sample] ${title}`,description:`Sample data · ${description}`,category:definitions[i].category,relatedId:trackerIds[i],relatedType:'tracker',activityDate:day(i),createdAt:day(i)}));
  return records;
}

async function seedAccount({db,userId,confirmedTestAccount,apply=false,now=new Date()}) {
  if (!confirmedTestAccount) throw new Error('Explicit test-account scope is required.');
  const profile = await db.collection('users').doc(userId).get();
  if (!profile.exists || profile.data().isOnboardingComplete !== true) throw new Error('This test account must finish onboarding first.');
  const marker = db.collection('test-data-seeds').doc(`${DATASET}_${userId}`);
  if ((await marker.get()).exists) return {status:'already-seeded',created:0};
  const records=buildDemoData(userId,now);
  const refs=records.map(r=>db.collection(r.collection).doc(r.id));
  const existing=await db.getAll(...refs);
  const missing=records.filter((_,i)=>!existing[i].exists);
  const summary=missing.reduce((counts,r)=>{counts[r.collection]=(counts[r.collection]||0)+1;return counts;},{});
  if (!apply) return {status:'dry-run',created:0,planned:missing.length,collections:summary};
  const batch=db.batch();
  missing.forEach(record=>batch.create(db.collection(record.collection).doc(record.id),record.data));
  batch.create(marker,{userId,dataset:DATASET,createdAt:now,records:records.map(r=>`${r.collection}/${r.id}`),existingDataPreserved:true});
  await batch.commit();
  return {status:'seeded',created:missing.length,collections:summary};
}

if(require.main===module) {
  const uidIndex=process.argv.indexOf('--uid');
  const userId=uidIndex>=0?process.argv[uidIndex+1]:'';
  if(!userId || !process.argv.includes('--confirmed-test-account')) {
    console.error('Usage: node scripts/seed-test-demo-data.cjs --uid UID --confirmed-test-account [--apply]');process.exitCode=1;
  } else {
    const req=createRequire(path.resolve(__dirname,'../functions/package.json'));
    req('firebase-admin/app').initializeApp({projectId:'regen28-2fe51'});
    seedAccount({db:req('firebase-admin/firestore').getFirestore(),userId,confirmedTestAccount:true,apply:process.argv.includes('--apply')})
      .then(result=>console.log(JSON.stringify(result)))
      .catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
  }
}
module.exports={buildDemoData,seedAccount,DATASET};
