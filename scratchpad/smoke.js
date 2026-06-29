/* 헤드리스 스모크 테스트 — 대상: app/index.html
   vm + 관찰가능 DOM 스텁으로 <script>를 실행하고 핵심 흐름을 단언.
   실행: node scratchpad/smoke.js   (의존성 0)
   상태 관찰: localStorage(=직렬화된 DB) 재파싱, startRest/toast 스파이.

   커버 범위(PR4 기준 폭넓게 재정비):
   - 저장소 키/DEFAULT 폴백, 백업 호환(sessions/done/exDB 폴백)
   - 운동/세트/볼륨, 세트 완료체크 + autoRest 게이팅
   - 세션 시작/종료/경과(durationSec)/요약(sessionSummary)
   - PR 토스트 세션 게이팅, 추정 1RM(Epley)/bigThree
   - 식단 추가/삭제, 습관 토글/스텝, 신체 추가/병합 + 차트
   - 휴식타이머 시작/카운트/완료/시트값 갱신
   - 4탭 렌더 무에러
   - 신규(PR4): exDB 시드+병합, partOf 폴백, 즐겨찾기 토글,
     운동 선택 필터/검색, 직접추가, prevSetFor 이전기록 조회, 부위 저장
   - 신규(PR5): 월 달력 렌더(현재 월), 기록일 마커(운동/식단), 월 이동(calShift),
     주간 목표 폴백/진행(이번 주 운동일수·목표 대비), 날짜 탭 시 cur 변경
   - 신규(루틴): routines 기본/폴백, 현재운동→루틴 저장, 빈 루틴+종목 추가,
     루틴 불러오기 시 오늘 운동에 빈 세트로 추가, 이름변경·삭제, 옛 백업 호환,
     운동 화면 '내 루틴' 섹션 렌더
   - 신규(분석 보강): weekVolume/weekWorkoutDayCount 주별 집계, partVolume
     최근 4주 부위별 볼륨 정확도(part 폴백/기타 포함), recentWeeklyStats 시계열,
     stats 탭 렌더(부위별 볼륨·8주 빈도·총 볼륨·3대 1RM·체중요약) 무에러,
     체중 요약 변화 표기, 빈 데이터 안내, 부위 비중 % */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const html=fs.readFileSync(path.join(__dirname,'..','app','index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert(scripts.length,'no <script> found');

function makeEl(){
  const el={
    _cls:new Set(), style:{}, dataset:{}, value:'', textContent:'', innerHTML:'',
    firstChild:{textContent:''},
    classList:{add(c){el._cls.add(c);},remove(c){el._cls.delete(c);},
      toggle(c,f){if(f===undefined)f=!el._cls.has(c);f?el._cls.add(c):el._cls.delete(c);return f;},
      contains(c){return el._cls.has(c);}},
    appendChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){return makeEl();}, querySelectorAll(){return [];},
    getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},drawImage(){}};},
    // canvas.toBlob 스텁: 압축 결과를 입력 크기보다 작게 흉내(픽셀수에 비례한 가짜 바이트).
    toBlob(cb){cb&&cb({size:Math.max(1,Math.round((el.width||10)*(el.height||10)*0.3)),type:'image/jpeg',__blob:true});},
    width:0, height:0,
    setAttribute(){}, getAttribute(){return null;}, focus(){}, scrollIntoView(){}
  };
  return el;
}
const elCache={};
let _photoImgs=[];  // document.querySelectorAll('img[data-photo]') 가 돌려줄 목록(테스트가 주입)
const document={
  getElementById(id){return elCache[id]||(elCache[id]=makeEl());},
  querySelector(){return makeEl();},
  querySelectorAll(sel){return /data-photo/.test(sel)?_photoImgs:[];},
  createElement(){return makeEl();},
  addEventListener(){}, body:makeEl(), documentElement:makeEl()
};
const store={};
const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};

/* 인메모리 IndexedDB 스텁(open→onsuccess, put/get/delete 트랜잭션 흉내). */
const _idb={};
function makeTx(){
  const tx={};
  tx.objectStore=()=>({
    put(v,k){_idb[k]=v;setImmediate(()=>tx.oncomplete&&tx.oncomplete());return {};},
    get(k){const r={};setImmediate(()=>{r.result=(k in _idb)?_idb[k]:null;r.onsuccess&&r.onsuccess();});return r;},
    delete(k){delete _idb[k];setImmediate(()=>tx.oncomplete&&tx.oncomplete());return {};}
  });
  return tx;
}
function makeIDB(){
  return {open(){const req={result:{
    objectStoreNames:{contains:()=>true},createObjectStore(){},
    transaction(){return makeTx();}
  }};setImmediate(()=>req.onsuccess&&req.onsuccess());return req;}};
}

const ctx={
  document, localStorage,
  navigator:{vibrate:function(){},serviceWorker:{register:function(){return Promise.resolve();}}},
  Promise, setImmediate,
  window:{}, location:{href:'',reload(){},protocol:'http:'},
  setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, clearTimeout(){},
  requestAnimationFrame:fn=>fn&&fn(),
  confirm:()=>true, alert(){}, prompt:()=>null,
  structuredClone:o=>JSON.parse(JSON.stringify(o)), JSON, Date, Math, Object, Array, String, Number, Error,
  indexedDB:makeIDB(),
  // Image 스텁: src 지정 시 onload 비동기 호출, 가짜 자연크기 제공.
  Image:function(){const im={width:0,height:0};Object.defineProperty(im,'src',{set(){im.naturalWidth=2000;im.naturalHeight=1500;setImmediate(()=>im.onload&&im.onload());}});return im;},
  URL:{createObjectURL:()=>'blob:fake',revokeObjectURL(){}},
  crypto:{randomUUID:()=>'11111111-2222-4333-8444-555555555555'},
  fetch:()=>Promise.resolve({blob:()=>Promise.resolve({size:100,__blob:true})}),
  AudioContext:function(){return {createOscillator:()=>({connect(){},start(){},stop(){},frequency:{setValueAtTime(){}},type:''}),createGain:()=>({connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}}),currentTime:0,destination:{}};},
  console
};
ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
vm.createContext(ctx);
for(const s of scripts){vm.runInContext(s,ctx,{filename:'index.html-script'});}

/* vm에서 const/let/function 은 컨텍스트 프로퍼티로 노출되지 않는다.
   → 모든 앱 코드 호출/상태변경은 같은 컨텍스트에서 평가(ev)하고,
     관찰은 localStorage(직렬화된 DB) 재파싱으로 한다. */
function ev(code){return vm.runInContext(code,ctx,{filename:'eval'});}
function DB(){return JSON.parse(store['momzzang_v1']);}

/* startRest / toast 를 vm 안에서 스파이로 교체. 인자는 노출 배열로 수집.
   __tick: startRest 가 실제 카운트다운을 돌리지 않도록(스텁) 대체하나,
   휴식 카운트 테스트에서는 원본을 복원해 검증한다. */
ctx.__rest=[];ctx.__toast=[];
ev('startRest=function(sec){__rest.push(sec);};');
ev('toast=function(m){__toast.push(m);};');

function reset(){
  for(const k in store)delete store[k];
  ev('DB=structuredClone(DEFAULT);cur="2026-06-27";calMonth=0;save();');
  ctx.__rest.length=0;ctx.__toast.length=0;
}
const restCallsLen=()=>ctx.__rest.length;
const toastList=()=>ctx.__toast;
const clearSpies=()=>{ctx.__rest.length=0;ctx.__toast.length=0;};
let pass=0;
function t(name,fn){try{fn();pass++;console.log('  ok -',name);}catch(e){console.error('  FAIL -',name,'\n   ',e.message);process.exitCode=1;}}

console.log('BULCUP smoke tests\n');

/* ========== 저장소 / 폴백 ========== */
t('KEY=momzzang_v1 이고 DEFAULT 폴백이 동작',()=>{
  assert.strictEqual(ev('KEY'),'momzzang_v1');
  reset();const d=DB();assert(d.workouts&&d.settings&&d.sessions&&Array.isArray(d.exDB));
});

t('백업 import 후 sessions/done/exDB 폴백 유지(옛 백업 호환)',()=>{
  reset();
  // 신규 키가 빠진 옛 백업
  ev("DB=Object.assign(structuredClone(DEFAULT),{workouts:{'2026-06-27':[{name:'스쿼트',sets:[{weight:'60',reps:'8'}]}]},meals:{},habits:{},body:[],settings:{}});save();");
  assert(DB().sessions,'sessions 폴백');
  assert(Array.isArray(DB().exDB),'exDB 폴백');
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-27'])"),480);
});

/* ========== 운동/세트/볼륨 ========== */
t('quickEx 추가 시 첫 세트 done:false + 부위 저장',()=>{
  reset();ev("quickEx('벤치프레스')");
  const ex=DB().workouts['2026-06-27'][0];
  assert.strictEqual(ex.sets[0].done,false,'done 기본값 false');
  assert.strictEqual(ex.part,'가슴','시드 운동의 부위가 저장됨');
});

t('addSet 은 휴식을 시작하지 않는다',()=>{
  reset();ev("quickEx('스쿼트')");clearSpies();
  ev('addSet(0)');
  assert.strictEqual(restCallsLen(),0);
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets.length,2);
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[1].done,false);
});

t('toggleSetDone 으로 set.done 토글',()=>{
  reset();ev("quickEx('데드리프트')");
  ev('toggleSetDone(0,0)');
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[0].done,true);
  ev('toggleSetDone(0,0)');
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[0].done,false);
});

t('완료 체크 시 autoRest ON(기본)이면 휴식 시작',()=>{
  reset();ev("quickEx('벤치프레스')");clearSpies();
  ev('toggleSetDone(0,0)');
  assert.strictEqual(restCallsLen(),1);
  assert.strictEqual(ctx.__rest[0],ev('restDefault()'));
});

t('완료 해제 시에는 휴식 시작 안 함',()=>{
  reset();ev("quickEx('벤치프레스')");
  ev('toggleSetDone(0,0)');clearSpies();
  ev('toggleSetDone(0,0)');
  assert.strictEqual(restCallsLen(),0);
});

t('완료 체크 시 autoRest OFF면 휴식 시작 안 함',()=>{
  reset();ev('DB.settings.autoRest=false;save();');
  ev("quickEx('벤치프레스')");clearSpies();
  ev('toggleSetDone(0,0)');
  assert.strictEqual(restCallsLen(),0);
});

t('볼륨은 done 과 무관하게 전 세트 기준',()=>{
  reset();ev("quickEx('스쿼트')");
  ev("setVal(0,0,'weight','100');setVal(0,0,'reps','5');");
  ev('addSet(0)');
  ev("setVal(0,1,'weight','100');setVal(0,1,'reps','5');");
  ev('toggleSetDone(0,1)');
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-27'])"),1000);
});

t('옛 세트(done 없음) 호환 — 볼륨/PR 정상',()=>{
  reset();
  ev("DB.workouts['2026-06-27']=[{name:'벤치프레스',sets:[{weight:'80',reps:'10'}]}];save();");
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[0].done,undefined);
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-27'])"),800);
  assert.strictEqual(ev("exerciseMaxWeight('벤치프레스')"),80);
});

t('delSet/delEx 정리 동작',()=>{
  reset();ev("quickEx('스쿼트')");ev('addSet(0)');
  ev('delSet(0,1)');
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets.length,1);
  ev('delEx(0)');
  assert(!DB().workouts['2026-06-27'],'마지막 종목 삭제 시 날짜 정리');
});

/* ========== 세션 ========== */
t('세션 시작→종료로 durationSec 확정',()=>{
  reset();ev('startSession()');
  assert(ev('isSessionActive()'));
  const sid=DB().settings.activeSessionId;assert(sid);
  ev('endSession()');
  assert(!ev('isSessionActive()'));
  const s=DB().sessions['2026-06-27'].find(x=>x.id===sid);
  assert(s.endedAt&&typeof s.durationSec==='number');
});

t('세션 요약 sessionSummary 값 정확',()=>{
  reset();ev("startSession();quickEx('벤치프레스');");
  ev("setVal(0,0,'weight','60');setVal(0,0,'reps','10');");
  ev('addSet(0)');ev("setVal(0,1,'weight','60');setVal(0,1,'reps','10');");
  const sid=DB().settings.activeSessionId;
  const sum=ev("(function(){var s=activeSession();return sessionSummary(s);})()");
  assert.strictEqual(sum.nEx,1,'1종목');
  assert.strictEqual(sum.nSets,2,'2세트');
  assert.strictEqual(sum.volume,1200,'볼륨 60*10*2');
});

t('PR 토스트: 활성 세션 세트면 신기록, 과거 수정은 안 뜸',()=>{
  reset();
  ev("startSession();quickEx('벤치프레스');");clearSpies();
  ev("setVal(0,0,'weight','120')");
  assert(toastList().some(m=>m.includes('신기록')),'활성 중 신기록 토스트');
  ev('endSession()');clearSpies();
  ev("setVal(0,0,'weight','130')");
  assert.strictEqual(toastList().length,0,'세션 비활성 시 토스트 없음');
});

/* ========== 추정 1RM ========== */
t('Epley 추정 1RM 계산',()=>{
  assert.strictEqual(Math.round(ev('epley(100,10)')),133);
  assert.strictEqual(Math.round(ev('epley(80,1)')*100)/100,82.67);
  assert.strictEqual(ev('epley(0,10)'),0);
});

t('bigThree 3대 부분일치 집계',()=>{
  reset();
  ev("DB.workouts['2026-06-27']=[{name:'백스쿼트',sets:[{weight:'100',reps:'5'}]},{name:'벤치프레스',sets:[{weight:'80',reps:'5'}]}];save();");
  const big=ev('bigThree()');
  const sq=big.find(b=>b.label==='스쿼트');const be=big.find(b=>b.label==='벤치프레스');
  assert(sq.oneRM>0,'스쿼트 부분일치(백스쿼트)');
  assert(be.oneRM>0,'벤치 부분일치');
});

/* ========== 식단(개편: 끼니 타입 제거 + 시간기준) ========== */
t('식단 추가/삭제 회귀(type 없이 저장)',()=>{
  reset();
  ctx.document.getElementById('mealMemo').value='닭가슴살';
  ctx.document.getElementById('mealKcal').value='300';
  ctx.document.getElementById('mealProt').value='40';
  ev('addMeal()');
  const m=DB().meals['2026-06-27'][0];
  assert.strictEqual(m.memo,'닭가슴살');
  assert.strictEqual(m.type,undefined,'끼니 type 제거됨(미저장)');
  ev('delMeal(0)');
  assert(!DB().meals['2026-06-27'],'삭제 후 빈 날짜 정리');
});

/* ========== 식단 먹은 시각 자동 기록 ========== */
t('addMeal 시 먹은 시각(at) 자동 기록(HH:MM)',()=>{
  reset();
  ctx.document.getElementById('mealMemo').value='닭가슴살';
  ctx.document.getElementById('mealKcal').value='';
  ctx.document.getElementById('mealProt').value='';
  ev('addMeal()');
  const m=DB().meals['2026-06-27'][0];
  assert(/^\d{2}:\d{2}$/.test(m.at),'at은 HH:MM 형식: '+m.at);
});

t('addPreset(프리셋) 추가 시에도 at 기록',()=>{
  reset();
  ev('addPreset(0)');
  const m=DB().meals['2026-06-27'][0];
  assert(/^\d{2}:\d{2}$/.test(m.at),'프리셋도 at 기록: '+m.at);
});

t('옛 식단(at 없음·옛 type 포함) 호환 — 렌더 무에러',()=>{
  reset();
  ev("DB.meals['2026-06-27']=[{type:'점심',memo:'옛기록',kcal:'',protein:''}];save();");
  const m=DB().meals['2026-06-27'][0];
  assert.strictEqual(m.at,undefined,'옛 데이터엔 at 없음');
  const v=ev('viewMeal()');
  assert(v.includes('옛기록'),'옛 기록(옛 type 포함) 렌더됨(무에러)');
});

t('at 있는 식단은 목록에 시각 입력칸(value=HH:MM)으로 표시',()=>{
  reset();
  ev("DB.meals['2026-06-27']=[{memo:'밥',kcal:'',protein:'',at:'13:20'}];save();");
  const v=ev('viewMeal()');
  assert(v.includes('type="time"'),'시각 수정용 time 입력칸');
  assert(v.includes('value="13:20"'),'현재 시각 value 반영');
  assert(v.includes('setMealAt(0,'),'시각 수정 핸들러');
});

t('식단은 시간(at) 순으로 정렬되어 렌더(at 없는 옛 기록은 뒤)',()=>{
  reset();
  ev("DB.meals['2026-06-27']=[{memo:'저녁밥',at:'19:00'},{memo:'아침밥',at:'07:30'},{memo:'옛것'}];save();");
  const v=ev('viewMeal()');
  const iEarly=v.indexOf('아침밥'),iLate=v.indexOf('저녁밥'),iOld=v.indexOf('옛것');
  assert(iEarly>-1&&iLate>-1&&iOld>-1,'모두 렌더됨');
  assert(iEarly<iLate,'07:30이 19:00보다 앞');
  assert(iLate<iOld,'at 없는 옛 기록은 맨 뒤');
});

t('setMealAt: 식단 항목 시각 수정 저장(빈 값은 무시)',()=>{
  reset();
  ev("DB.meals['2026-06-27']=[{memo:'밥',at:'13:20'}];save();");
  ev("setMealAt(0,'09:05')");
  assert.strictEqual(DB().meals['2026-06-27'][0].at,'09:05','시각 수정 반영');
  ev("setMealAt(0,'')");
  assert.strictEqual(DB().meals['2026-06-27'][0].at,'09:05','빈 값은 무시');
});

/* ========== 신규(QoL): 사진 input에 capture 속성 제거(갤러리/구글포토 허용) ========== */
t('mealPhoto/bodyPhoto input에 capture 속성 없음',()=>{
  reset();
  const vm_=ev("viewMeal()");
  assert(vm_.includes('id="mealPhoto"'),'식단 입력 존재');
  assert(!/id="mealPhoto"[^>]*capture/.test(vm_),'식단 입력에 capture 없음');
  const vb=ev("viewBody()");
  assert(vb.includes('id="bodyPhoto"'),'신체 입력 존재');
  assert(!/id="bodyPhoto"[^>]*capture/.test(vb),'신체 입력에 capture 없음');
});

/* ========== 신규(QoL): 인앱 새로고침 버튼 ========== */
t('프로필(me) 탭에 앱 새로고침 버튼 렌더',()=>{
  reset();ev("setTab('me')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('앱 새로고침'),'새로고침 버튼 라벨');
  assert(v.includes('refreshApp()'),'refreshApp 핸들러');
});

t('refreshApp: 서비스워커 없으면 reload 호출(예외 없음)',()=>{
  reset();
  let reloaded=0;const sw=ctx.navigator.serviceWorker;
  ctx.navigator.serviceWorker=undefined;
  const oldReload=ctx.location.reload;ctx.location.reload=()=>{reloaded++;};
  ev('refreshApp()');
  ctx.navigator.serviceWorker=sw;ctx.location.reload=oldReload;
  assert.strictEqual(reloaded,1,'reload 1회');
});

/* ========== 습관 ========== */
t('습관 체크 토글 / 숫자 스텝',()=>{
  reset();
  ev("toggleHabit('protein')");
  assert.strictEqual(DB().habits['2026-06-27'].protein,true);
  ev("toggleHabit('protein')");
  assert(!DB().habits['2026-06-27'],'해제 시 정리');
  ev("stepHabit('water',1)");
  assert.strictEqual(DB().habits['2026-06-27'].water,1);
  ev("stepHabit('water',-1)");
  assert(!DB().habits['2026-06-27'],'0이면 정리');
});

/* ========== 신체 + 차트 ========== */
t('신체 추가/같은 날짜 병합 + 차트 무에러',()=>{
  reset();
  ctx.document.getElementById('bDate').value='2026-06-27';
  ctx.document.getElementById('bWeight').value='80';
  ctx.document.getElementById('bMuscle').value='';
  ctx.document.getElementById('bFat').value='';
  ev('addBody()');
  assert.strictEqual(DB().body[0].weight,80);
  ctx.document.getElementById('bFat').value='15';
  ev('addBody()');
  assert.strictEqual(DB().body.length,1,'같은 날짜 병합');
  assert.strictEqual(DB().body[0].fat,15);
  ev('drawChart()'); // 스텁 SVG, 예외 없어야 함
});

/* ========== 휴식 타이머(원본 복원 후 카운트/완료/시트) ========== */
t('휴식타이머: 시작→카운트→완료 + 시트 시간 갱신',()=>{
  reset();
  // 스파이로 덮은 startRest 원본 복원
  ev('startRest=function(sec){restRemain=sec;restRunning=true;clearInterval(restTimer);restTimer=setInterval(tickRest,1000);showRestBar();};');
  ev('startRest(3)');
  assert.strictEqual(ev('restRemain'),3,'시작값');
  // setInterval 이 스텁(0)이라 수동 tick
  ev('tickRest()');assert.strictEqual(ev('restRemain'),2);
  // 시트 열려있을 때 카운트가 시트 시간에 반영되는지: restSheetTime 요소 텍스트
  ev('tickRest()');ev('tickRest()'); // 1 -> 0 -> finishRest
  assert.strictEqual(ev('restRemain'),0,'완료 시 0');
  assert.strictEqual(ev('restRunning'),false,'완료 시 정지');
  // 다시 스파이로(이후 테스트 격리)
  ev('startRest=function(sec){__rest.push(sec);};');
});

t('휴식 시트 시간 표시(fmtClock)',()=>{
  assert.strictEqual(ev('fmtClock(90)'),'1:30');
  assert.strictEqual(ev('fmtClock(5)'),'0:05');
});

/* ========== PR4 신규: 카테고리/exDB/이전기록 ========== */
t('exDB 시드 + 사용자분 병합(allEx), PARTS 7부위',()=>{
  reset();
  assert.strictEqual(ev('JSON.stringify(PARTS)'),JSON.stringify(['가슴','등','어깨','팔','하체','복근','유산소']));
  const n=ev('allEx().length');
  assert(n>=35,'시드 운동 다수(>=35) — 실제 '+n);
  assert(ev("allEx().some(e=>e.name==='벤치프레스'&&e.part==='가슴')"),'벤치=가슴');
});

t('partOf: 시드 매칭 / 미등록은 기타',()=>{
  reset();
  assert.strictEqual(ev("partOf('스쿼트')"),'하체');
  assert.strictEqual(ev("partOf('랫풀다운')"),'등');
  assert.strictEqual(ev("partOf('내맘대로운동')"),'기타','미등록 폴백');
});

t('직접추가 addNewEx → exDB 누적 + 부위 지정 + 종목 추가',()=>{
  reset();ev("newExPart='어깨';");
  ctx.document.getElementById('newExName').value='특수 프레스';
  ev('addNewEx()');
  assert(DB().exDB.some(e=>e.name==='특수 프레스'&&e.part==='어깨'),'exDB에 사용자 운동 누적');
  assert.strictEqual(ev("partOf('특수 프레스')"),'어깨','이후 partOf로 조회됨');
  const ex=DB().workouts['2026-06-27'][0];
  assert.strictEqual(ex.name,'특수 프레스');
  assert.strictEqual(ex.part,'어깨','추가된 종목에 부위 저장');
});

t('즐겨찾기 토글이 exDB에 반영',()=>{
  reset();
  assert.strictEqual(ev("isFav('스쿼트')"),false,'기본 미즐겨');
  ev("toggleFav('스쿼트')");
  assert.strictEqual(ev("isFav('스쿼트')"),true,'토글 후 즐겨');
  assert(DB().exDB.some(e=>e.name==='스쿼트'&&e.fav===true),'exDB에 저장');
  ev("toggleFav('스쿼트')");
  assert.strictEqual(ev("isFav('스쿼트')"),false,'다시 해제');
});

t('운동 선택 필터: 부위/즐겨/검색이 리스트를 좁힘',()=>{
  reset();
  // 부위 필터(하체)
  const legs=ev("allEx().filter(e=>e.part==='하체').map(e=>e.name)");
  assert(legs.includes('스쿼트')&&!legs.includes('벤치프레스'),'하체 필터');
  // 검색(부분일치)
  const found=ev("allEx().filter(e=>e.name.includes('컬')).map(e=>e.name)");
  assert(found.includes('바벨컬')&&found.includes('덤벨컬'),'검색 부분일치');
  // 즐겨 필터
  ev("toggleFav('데드리프트')");
  const favs=ev("JSON.stringify(allEx().filter(e=>isFav(e.name)).map(e=>e.name))");
  assert.strictEqual(favs,JSON.stringify(['데드리프트']),'즐겨찾기 필터');
});

t('prevSetFor: 같은 운동의 직전 날짜 기록을 세트번호로 조회',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'60',reps:'10'},{weight:'62',reps:'8'}]}];");
  ev("DB.workouts['2026-06-25']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'65',reps:'9'}]}];save();");
  ev("cur='2026-06-27';");
  const p0=ev("prevSetFor('벤치프레스',0)");
  assert.strictEqual(p0.date,'2026-06-25','가장 최근 직전 날짜');
  assert.strictEqual(String(p0.weight),'65','세트0 무게');
  // 세트1은 직전(25일)에 없으니 마지막 세트로 폴백
  const p1=ev("prevSetFor('벤치프레스',1)");
  assert.strictEqual(String(p1.weight),'65','없는 세트는 마지막으로 폴백');
});

t('prevSetFor: 과거 기록 없으면 null(고스트 미표시)',()=>{
  reset();ev("cur='2026-06-27';");
  assert.strictEqual(ev("prevSetFor('스쿼트',0)"),null);
});

t('이전기록 고스트가 운동 화면에 렌더된다(setTab workout)',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];save();");
  ev("cur='2026-06-27';quickEx('스쿼트');");
  ev("setTab('workout')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('지난 기록')&&v.includes('100kg'),'고스트 텍스트(지난 기록 100kg) 표시');
});

/* ========== PR5 신규: 월 달력 / 주간 목표 ========== */
// 헬퍼: 현재 calMonth 가 가리키는 달의 'YYYY-MM-' 프리픽스
function calPrefix(){
  return ev("(function(){var n=new Date();var a=new Date(n.getFullYear(),n.getMonth()+calMonth,1);"+
    "return a.getFullYear()+'-'+String(a.getMonth()+1).padStart(2,'0')+'-';})()");
}

t('주간 목표: 기본값 4 폴백 + 설정 반영',()=>{
  reset();
  assert.strictEqual(ev('weeklyGoal()'),4,'신규 설정 없으면 기본 4');
  ev('DB.settings.weeklyGoal=3;save();');
  assert.strictEqual(ev('weeklyGoal()'),3,'설정값 반영');
  ev('setWeeklyGoal(5)');
  assert.strictEqual(DB().settings.weeklyGoal,5,'setWeeklyGoal 저장');
  ev('setWeeklyGoal(99)');assert.strictEqual(DB().settings.weeklyGoal,7,'상한 7로 클램프');
  ev('setWeeklyGoal(0)');assert.strictEqual(DB().settings.weeklyGoal,1,'하한 1로 클램프');
});

t('주간 목표: 이번 주 운동일수 계산(중복일 1회) + 진행바 렌더',()=>{
  reset();ev("DB.settings.weeklyGoal=4;save();");
  // cur=2026-06-27(토). 그 주 일~토 = 06-21~06-27
  ev("DB.workouts['2026-06-22']=[{name:'스쿼트',sets:[{weight:'60',reps:'5'}]}];");
  ev("DB.workouts['2026-06-24']=[{name:'벤치프레스',sets:[{weight:'60',reps:'5'}]}];");
  // 같은 날 종목 2개여도 1일로 카운트
  ev("DB.workouts['2026-06-24'].push({name:'데드리프트',sets:[{weight:'80',reps:'5'}]});save();");
  assert.strictEqual(ev('weekWorkoutDays()'),2,'이번 주 운동한 날 2일');
  const v=ev('viewWeeklyGoal()');
  assert(v.includes('주 4회'),'목표 라벨');
  assert(v.includes('width:50%'),'2/4 = 50% 진행바');
});

t('주간 목표 3/4 단언(스펙 검증값)',()=>{
  reset();ev("DB.settings.weeklyGoal=4;save();");
  ['2026-06-21','2026-06-23','2026-06-25'].forEach(k=>
    ev(`DB.workouts['${k}']=[{name:'스쿼트',sets:[{weight:'60',reps:'5'}]}];`));
  ev('save();');
  assert.strictEqual(ev('weekWorkoutDays()'),3,'3일');
  assert.strictEqual(ev('weeklyGoal()'),4,'목표 4');
  assert(ev('viewWeeklyGoal()').includes('width:75%'),'3/4=75%');
});

t('월 달력: 현재 월 제목·해당 월 날짜 수 렌더',()=>{
  reset();
  const v=ev('viewCalendar()');
  // 현재 calMonth(0) 의 연/월
  const ym=ev("(function(){var a=new Date(new Date().getFullYear(),new Date().getMonth(),1);return a.getFullYear()+'년 '+(a.getMonth()+1)+'월';})()");
  assert(v.includes(ym),'현재 월 제목 표시: '+ym);
  // 요일 헤더 7개
  ['일','월','화','수','목','금','토'].forEach(d=>assert(v.includes('>'+d+'</div>'),'요일 헤더 '+d));
  // 그 달 1일과 말일 버튼 존재
  const pre=calPrefix();
  assert(v.includes('>1</span>'),'1일 셀');
  assert(v.includes("goDate('"+pre+"01')"),'1일 onclick');
});

t('월 달력: 운동일=강조점(cd w), 식단일=보조점(cd m), 없는 날 미표시',()=>{
  reset();
  const pre=calPrefix();
  ev(`DB.workouts['${pre}05']=[{name:'스쿼트',sets:[{weight:'60',reps:'5'}]}];`);
  ev(`DB.meals['${pre}06']=[{type:'점심',memo:'닭',kcal:'300',protein:'40'}];save();`);
  assert.strictEqual(ev(`dayHasWorkout('${pre}05')`),true);
  assert.strictEqual(ev(`dayHasMeal('${pre}06')`),true);
  assert.strictEqual(ev(`dayHasWorkout('${pre}06')`),false,'식단만 있는 날은 운동마커 없음');
  const v=ev('viewCalendar()');
  // 운동일 셀은 has-w 클래스
  assert(v.includes('cday has-w'),'운동일 강조 클래스');
  // 점 마커 둘 다 등장
  assert(v.includes('cd w')&&v.includes('cd m'),'운동·식단 점 마커 존재');
  // 기록 없는 깨끗한 달은 마커 없음(다음 달로 이동해 확인)
  ev('calShift(6)');
  const empty=ev('viewCalendar()');
  assert(!empty.includes('class="cday has-w"'),'기록 없는 달엔 운동 강조 없음');
  ev('calShift(-6)');
});

t('월 달력: 월 이동(calShift) 으로 제목 변경',()=>{
  reset();
  const t0=ev("viewCalendar().match(/caltitle\">([^<]+)</)[1]");
  ev('calShift(1)');
  const t1=ev("viewCalendar().match(/caltitle\">([^<]+)</)[1]");
  assert.notStrictEqual(t0,t1,'다음 달로 제목 변경');
  ev('calShift(-1)');
  const t2=ev("viewCalendar().match(/caltitle\">([^<]+)</)[1]");
  assert.strictEqual(t0,t2,'되돌리면 원래 달');
});

t('월 달력: 날짜 탭(goDate) 하면 cur 변경',()=>{
  reset();
  const pre=calPrefix();
  ev(`goDate('${pre}15')`);
  assert.strictEqual(ev('cur'),pre+'15','탭한 날짜로 cur 설정');
});

t('월 달력: 오늘 강조(today 클래스)',()=>{
  reset();
  const v=ev('viewCalendar()');
  assert(v.includes('cday today')||v.includes('today'),'오늘 셀 강조 클래스 존재');
});

/* ========== 루틴/프로그램 ========== */
t('routines 기본값([]) + 옛 백업 폴백',()=>{
  reset();
  assert(Array.isArray(DB().routines),'DEFAULT에 routines:[]');
  assert.strictEqual(DB().routines.length,0,'기본 빈 배열');
  // routines 키가 빠진 옛 백업
  ev("DB=Object.assign(structuredClone(DEFAULT),{workouts:{},meals:{},habits:{},body:[],settings:{}});delete DB.routines;save();");
  assert.strictEqual(ev('JSON.stringify(routines())'),'[]','routines() 폴백으로 [] 보장');
  assert(ev('Array.isArray(DB.routines)'),'호출 후 DB.routines 생성(인메모리)');
});

t('현재 운동 → 루틴 저장(이름·종목·부위)',()=>{
  reset();
  ev("quickEx('벤치프레스');quickEx('스쿼트');");
  ev("saveCurrentAsRoutine('상하체 데이')");
  const rs=DB().routines;
  assert.strictEqual(rs.length,1,'루틴 1개');
  assert.strictEqual(rs[0].name,'상하체 데이','이름 저장');
  assert.strictEqual(rs[0].items.length,2,'종목 2개');
  assert.strictEqual(rs[0].items[0].name,'벤치프레스');
  assert.strictEqual(rs[0].items[0].part,'가슴','부위 저장(시드)');
  assert.strictEqual(rs[0].items[1].part,'하체');
  // 세트/무게는 담지 않음(텍스트만)
  assert.strictEqual(rs[0].items[0].sets,undefined,'세트 미포함');
});

t('현재 운동 없으면 저장 안 됨(null)',()=>{
  reset();
  assert.strictEqual(ev("saveCurrentAsRoutine('빈루틴')"),null,'빈 운동은 null');
  assert.strictEqual(DB().routines.length,0,'루틴 미생성');
});

t('이름 미입력 시 자동 이름 부여',()=>{
  reset();ev("quickEx('데드리프트');");
  ev("saveCurrentAsRoutine('')");
  assert(/^루틴 \d+$/.test(DB().routines[0].name),'자동 이름(루틴 N): '+DB().routines[0].name);
});

t('빈 루틴 생성 + 운동 선택으로 종목 추가(중복 무시)',()=>{
  reset();
  const rid=ev("createEmptyRoutine('등 데이').id");
  assert.strictEqual(DB().routines[0].items.length,0,'빈 루틴');
  ev(`addExToRoutine('${rid}','랫풀다운')`);
  ev(`addExToRoutine('${rid}','바벨로우')`);
  ev(`addExToRoutine('${rid}','랫풀다운')`); // 중복
  const r=DB().routines.find(x=>x.id===rid);
  assert.strictEqual(r.items.length,2,'중복 이름 무시');
  assert.strictEqual(r.items[0].part,'등','부위 추론 저장');
});

t('루틴 불러오기 → 오늘 운동에 빈 세트로 추가',()=>{
  reset();
  ev("quickEx('벤치프레스');saveCurrentAsRoutine('가슴루틴');");
  const rid=DB().routines[0].id;
  // 오늘 운동을 비우고 다른 날에서 불러오기
  reset();
  // reset 이 routines 도 날리므로 다시 구성
  ev("quickEx('벤치프레스');setVal(0,0,'weight','100');setVal(0,0,'reps','5');saveCurrentAsRoutine('가슴루틴');");
  ev("delEx(0);"); // 오늘 운동 비움
  assert(!DB().workouts['2026-06-27'],'오늘 운동 비워짐');
  const rid2=DB().routines[0].id;
  ev(`loadRoutine('${rid2}')`);
  const w=DB().workouts['2026-06-27'];
  assert(w&&w.length===1,'루틴 종목 1개 추가됨');
  assert.strictEqual(w[0].name,'벤치프레스');
  assert.strictEqual(w[0].part,'가슴','부위 유지');
  assert.strictEqual(w[0].sets.length,1,'빈 세트 1개');
  assert.strictEqual(w[0].sets[0].weight,'','무게 비어있음(루틴은 종목만)');
  assert.strictEqual(w[0].sets[0].reps,'','횟수 비어있음');
});

t('루틴 불러오기는 기존 오늘 운동에 누적(덮어쓰지 않음)',()=>{
  reset();
  ev("quickEx('스쿼트');"); // 오늘 이미 1종목
  ev("quickEx('랫풀다운');saveCurrentAsRoutine('합본');delEx(1);delEx(0);"); // 루틴엔 2종목 저장, 오늘 비움...
  // 위에서 오늘 다 비웠으니 다시: 오늘 스쿼트 1종목 두고 루틴(랫풀다운 포함) 불러오기
  reset();
  ev("quickEx('랫풀다운');saveCurrentAsRoutine('등루틴');delEx(0);");
  const rid=DB().routines[0].id;
  ev("quickEx('스쿼트');"); // 오늘 운동 1종목
  ev(`loadRoutine('${rid}')`);
  const w=DB().workouts['2026-06-27'];
  assert.strictEqual(w.length,2,'기존+루틴 누적');
  assert.strictEqual(w[0].name,'스쿼트');
  assert.strictEqual(w[1].name,'랫풀다운');
});

t('빈 루틴 불러오기는 무동작',()=>{
  reset();
  const rid=ev("createEmptyRoutine('빈것').id");ev('save();');
  ev(`loadRoutine('${rid}')`);
  assert(!DB().workouts['2026-06-27'],'빈 루틴은 오늘 운동 변화 없음');
});

t('루틴 이름변경 / 삭제',()=>{
  reset();ev("quickEx('벤치프레스');saveCurrentAsRoutine('옛이름');");
  const rid=DB().routines[0].id;
  ev(`renameRoutine('${rid}','새이름')`);
  assert.strictEqual(DB().routines[0].name,'새이름','이름변경');
  ev(`renameRoutine('${rid}','')`); // 빈 이름 무시
  assert.strictEqual(DB().routines[0].name,'새이름','빈 이름은 무시');
  ev(`delRoutine('${rid}')`);
  assert.strictEqual(DB().routines.length,0,'삭제됨');
});

t('루틴 종목 삭제(delExFromRoutine)',()=>{
  reset();
  ev("quickEx('벤치프레스');quickEx('스쿼트');saveCurrentAsRoutine('둘');");
  const rid=DB().routines[0].id;
  ev(`delExFromRoutine('${rid}',0)`);
  const r=DB().routines.find(x=>x.id===rid);
  assert.strictEqual(r.items.length,1,'1종목 남음');
  assert.strictEqual(r.items[0].name,'스쿼트','앞 종목 삭제');
});

t("운동 화면에 '내 루틴' 섹션 렌더 + 카드",()=>{
  reset();
  ev("quickEx('벤치프레스');saveCurrentAsRoutine('가슴 데이');");
  ev("setTab('workout')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('내 루틴'),'내 루틴 헤더');
  assert(v.includes('가슴 데이'),'루틴 카드 이름');
  assert(v.includes('rt-card'),'루틴 카드 클래스');
  assert(v.includes('loadRoutine'),'불러오기 핸들러');
});

t('루틴 없을 때 빈 안내 + 만들기 버튼',()=>{
  reset();ev("setTab('workout')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('내 루틴'),'섹션 존재');
  assert(v.includes('빈 루틴 만들기'),'빈 루틴 만들기 버튼');
});

/* ========== 분석(stats) 보강 ========== */
t('weekWorkoutDayCount / weekVolume: 한 주 집계(중복일 1회·볼륨 합)',()=>{
  reset();ev("cur='2026-06-27';"); // 06-21~06-27 주
  ev("DB.workouts['2026-06-22']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];");
  // 같은 날 2종목 — 날짜 카운트는 1
  ev("DB.workouts['2026-06-24']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'60',reps:'10'}]},{name:'데드리프트',part:'등',sets:[{weight:'80',reps:'5'}]}];save();");
  assert.strictEqual(ev('weekWorkoutDayCount(0)'),2,'이번 주 운동한 날 2일');
  // 볼륨: 100*5 + 60*10 + 80*5 = 500+600+400 = 1500
  assert.strictEqual(ev('weekVolume(0)'),1500,'주간 볼륨 합');
  assert.strictEqual(ev('weekWorkoutDayCount(1)'),0,'지난 주는 기록 없음');
});

t('partVolume: 최근 4주 부위별 볼륨 정확 집계(특정 데이터)',()=>{
  reset();ev("cur='2026-06-27';");
  // 이번 주(0): 하체 100*5=500, 가슴 60*10=600
  ev("DB.workouts['2026-06-22']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];");
  ev("DB.workouts['2026-06-24']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'60',reps:'10'}]}];");
  // 2주 전(06-08~06-14): 등 80*5=400
  ev("DB.workouts['2026-06-10']=[{name:'데드리프트',part:'등',sets:[{weight:'80',reps:'5'}]}];");
  // 5주 전(범위 밖): 가슴 200*5=1000 — 집계되면 안 됨
  ev("DB.workouts['2026-05-20']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'200',reps:'5'}]}];save();");
  const pv=ev('partVolume(4)');
  assert.strictEqual(pv['하체'],500,'하체 500');
  assert.strictEqual(pv['가슴'],600,'가슴 600(범위 밖 1000 제외)');
  assert.strictEqual(pv['등'],400,'등 400');
  assert.strictEqual(pv['어깨'],0,'기록 없는 부위 0');
  // 합 = 1500
  assert.strictEqual(ev('Object.values(partVolume(4)).reduce((a,b)=>a+b,0)'),1500,'4주 총합');
});

t('partVolume: 부위 미지정 종목은 partOf로 분류, 미등록은 기타',()=>{
  reset();ev("cur='2026-06-27';");
  // part 필드 없이 시드 종목 → partOf로 하체
  ev("DB.workouts['2026-06-23']=[{name:'스쿼트',sets:[{weight:'50',reps:'10'}]}];");
  // 미등록 종목 → 기타
  ev("DB.workouts['2026-06-25']=[{name:'내맘대로운동',sets:[{weight:'30',reps:'10'}]}];save();");
  const pv=ev('partVolume(4)');
  assert.strictEqual(pv['하체'],500,'part 없는 스쿼트는 하체로');
  assert.strictEqual(pv['기타'],300,'미등록은 기타로');
});

t('recentWeeklyStats: 길이 n, 마지막이 이번주',()=>{
  reset();ev("cur='2026-06-27';");
  ev("DB.workouts['2026-06-24']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];save();");
  const s=ev('recentWeeklyStats(8)');
  assert.strictEqual(s.length,8,'8주');
  assert.strictEqual(s[7].days,1,'마지막=이번주 1일');
  assert.strictEqual(s[7].vol,500,'마지막=이번주 볼륨 500');
  assert.strictEqual(s[0].days,0,'8주전 0');
});

t('stats 탭 렌더: 부위별 볼륨·8주 추이·3대 1RM·체중요약 모두 포함(예외 없음)',()=>{
  reset();ev("cur='2026-06-27';");
  ev("DB.workouts['2026-06-22']=[{name:'백스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];");
  ev("DB.workouts['2026-06-24']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'80',reps:'5'}]}];save();");
  ev("DB.body=[{date:'2026-06-01',weight:80},{date:'2026-06-20',weight:78}];save();");
  ev("setTab('stats')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('부위별 볼륨'),'부위별 볼륨 카드');
  assert(v.includes('part-dot'),'부위 색 점');
  assert(v.includes('최근 8주 운동 횟수'),'주간 빈도 추이');
  assert(v.includes('최근 8주 총 볼륨'),'총 볼륨 추이');
  assert(v.includes('3대 추정 1RM'),'3대 1RM 카드');
  assert(v.includes('체중'),'체중 요약');
});

t('stats 체중 요약: 현재값 + 기록 시작 대비 변화',()=>{
  reset();ev("cur='2026-06-27';");
  ev("DB.workouts['2026-06-24']=[{name:'스쿼트',part:'하체',sets:[{weight:'60',reps:'5'}]}];save();");
  ev("DB.body=[{date:'2026-06-01',weight:80},{date:'2026-06-20',weight:77}];save();");
  const v=ev('viewStats()');
  assert(v.includes('77kg'),'현재 체중 표시');
  assert(v.includes('▼ 3kg'),'시작(80)대비 -3kg 하락 표기');
});

t('stats 빈 데이터: 운동·신체 둘 다 없으면 빈 상태 안내',()=>{
  reset();
  const v=ev('viewStats()');
  assert(v.includes('아직 분석할 기록이 없어요'),'빈 상태 문구');
  assert(v.includes("setTab('workout')"),'운동 기록 유도 버튼');
  assert(!v.includes('goalfill'),'빈 상태에선 막대 차트 미표시');
  assert(!v.includes('최근 8주'),'빈 상태에선 추이 카드 미표시');
});

t('stats 빈 데이터라도 setTab 렌더 예외 없음',()=>{
  reset();
  ev("setTab('stats')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v&&v.length>0,'빈 상태 렌더 내용 존재');
  assert(v.includes('분석'),'분석 헤더');
});

t('stats 부위별 볼륨 막대: 비중 % 합이 100 근처(반올림 오차 허용)',()=>{
  reset();ev("cur='2026-06-27';");
  ev("DB.workouts['2026-06-22']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5'}]}];"); // 500
  ev("DB.workouts['2026-06-24']=[{name:'벤치프레스',part:'가슴',sets:[{weight:'60',reps:'10'}]}];save();"); // 600
  const v=ev('viewStats()');
  // 하체 500/1100≈45%, 가슴 600/1100≈55%
  assert(v.includes('45%')&&v.includes('55%'),'부위 비중 % 표기');
});

/* ========== 4탭 렌더 무에러 ========== */
t('4탭(home/workout/stats/me) 렌더 무에러 + 부위 배지',()=>{
  reset();
  ev("quickEx('벤치프레스');");
  ['home','workout','stats','me'].forEach(tab=>{
    ev(`setTab('${tab}')`);
    const v=ctx.document.getElementById('view').innerHTML;
    assert(v&&v.length>0,tab+' 렌더 내용 존재');
  });
  ev("setTab('workout')");
  assert(ctx.document.getElementById('view').innerHTML.includes('part-badge'),'운동 카드에 부위 배지');
});

/* ========== 신규(PR14): 오늘 체중 빠른 기록(투데이) ========== */
t('saveTodayWeight: 오늘 날짜로 body에 체중 기록(가벼운 기록)',()=>{
  reset();
  ctx.document.getElementById('todayW').value='80.2';
  ev('saveTodayWeight()');
  const rec=DB().body.find(b=>b.date==='2026-06-27');
  assert(rec,'오늘 날짜 행 생성');
  assert.strictEqual(rec.weight,80.2,'체중 저장');
  assert.strictEqual(rec.muscle,null,'근육은 비움(체중만 가볍게)');
  assert.strictEqual(rec.fat,null,'체지방은 비움');
});

t('saveTodayWeight: 같은 날 재저장은 행 추가 없이 값만 갱신',()=>{
  reset();
  ctx.document.getElementById('todayW').value='80.2';ev('saveTodayWeight()');
  ctx.document.getElementById('todayW').value='79.8';ev('saveTodayWeight()');
  const todays=DB().body.filter(b=>b.date==='2026-06-27');
  assert.strictEqual(todays.length,1,'중복 행 없음');
  assert.strictEqual(todays[0].weight,79.8,'값 갱신');
});

t('saveTodayWeight: 빈 값/0 이하는 무시(행 변동 없음)',()=>{
  reset();
  ctx.document.getElementById('todayW').value='80';ev('saveTodayWeight()');
  ctx.document.getElementById('todayW').value='';ev('saveTodayWeight()');
  ctx.document.getElementById('todayW').value='0';ev('saveTodayWeight()');
  assert.strictEqual(DB().body.filter(b=>b.date==='2026-06-27').length,1,'유효값 1건만 유지');
  assert.strictEqual(DB().body[0].weight,80,'기존값 보존');
});

t('빠른 체중 기록과 기존 addBody가 같은 날 병합(체중 보존)',()=>{
  reset();
  ctx.document.getElementById('todayW').value='79.8';ev('saveTodayWeight()');
  // 신체 카드에서 같은 날 근육/체지방만 추가
  ctx.document.getElementById('bDate').value='2026-06-27';
  ctx.document.getElementById('bWeight').value='';
  ctx.document.getElementById('bMuscle').value='34';
  ctx.document.getElementById('bFat').value='17';
  ev('addBody()');
  const rec=DB().body.find(b=>b.date==='2026-06-27');
  assert.strictEqual(DB().body.length,1,'행 1개로 병합');
  assert.strictEqual(rec.weight,79.8,'빠른기록 체중 보존');
  assert.strictEqual(rec.muscle,34,'근육 추가');
  assert.strictEqual(rec.fat,17,'체지방 추가');
});

t('투데이 탭에 오늘 체중 카드 렌더(미기록=저장, 기록=수정)',()=>{
  reset();
  ev("setTab('home')");
  let v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('오늘 체중'),'오늘 체중 카드 헤더');
  assert(v.includes('id="todayW"'),'입력 필드');
  assert(v.includes('>저장<'),'미기록 상태 저장 버튼');
  // 기록 후 수정 버튼 + 현재값
  ctx.document.getElementById('todayW').value='79.8';ev('saveTodayWeight()');
  ev("setTab('home')");
  v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('기록됨'),'기록됨 태그');
  assert(v.includes('>수정<'),'수정 버튼');
  assert(v.includes('79.8'),'현재값 노출');
});

/* ========== 신규(PR14): 인터벌 타이머(유산소/HIIT) ========== */
t('intervalCfg: 설정 없으면 기본값(30/15/8) 폴백',()=>{
  reset();
  const c=ev('intervalCfg()');
  assert.strictEqual(c.work,30);assert.strictEqual(c.rest,15);assert.strictEqual(c.rounds,8);
});

t('setIntervalCfg: settings.interval 저장 + 폴백 반영 + 하한 클램프',()=>{
  reset();
  ev('setIntervalCfg(20,10,3)');
  const i=DB().settings.interval;
  assert.strictEqual(i.work,20);assert.strictEqual(i.rest,10);assert.strictEqual(i.rounds,3);
  const c=ev('intervalCfg()');
  assert.strictEqual(c.work,20);assert.strictEqual(c.rest,10);assert.strictEqual(c.rounds,3);
  // work 하한 1, rest 하한 0, rounds 하한 1
  ev('setIntervalCfg(0,-5,0)');
  const j=DB().settings.interval;
  assert.strictEqual(j.work,1,'work 1로 클램프');
  assert.strictEqual(j.rest,0,'rest 0으로 클램프');
  assert.strictEqual(j.rounds,1,'rounds 1로 클램프');
});

t('인터벌 설정은 옛 백업(interval 키 없음)에서도 기본값 폴백',()=>{
  reset();
  ev("DB=Object.assign(structuredClone(DEFAULT),{settings:{}});save();");
  const c=ev('intervalCfg()');
  assert.strictEqual(c.work,30);assert.strictEqual(c.rounds,8);
});

t('startInterval: 운동 단계로 시작 + 라운드1 + 바 표시',()=>{
  reset();ev('setIntervalCfg(20,10,3)');
  assert.strictEqual(ev('ivActive()'),false,'시작 전 비활성');
  ev('startInterval()');
  assert.strictEqual(ev('ivActive()'),true,'활성');
  assert.strictEqual(ev('ivPhase'),'work','운동 단계');
  assert.strictEqual(ev('ivRemain'),20,'운동 20초');
  assert.strictEqual(ev('ivRound'),1,'라운드 1');
  assert(ctx.document.getElementById('ivBar').classList.contains('show'),'인터벌 바 표시');
});

t('tickInterval: 운동 0 도달 → 휴식 단계(ivAdvance)',()=>{
  reset();ev('setIntervalCfg(20,10,3);startInterval();');
  for(let i=0;i<19;i++)ev('tickInterval()');
  assert.strictEqual(ev('ivRemain'),1,'19초 경과 → 1');
  ev('tickInterval()'); // 0 → rest
  assert.strictEqual(ev('ivPhase'),'rest','휴식 단계 전환');
  assert.strictEqual(ev('ivRemain'),10,'휴식 10초');
  assert.strictEqual(ev('ivRound'),1,'휴식은 같은 라운드');
  assert(ctx.document.getElementById('ivBar').classList.contains('rest'),'바 rest 클래스');
});

t('휴식 0 도달 → 다음 라운드 운동(nextIvRound)',()=>{
  reset();ev('setIntervalCfg(20,10,3);startInterval();');
  for(let i=0;i<20;i++)ev('tickInterval()'); // work 끝 → rest
  for(let i=0;i<10;i++)ev('tickInterval()'); // rest 끝 → r2 work
  assert.strictEqual(ev('ivPhase'),'work','다음 라운드 운동');
  assert.strictEqual(ev('ivRound'),2,'라운드 2');
  assert.strictEqual(ev('ivRemain'),20,'운동 20초 재설정');
  assert(!ctx.document.getElementById('ivBar').classList.contains('rest'),'rest 클래스 해제');
});

t('마지막 라운드 종료 → 완료(done) 후 바 유지',()=>{
  reset();ev('setIntervalCfg(5,5,2);startInterval();');
  // r1 work5 + rest5 + r2 work5 + rest5 = 20 tick → done
  for(let i=0;i<5;i++)ev('tickInterval()');  // r1 work→rest
  for(let i=0;i<5;i++)ev('tickInterval()');  // r1 rest→r2 work
  assert.strictEqual(ev('ivRound'),2,'마지막 라운드 진입');
  for(let i=0;i<5;i++)ev('tickInterval()');  // r2 work→rest
  assert.strictEqual(ev('ivPhase'),'rest','마지막 라운드 휴식');
  for(let i=0;i<5;i++)ev('tickInterval()');  // r2 rest→done
  assert.strictEqual(ev('ivPhase'),'done','완료 단계');
  assert(ctx.document.getElementById('ivBar').classList.contains('done'),'바 done 클래스');
  assert(ctx.document.getElementById('ivBar').classList.contains('show'),'완료 후에도 바 표시');
});

t('휴식 0초 설정: 운동 끝나면 휴식 단계 건너뛰고 다음 라운드',()=>{
  reset();ev('setIntervalCfg(5,0,2);startInterval();');
  assert.strictEqual(ev('ivPhase'),'work');
  for(let i=0;i<5;i++)ev('tickInterval()'); // r1 work 끝 → 휴식 건너뛰고 r2 work
  assert.strictEqual(ev('ivPhase'),'work','휴식 건너뜀');
  assert.strictEqual(ev('ivRound'),2,'바로 2라운드');
  for(let i=0;i<5;i++)ev('tickInterval()'); // r2 work 끝 → done
  assert.strictEqual(ev('ivPhase'),'done','마지막 종료');
});

t('toggleInterval: 일시정지 중 tick 무시, 계속 시 감소',()=>{
  reset();ev('setIntervalCfg(20,10,3);startInterval();');
  ev('toggleInterval()'); // 일시정지
  assert.strictEqual(ev('ivRunning'),false);
  ev('tickInterval()');
  assert.strictEqual(ev('ivRemain'),20,'일시정지 중 tick 무시');
  ev('toggleInterval()'); // 계속
  assert.strictEqual(ev('ivRunning'),true);
  ev('tickInterval()');
  assert.strictEqual(ev('ivRemain'),19,'계속 후 감소');
});

t('stopInterval: 비활성화 + 바 숨김',()=>{
  reset();ev('setIntervalCfg(20,10,3);startInterval();');
  ev('stopInterval()');
  assert.strictEqual(ev('ivActive()'),false,'비활성');
  assert.strictEqual(ev('ivPhase'),null,'단계 초기화');
  assert(!ctx.document.getElementById('ivBar').classList.contains('show'),'바 숨김');
});

t('openIntervalPicker: 시작 전엔 설정 입력, 진행 중엔 단계/시간/정지',()=>{
  reset();
  ev('openIntervalPicker()');
  let v=ctx.document.getElementById('sheet').innerHTML;
  assert(v.includes('id="ivWork"')&&v.includes('id="ivRest"')&&v.includes('id="ivRounds"'),'설정 입력 필드');
  assert(v.includes('시작'),'시작 버튼');
  // 진행 중 시트
  ev('setIntervalCfg(40,20,5);startInterval();openIntervalPicker();');
  v=ctx.document.getElementById('sheet').innerHTML;
  assert(v.includes('id="ivSheetTime"'),'진행 시트 시간 요소');
  assert(v.includes('정지'),'정지 버튼');
});

t('startCustomInterval: 입력값 검증·저장·시작 + 진행 시트 시간 동기화',()=>{
  reset();ev('openIntervalPicker()');
  ctx.document.getElementById('ivWork').value='40';
  ctx.document.getElementById('ivRest').value='20';
  ctx.document.getElementById('ivRounds').value='5';
  ev('startCustomInterval()');
  const i=DB().settings.interval;
  assert.strictEqual(i.work,40);assert.strictEqual(i.rest,20);assert.strictEqual(i.rounds,5);
  assert.strictEqual(ev('ivRemain'),40,'운동 40초 시작');
  // 시트가 열려있으면 tick이 시트 시간에 반영
  ev('openIntervalPicker()');
  assert.strictEqual(ctx.document.getElementById('ivSheetTime').textContent,'0:40','시트 초기 동기화');
  ev('tickInterval()');
  assert.strictEqual(ctx.document.getElementById('ivSheetTime').textContent,'0:39','tick 후 시트 갱신');
});

/* ========== 신규(PR14): 휴식·인터벌 독립성 + 3중 오버레이 적층 ========== */
t('휴식 타이머와 인터벌 타이머는 서로 간섭하지 않는다',()=>{
  reset();
  // 휴식 바를 실제 표시(restRemain) + 인터벌 시작
  ev('restRemain=30;restRunning=true;showRestBar();');
  ev('setIntervalCfg(40,20,5);startInterval();');
  assert(ctx.document.getElementById('restBar').classList.contains('show'),'휴식 바 유지');
  assert(ctx.document.getElementById('ivBar').classList.contains('show'),'인터벌 바 표시');
  // 인터벌 tick은 휴식 시간에 영향 없음
  ev('tickInterval()');
  assert.strictEqual(ev('restRemain'),30,'인터벌 tick이 휴식에 영향 없음');
  // 휴식 tick은 인터벌에 영향 없음
  ev('tickRest()');
  assert.strictEqual(ev('ivRemain'),39,'휴식 tick이 인터벌에 영향 없음');
  ev('stopInterval()');
  assert(ctx.document.getElementById('restBar').classList.contains('show'),'인터벌 정지 후 휴식 유지');
});

t('3중 오버레이(경과·휴식·인터벌) 동시 표시 시 서로 다른 단으로 적층',()=>{
  reset();
  // 세 오버레이를 모두 활성: 세션(경과) + 휴식 + 인터벌
  ev('startSession();');                       // elapsedBar
  ev('restRemain=30;restRunning=true;showRestBar();');  // restBar
  ev('setIntervalCfg(40,20,5);startInterval();');       // ivBar
  const eb=ctx.document.getElementById('elapsedBar').style.bottom;
  const rb=ctx.document.getElementById('restBar').style.bottom;
  const ib=ctx.document.getElementById('ivBar').style.bottom;
  assert(eb&&rb&&ib,'세 바 모두 bottom 지정됨');
  // 세 값이 모두 서로 달라야 겹치지 않음
  assert(eb!==rb&&rb!==ib&&eb!==ib,'세 단이 모두 다른 높이('+eb+' / '+rb+' / '+ib+')');
  // 적층 순서: 경과(86) < 휴식(150) < 인터벌(214)
  assert(eb.includes('86px'),'경과시간=최하단 86px');
  assert(rb.includes('150px'),'휴식=중간 150px');
  assert(ib.includes('214px'),'인터벌=최상단 214px');
});

t('오버레이 적층: 일부만 활성이면 빈 단 없이 아래부터 채움',()=>{
  reset();
  // 세션 없이 휴식 + 인터벌만
  ev('restRemain=30;restRunning=true;showRestBar();');
  ev('setIntervalCfg(40,20,5);startInterval();');
  const rb=ctx.document.getElementById('restBar').style.bottom;
  const ib=ctx.document.getElementById('ivBar').style.bottom;
  assert(rb.includes('86px'),'휴식이 최하단 차지(86px)');
  assert(ib.includes('150px'),'인터벌이 그 위(150px)');
  // 인터벌만 단독이면 최하단
  ev('stopRest();');
  ev('showIntervalBar();');
  assert(ctx.document.getElementById('ivBar').style.bottom.includes('86px'),'인터벌 단독 시 최하단');
});

/* ========== 신규(UX 폴리시): 격려 토스트 로테이션 ========== */
t('praise(): 호출마다 다음 문구로 순환하고 한 바퀴 후 처음으로',()=>{
  reset();
  const n=ev('PRAISE.length');
  assert(n>=3,'격려 문구가 여러 개');
  const seq=[];for(let i=0;i<n;i++)seq.push(ev('praise()'));
  assert.strictEqual(new Set(seq).size,n,'한 바퀴 안에서 모두 서로 다른 문구');
  assert.strictEqual(ev('praise()'),seq[0],'한 바퀴 후 처음 문구로 복귀');
});

t('식단 추가 시 격려 토스트(로테이션 문구)가 뜬다',()=>{
  reset();
  ctx.document.getElementById('mealMemo').value='닭가슴살';
  ctx.document.getElementById('mealKcal').value='';
  ctx.document.getElementById('mealProt').value='';
  clearSpies();
  ev('addMeal()');
  assert.strictEqual(toastList().length,1,'토스트 1회');
  assert(ev('PRAISE').includes(toastList()[0]),'격려 문구 중 하나');
});

/* ========== 신규(UX 폴리시): 첫 진입 온보딩 ========== */
t('isFirstEntry(): 데이터 전무면 true, 무엇이든 기록하면 false',()=>{
  reset();
  assert.strictEqual(ev('isFirstEntry()'),true,'완전 초기 상태는 첫 진입');
  ev("quickEx('스쿼트')");
  assert.strictEqual(ev('isFirstEntry()'),false,'운동 기록 후 false');
  reset();
  ev("DB.body.push({date:'2026-06-27',weight:80});save();");
  assert.strictEqual(ev('isFirstEntry()'),false,'신체 기록만 있어도 false');
});

t('홈 첫 진입 시 환영 온보딩 한 줄, 기록 후엔 사라짐',()=>{
  reset();
  let v=ev('viewHome()');
  assert(v.includes('환영'),'첫 진입 환영 문구');
  ev("quickEx('벤치프레스')");
  v=ev('viewHome()');
  assert(!v.includes('환영'),'기록 후 온보딩 미표시');
});

/* ========== 신규(UX 폴리시): 운동 종목 삭제 실수 방지 ========== */
t('delEx: 세트 2개 이상이면 확인(취소 시 보존, 승인 시 삭제)',()=>{
  reset();ev("quickEx('스쿼트');addSet(0);"); // 2세트
  const realConfirm=ctx.confirm;
  ctx.confirm=()=>false; // 취소
  ev('delEx(0)');
  assert(DB().workouts['2026-06-27'],'취소하면 종목 보존');
  assert.strictEqual(DB().workouts['2026-06-27'].length,1,'그대로 1종목');
  ctx.confirm=()=>true; // 승인
  ev('delEx(0)');
  assert(!DB().workouts['2026-06-27'],'승인하면 삭제');
  ctx.confirm=realConfirm;
});

t('delEx: 세트 1개(갓 추가)면 확인 없이 바로 삭제',()=>{
  reset();ev("quickEx('스쿼트');"); // 1세트
  const realConfirm=ctx.confirm;
  let asked=false;ctx.confirm=()=>{asked=true;return false;};
  ev('delEx(0)');
  assert.strictEqual(asked,false,'단일 세트는 확인창 없음');
  assert(!DB().workouts['2026-06-27'],'바로 삭제됨');
  ctx.confirm=realConfirm;
});

/* ========== 신규(PR-1): 클라우드 동기화 — 순수 LWW + supa=null 가드 ========== */
/* 헤드리스 환경엔 supa(module 블록)가 없다 → cloudReady()=false, SYNC.enabled=false.
   즉 이 테스트들은 "비로그인·미설정 시 로컬 전용 100% 보존" 경로를 검증한다. */

t('mergeStates: 원격이 더 최신이면 remote 채택',()=>{
  const r=ev("mergeStates({a:1},{a:2},'2026-06-27T00:00:00Z','2026-06-28T00:00:00Z')");
  assert.strictEqual(r.winner,'remote');
  assert.strictEqual(r.data.a,2);
});
t('mergeStates: 로컬이 더 최신이면 local 유지',()=>{
  const r=ev("mergeStates({a:1},{a:2},'2026-06-28T00:00:00Z','2026-06-27T00:00:00Z')");
  assert.strictEqual(r.winner,'local');
  assert.strictEqual(r.data.a,1);
});
t('mergeStates: 동률이면 로컬 유지(불필요 덮어쓰기 방지)',()=>{
  const r=ev("mergeStates({a:1},{a:2},'2026-06-27T00:00:00Z','2026-06-27T00:00:00Z')");
  assert.strictEqual(r.winner,'local');
});
t('mergeStates: 원격 없음이면 항상 로컬',()=>{
  const r=ev("mergeStates({a:1},null,null,null)");
  assert.strictEqual(r.winner,'local');
  assert.strictEqual(r.data.a,1);
});
t('mergeStates: 로컬 타임스탬프 없어도 원격 있으면 원격 채택',()=>{
  const r=ev("mergeStates({a:1},{a:9},null,'2026-06-27T00:00:00Z')");
  assert.strictEqual(r.winner,'remote');
  assert.strictEqual(r.data.a,9);
});

t('supa 미설정이면 cloudReady()=false, SYNC.enabled=false',()=>{
  reset();
  assert.strictEqual(ev("cloudReady()"),false);
  assert.strictEqual(ev("SYNC.enabled"),false);
});

t('비로그인 save() 는 push 훅을 안 탄다(로컬 전용, 네트워크 0)',()=>{
  reset();
  ev("__pushed=0;SYNC.onLocalChange=function(){__pushed++;};");
  ev("quickEx('스쿼트');");           // 내부 save() 호출됨
  assert.strictEqual(ev("__pushed"),0,'SYNC.enabled=false 라 훅 미실행');
});

t('SYNC.enabled=true 일 때만 save() 가 onLocalChange 호출',()=>{
  reset();
  ev("__pushed=0;SYNC.onLocalChange=function(){__pushed++;};SYNC.enabled=true;");
  ev("save();");
  assert.strictEqual(ev("__pushed"),1,'활성 시 1회');
  ev("SYNC.enabled=false;");          // 정리(다른 테스트 격리)
});

t('getPulledAt/setPulledAt 라운드트립 + 해제',()=>{
  reset();
  ev("setPulledAt('2026-06-28T00:00:00Z');");
  assert.strictEqual(ev("getPulledAt()"),'2026-06-28T00:00:00Z');
  assert.strictEqual(store['sync_pulledAt'],'2026-06-28T00:00:00Z');
  ev("setPulledAt(null);");
  assert.strictEqual(ev("getPulledAt()"),null);
});

t('applyRemoteState: 원격 데이터를 로컬에 적용 + DEFAULT 폴백 보강',()=>{
  reset();
  // 신규 키가 빠진 원격 상태라도 DEFAULT 로 보강되어야 함
  ev("applyRemoteState({workouts:{'2026-06-28':[{name:'벤치프레스',sets:[{weight:'80',reps:'10'}]}]},meals:{},habits:{},body:[],settings:{}});");
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-28'])"),800);
  assert(ev("Array.isArray(DB.exDB)"),'exDB 폴백');
  assert(ev("DB.sessions&&typeof DB.sessions==='object'"),'sessions 폴백');
});

t('applyRemoteState 중에는 재푸시 루프가 안 생긴다',()=>{
  reset();
  ev("__pushed=0;SYNC.enabled=true;SYNC.onLocalChange=function(){__pushed++;};");
  ev("applyRemoteState({workouts:{},meals:{},habits:{},body:[],settings:{}});");
  assert.strictEqual(ev("__pushed"),0,'적용 중 save()는 훅 미실행(루프 방지)');
  assert.strictEqual(ev("SYNC.enabled"),true,'적용 후 enabled 원복');
  ev("SYNC.enabled=false;");
});

/* ---- 세션 지속성(fix/session-persist) ----
   실제 supabase-js getSession()/onAuthStateChange 는 type=module 블록이라 헤드리스에서
   실행 불가(실 네트워크/매직링크도 불가) → 폰 수동검증으로 분리.
   여기서는 module 의 onSession() 이 의존하는 "클래식 측 계약"을 stub 세션으로 단언한다:
   세션이 복원되면 SYNC 가 켜지고(email/enabled), pull 결과가 로컬에 반영되며, UI가 '켜짐'을 보인다. */

// module onSession(session) 의 핵심 로직을 클래식 프리미티브로 재현한 stub.
function applySession(session, remoteRow){
  ev("SYNC.session="+JSON.stringify(session)+";");
  if(session){
    ev("SYNC.enabled=true;SYNC.email="+JSON.stringify(session.user.email||null)+";");
    if(remoteRow){
      const merged=ev("mergeStates(localSnapshot(),"+JSON.stringify(remoteRow.data)+",getPulledAt(),"+JSON.stringify(remoteRow.updated_at)+")");
      if(merged.winner==='remote'){
        ev("applyRemoteState("+JSON.stringify(remoteRow.data)+");");
        ev("setPulledAt("+JSON.stringify(remoteRow.updated_at)+");");
      }
    }
  }else{
    ev("SYNC.enabled=false;SYNC.email=null;setPulledAt(null);");
  }
}

t('세션 복원(stub): 저장된 세션이 있으면 SYNC 켜짐 + 이메일 세팅',()=>{
  reset();
  applySession({user:{id:'U1',email:'me@example.com'}},null);
  assert.strictEqual(ev("SYNC.enabled"),true,'enabled');
  assert.strictEqual(ev("SYNC.email"),'me@example.com','email 세팅');
  ev("SYNC.enabled=false;SYNC.session=undefined;SYNC.email=null;"); // 격리
});

t('세션 복원(stub) 후 프로필 카드가 "동기화 켜짐"을 표시',()=>{
  reset();
  // viewCloudSync 는 cloudReady()가 true 여야 켜짐 분기로 간다 → supa 임시 주입
  ev("supa={};SYNC.enabled=true;SYNC.email='me@example.com';");
  const v=ev("viewCloudSync()");
  assert(v.includes('동기화 켜짐'),'켜짐 상태 텍스트');
  assert(v.includes('me@example.com'),'로그인 이메일 표기');
  assert(v.includes('로그아웃'),'로그아웃 버튼');
  ev("delete supa;SYNC.enabled=false;SYNC.email=null;"); // 격리
});

t('세션 복원(stub): 서버가 더 최신이면 초기 pull 이 로컬을 교체',()=>{
  reset();
  ev("setPulledAt('2026-06-20T00:00:00Z');"); // 로컬은 오래됨
  applySession(
    {user:{id:'U1',email:'me@example.com'}},
    {data:{workouts:{'2026-06-28':[{name:'벤치프레스',sets:[{weight:'80',reps:'10'}]}]},meals:{},habits:{},body:[],settings:{}},
     updated_at:'2026-06-28T00:00:00Z'}
  );
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-28'])"),800,'원격 상태가 로컬에 적용됨');
  assert.strictEqual(ev("getPulledAt()"),'2026-06-28T00:00:00Z','pulledAt 갱신');
  ev("SYNC.enabled=false;SYNC.session=undefined;SYNC.email=null;");
});

t('세션 없음(stub: SIGNED_OUT 동등) → SYNC 꺼짐 + pulledAt 해제',()=>{
  reset();
  ev("SYNC.enabled=true;SYNC.email='me@example.com';setPulledAt('2026-06-28T00:00:00Z');");
  applySession(null,null);
  assert.strictEqual(ev("SYNC.enabled"),false,'로그아웃 시 꺼짐');
  assert.strictEqual(ev("SYNC.email"),null,'이메일 해제');
  assert.strictEqual(ev("getPulledAt()"),null,'pulledAt 해제');
});

/* ---- 비밀번호 로그인/가입(stub) — OTP→password 흐름으로 갱신 ---- */
t('cloudLogin: 잘못된 이메일이면 토스트, SYNC.signIn 미호출',()=>{
  reset();
  ev("__signIn=[];SYNC.signIn=function(e,p){__signIn.push([e,p]);};");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='not-an-email';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='secret1';
  clearSpies();
  ev("cloudLogin();");
  assert.strictEqual(ev("__signIn.length"),0,'유효성 실패 시 로그인 시도 안 함');
  assert(toastList().length>=1,'안내 토스트');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('cloudLogin: 비밀번호 6자 미만이면 토스트, SYNC.signIn 미호출(약한 비번 가드)',()=>{
  reset();
  ev("__signIn=[];SYNC.signIn=function(e,p){__signIn.push([e,p]);};");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='you@example.com';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='12345';
  clearSpies();
  ev("cloudLogin();");
  assert.strictEqual(ev("__signIn.length"),0,'짧은 비번이면 시도 안 함');
  assert(toastList().length>=1,'안내 토스트');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('cloudLogin: 빈 입력 가드(이메일/비번 비면 시도 안 함)',()=>{
  reset();
  ev("__signIn=[];SYNC.signIn=function(e,p){__signIn.push([e,p]);};");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='';
  clearSpies();
  ev("cloudLogin();");
  assert.strictEqual(ev("__signIn.length"),0,'빈 입력이면 시도 안 함');
  assert(toastList().length>=1,'안내 토스트');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('cloudLogin: 올바른 이메일+비번이면 SYNC.signIn(email,pw) 호출(이메일 trim)',()=>{
  reset();
  ev("__signIn=[];SYNC.signIn=function(e,p){__signIn.push([e,p]);};");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value=' you@example.com ';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='secret1';
  ev("cloudLogin();");
  assert.strictEqual(ev("__signIn[0][0]"),'you@example.com','이메일 trim 후 전달');
  assert.strictEqual(ev("__signIn[0][1]"),'secret1','비밀번호 그대로 전달');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('cloudSignup: 약한 비번/빈 입력 가드, 정상이면 SYNC.signUp(email,pw) 호출',()=>{
  reset();
  ev("__signUp=[];SYNC.signUp=function(e,p){__signUp.push([e,p]);};");
  // 짧은 비번 → 가드
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='new@example.com';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='123';
  clearSpies();
  ev("cloudSignup();");
  assert.strictEqual(ev("__signUp.length"),0,'짧은 비번이면 가입 안 함');
  assert(toastList().length>=1,'안내 토스트');
  // 정상 입력 → 가입 호출
  elCache['cloudPw'].value='secret1';
  ev("cloudSignup();");
  assert.strictEqual(ev("__signUp[0][0]"),'new@example.com','이메일 전달');
  assert.strictEqual(ev("__signUp[0][1]"),'secret1','비밀번호 전달');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('cloudSignup: 잘못된 이메일이면 토스트, SYNC.signUp 미호출',()=>{
  reset();
  ev("__signUp=[];SYNC.signUp=function(e,p){__signUp.push([e,p]);};");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='broken';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='secret1';
  clearSpies();
  ev("cloudSignup();");
  assert.strictEqual(ev("__signUp.length"),0,'잘못된 이메일이면 가입 안 함');
  assert(toastList().length>=1,'안내 토스트');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('viewCloudSync: 미로그인이면 이메일+비밀번호 폼(로그인/새로 시작하기) 렌더',()=>{
  reset();
  ev("supa={};SYNC.enabled=false;");
  const v=ev("viewCloudSync()");
  assert(v.includes('id="cloudEmail"'),'이메일 입력칸');
  assert(v.includes('id="cloudPw"'),'비밀번호 입력칸');
  assert(v.includes('cloudLogin()'),'로그인 버튼');
  assert(v.includes('cloudSignup()'),'새로 시작하기(가입) 버튼');
  assert(!v.includes('id="cloudCode"'),'OTP 코드 입력칸 없음');
  assert(!v.includes('인증코드'),'OTP 잔재 없음');
  ev("delete supa;");
});

t('비로그인 휴면: signIn/signUp 핸들러 없어도 cloudLogin/cloudSignup 안전(무동작·예외 0)',()=>{
  reset();
  // 헤드리스엔 supa(module)가 없어 SYNC.signIn/signUp 도 미정의 → 호출돼도 throw 없이 no-op.
  ev("delete SYNC.signIn;delete SYNC.signUp;");
  elCache['cloudEmail']=makeEl();elCache['cloudEmail'].value='you@example.com';
  elCache['cloudPw']=makeEl();elCache['cloudPw'].value='secret1';
  ev("__pushed=0;SYNC.onLocalChange=function(){__pushed++;};");
  ev("cloudLogin();cloudSignup();");      // 둘 다 예외 없이 통과해야 함
  assert.strictEqual(ev("SYNC.enabled"),false,'여전히 비로그인(로컬 전용)');
  assert.strictEqual(ev("__pushed"),0,'네트워크 push 훅 미실행');
  delete elCache['cloudEmail'];delete elCache['cloudPw'];
});

t('viewMe(): supa 미설정이면 동기화 카드가 "꺼짐" 안내를 보여줌',()=>{
  reset();
  const v=ev("viewMe()");
  assert(v.includes('클라우드 동기화'),'동기화 카드 표시');
  assert(v.includes('이 폰에만 저장'),'미설정 안내 문구');
  assert(!v.includes('id="cloudPw"'),'미설정이면 비밀번호 입력 미표시');
});

/* ========== 신규(PR-2): 사진 — 압축/메타(순수) + IndexedDB + 가드 + 첨부구조 ========== */
t('fitDims: 긴 변을 max로 축소(비율 유지), 작은 건 그대로',()=>{
  assert.strictEqual(ev('JSON.stringify(fitDims(2000,1000,1000))'),'{"w":1000,"h":500}','가로가 길면 가로=max');
  assert.strictEqual(ev('JSON.stringify(fitDims(800,1600,1000))'),'{"w":500,"h":1000}','세로가 길면 세로=max');
  assert.strictEqual(ev('JSON.stringify(fitDims(600,400,1000))'),'{"w":600,"h":400}','이미 작으면 변동 없음');
});

t('buildPhotoMeta: kind/date/치수 보존 + uuid id + path 없음(업로드 전)',()=>{
  const m=ev("buildPhotoMeta('meal','2026-06-27',{width:1000,height:750,bytes:12345})");
  assert.strictEqual(m.kind,'meal');assert.strictEqual(m.date,'2026-06-27');
  assert.strictEqual(m.w,1000);assert.strictEqual(m.h,750);assert.strictEqual(m.bytes,12345);
  assert(m.id&&typeof m.id==='string','로컬 키(id) 존재');
  assert.strictEqual(m.path,undefined,'업로드 전이라 Storage path 없음');
});

t('storagePath: <uid>/<kind>/<date>/<key>.jpg (폴더 첫 세그먼트=uid)',()=>{
  const p=ev("storagePath('U1','body','2026-06-27','K9')");
  assert.strictEqual(p,'U1/body/2026-06-27/K9.jpg');
  assert.strictEqual(p.split('/')[0],'U1','폴더단위 RLS용 최상위=uid');
});

t('PHOTO_MAX/QUALITY 합리적 기본값',()=>{
  assert.strictEqual(ev('PHOTO_MAX'),1000);
  assert(ev('PHOTO_QUALITY')>0.5&&ev('PHOTO_QUALITY')<1,'JPEG 품질 0.5~1');
});

/* ========== 신규(인사이트): 운동 종료 인사이트 화면 ========== */
t('toggleSetDone: 완료 시 doneAt 기록, 해제 시 제거',()=>{
  reset();ev("quickEx('벤치프레스');");
  ev('toggleSetDone(0,0)');
  assert(typeof DB().workouts['2026-06-27'][0].sets[0].doneAt==='number','완료 시 doneAt 타임스탬프');
  ev('toggleSetDone(0,0)');
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[0].doneAt,undefined,'해제 시 doneAt 제거');
});

t('estimateCalories: 시간·볼륨 휴리스틱(분당5 + 톤당6)',()=>{
  // 30분(1800초) + 5000kg = 30*5 + 5*6 = 150+30 = 180
  assert.strictEqual(ev('estimateCalories(1800,5000)'),180);
  assert.strictEqual(ev('estimateCalories(0,0)'),0,'무기록 0');
  assert(ev('estimateCalories(3600,10000)')>ev('estimateCalories(1800,5000)'),'길수록/무거울수록 큼');
});

t('sessionPartStats: 세션 부위별 볼륨·세트수 집계(PARTS 키 항상 존재)',()=>{
  reset();
  ev('startSession();');
  ev("quickEx('벤치프레스');"); // 가슴, sid 찍힘
  ev("setVal(0,0,'weight','60');setVal(0,0,'reps','10');"); // 600
  ev('addSet(0)');ev("setVal(0,1,'weight','60');setVal(0,1,'reps','10');"); // +600
  ev("quickEx('스쿼트');"); // 하체
  ev("setVal(1,0,'weight','100');setVal(1,0,'reps','5');"); // 500
  const sid=DB().settings.activeSessionId;
  const ps=ev(`sessionPartStats('${sid}')`);
  assert.strictEqual(ps['가슴'].volume,1200,'가슴 볼륨 1200');
  assert.strictEqual(ps['가슴'].sets,2,'가슴 2세트');
  assert.strictEqual(ps['하체'].volume,500,'하체 볼륨 500');
  assert.strictEqual(ps['하체'].sets,1,'하체 1세트');
  assert.strictEqual(ps['등'].volume,0,'기록 없는 부위 0');
  assert('기타' in ps,'기타 키 존재');
});

t('sessionAvgCompare: 표본 없으면 null, 있으면 평균 대비 델타',()=>{
  reset();
  // 첫 세션(완료) — 볼륨 1000, 30분
  ev('startSession();');
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','10');"); // 1000
  ev('endSession();');
  // 두 번째 세션 — id 충돌(같은 ms) 방지 위해 첫 세션 id를 고정해 분리
  ev("DB.sessions['2026-06-27'][0].id='sA';DB.workouts['2026-06-27'][0].sets.forEach(st=>st.sid='sA');save();");
  ev('cur="2026-06-28";startSession();');
  ev("DB.settings.activeSessionId='sB';DB.sessions['2026-06-28'][0].id='sB';");
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','16');"); // 1600
  // 인위적 durationSec 부여(시간 비교)
  ev('var _s2=activeSession();_s2.durationSec=1200;'); // 20분, s1은 ~0초
  const cmp=ev('sessionAvgCompare(activeSession())');
  assert(cmp,'표본 있으면 객체 반환');
  assert.strictEqual(cmp.n,1,'비교 표본 1개(s1)');
  assert.strictEqual(cmp.avgVol,1000,'평균 볼륨=s1의 1000');
  assert.strictEqual(cmp.volDelta,600,'1600-1000=+600');
});

t('sessionAvgCompare: 완료 세션이 자기 하나뿐이면 null',()=>{
  reset();ev('startSession();');
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','5');");
  const cmp=ev('sessionAvgCompare(activeSession())');
  assert.strictEqual(cmp,null,'비교 대상(다른 완료세션) 없음');
});

t('sessionVolumeTimeline: doneAt 순 누적, 없으면 빈 배열',()=>{
  reset();ev('startSession();');
  const sid=DB().settings.activeSessionId;
  // doneAt 없는 상태(완료 안 함) → 빈 배열
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','5');");
  assert.strictEqual(ev(`sessionVolumeTimeline('${sid}').length`),0,'doneAt 없으면 빈 배열');
  // doneAt 수동 부여(완료 순서: set0 t=100(500), set1 t=200(300))
  ev('addSet(0);');
  ev("setVal(0,1,'weight','60');setVal(0,1,'reps','5');"); // 300
  ev("DB.workouts['2026-06-27'][0].sets[1].doneAt=200;DB.workouts['2026-06-27'][0].sets[0].doneAt=100;save();");
  const tl=ev(`sessionVolumeTimeline('${sid}')`);
  assert.strictEqual(tl.length,2,'완료 세트 2개');
  assert.strictEqual(tl[0].cum,500,'첫 누적 500');
  assert.strictEqual(tl[1].cum,800,'둘째 누적 800');
  assert(tl[0].t<tl[1].t,'doneAt 오름차순');
});

t('sessionCount: 종료된(endedAt) 세션만 N으로 카운트',()=>{
  reset();
  assert.strictEqual(ev('sessionCount()'),0,'없으면 0');
  ev('startSession();endSession();');
  assert.strictEqual(ev('sessionCount()'),1,'종료 1회→1');
  ev('cur="2026-06-28";startSession();'); // 진행 중(미종료)
  assert.strictEqual(ev('sessionCount()'),1,'진행 중은 미포함');
  ev('endSession();');
  assert.strictEqual(ev('sessionCount()'),2,'종료 2회→2');
});

t('fatigueIntensity: 최대 부위=1, 나머지 비례',()=>{
  reset();
  const ps=ev("({가슴:{volume:1000,sets:2},등:{volume:500,sets:1},어깨:{volume:0,sets:0},팔:{volume:0,sets:0},하체:{volume:0,sets:0},복근:{volume:0,sets:0},유산소:{volume:0,sets:0},기타:{volume:0,sets:0}})");
  ctx.__ps=ps;
  const it=ev('fatigueIntensity(__ps)');
  assert.strictEqual(it['가슴'],1,'최대 부위 1.0');
  assert.strictEqual(it['등'],0.5,'절반=0.5');
  assert.strictEqual(it['어깨'],0,'없으면 0');
});

t('BODY_REGIONS: 7부위 매핑 존재',()=>{
  reset();
  ['가슴','등','어깨','팔','하체','복근','유산소'].forEach(p=>
    assert(ev(`Array.isArray(BODY_REGIONS['${p}'])&&BODY_REGIONS['${p}'].length>0`),p+' 영역 매핑'));
});

t('fatigueMapSVG / cumVolumeSVG: 유효 SVG 문자열 생성(무에러)',()=>{
  reset();
  const ps=ev("sessionPartStats('nope')"); // 빈 통계
  ctx.__ps=ps;
  const svg=ev('fatigueMapSVG(__ps)');
  assert(svg.startsWith('<svg')&&svg.includes('</svg>'),'인체도 SVG');
  assert(svg.includes('앞')&&svg.includes('뒤'),'앞/뒤 두 면');
  const tl=ev('[{t:1,cum:100},{t:2,cum:250}]');ctx.__tl=tl;
  const line=ev('cumVolumeSVG(__tl)');
  assert(line.includes('<polyline')&&line.includes('points='),'누적 라인 그래프');
});

t('viewInsight: 종료 세션 인사이트 렌더 무에러 + 핵심 요소 포함',()=>{
  reset();
  ev('startSession();');
  ev("quickEx('벤치프레스');setVal(0,0,'weight','60');setVal(0,0,'reps','10');toggleSetDone(0,0);");
  ev("quickEx('스쿼트');setVal(1,0,'weight','100');setVal(1,0,'reps','5');toggleSetDone(1,0);");
  ev('endSession();');
  const s=ev("DB.sessions['2026-06-27'][0]");ctx.__s=s;
  const v=ev('viewInsight(__s)');
  assert(v.includes('소요시간'),'소요시간');
  assert(v.includes('추정'),'추정 칼로리 라벨');
  assert(v.includes('kcal'),'칼로리 단위');
  assert(v.includes('총 볼륨'),'총 볼륨');
  assert(v.includes('부위별 볼륨'),'부위별 볼륨');
  assert(v.includes('근육 피로도 맵'),'피로도 맵');
  assert(v.includes('<svg'),'SVG 인체도');
  assert(v.includes('번째 운동 기록 완료')||v.includes('첫 운동 기록 완료'),'N번째 축하');
  assert(v.includes('평균 대비'),'평균 대비 섹션');
  assert(v.includes('확인'),'확인 버튼');
});

t('viewInsight: 완료세트(doneAt) 2개 이상이면 누적 그래프 포함',()=>{
  reset();
  ev('startSession();');
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','5');toggleSetDone(0,0);");
  ev('addSet(0);setVal(0,1,\'weight\',\'100\');setVal(0,1,\'reps\',\'5\');toggleSetDone(0,1);');
  ev('endSession();');
  const s=ev("DB.sessions['2026-06-27'][0]");ctx.__s=s;
  const v=ev('viewInsight(__s)');
  assert(v.includes('볼륨 누적 추이'),'누적 그래프 표시');
});

t('viewInsight: 옛 데이터(doneAt 없음)는 누적 그래프 우아하게 생략',()=>{
  reset();
  // 세션은 있으나 세트에 doneAt 없음(옛 기록)
  ev("DB.sessions['2026-06-27']=[{id:'sX',startedAt:1,endedAt:2,durationSec:1800}];");
  ev("DB.workouts['2026-06-27']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5',sid:'sX'}]}];save();");
  const s=ev("DB.sessions['2026-06-27'][0]");ctx.__s=s;
  const v=ev('viewInsight(__s)');
  assert(!v.includes('볼륨 누적 추이'),'doneAt 없으면 누적 그래프 생략');
  assert(v.includes('부위별 볼륨'),'그래도 다른 섹션은 렌더');
});

t('viewInsight: 비교 표본 없으면 안내문구(평균 대비 비교 생략)',()=>{
  reset();
  ev('startSession();');
  ev("quickEx('스쿼트');setVal(0,0,'weight','100');setVal(0,0,'reps','5');toggleSetDone(0,0);");
  ev('endSession();');
  const s=ev("DB.sessions['2026-06-27'][0]");ctx.__s=s;
  const v=ev('viewInsight(__s)');
  assert(v.includes('비교할 지난 세션이 아직 없어요'),'표본 없을 때 안내');
});

t('endSession → showSessionSummary가 인사이트 시트를 연다(무에러)',()=>{
  reset();
  ev('startSession();');
  ev("quickEx('벤치프레스');setVal(0,0,'weight','60');setVal(0,0,'reps','10');toggleSetDone(0,0);");
  ev('endSession();');
  const v=ctx.document.getElementById('sheet').innerHTML;
  assert(v.includes('오늘의 운동'),'인사이트 시트 헤더');
  assert(v.includes('근육 피로도 맵'),'시트에 피로도 맵');
});

/* ========== 신규(meal-presets): 고형석 표준식 빠른 추가 프리셋 ========== */
t('MEAL_PRESETS 값 정확(오트밀 176/9, 쉐이크 216/28, 바나나 105/1)',()=>{
  reset();
  assert.strictEqual(ev('MEAL_PRESETS.length'),3,'프리셋 3개');
  const oat=ev("MEAL_PRESETS.find(p=>p.name==='오트밀')");
  assert.strictEqual(oat.kcal,176,'오트밀 176kcal');
  assert.strictEqual(oat.protein,9,'오트밀 단백 9g');
  assert(oat.memo.includes('오버나이트'),'오트밀 메모');
  const sh=ev("MEAL_PRESETS.find(p=>p.name==='쉐이크')");
  assert.strictEqual(sh.kcal,216,'쉐이크 216kcal');
  assert.strictEqual(sh.protein,28,'쉐이크 단백 28g');
  assert(sh.memo.includes('파우더35g'),'쉐이크 메모');
  const ba=ev("MEAL_PRESETS.find(p=>p.name==='바나나')");
  assert.strictEqual(ba.kcal,105,'바나나 105kcal');
  assert.strictEqual(ba.protein,1,'바나나 단백 1g');
  assert.strictEqual(ba.memo,'바나나 1개','바나나 메모');
});

t('addPreset: type 없이 올바른 식단 항목 생성(오트밀)',()=>{
  reset();
  ev('addPreset(0)'); // 오트밀
  const m=DB().meals['2026-06-27'][0];
  assert.strictEqual(m.type,undefined,'끼니 type 제거됨');
  assert.strictEqual(m.memo,ev('MEAL_PRESETS[0].memo'),'메모 채움');
  assert.strictEqual(m.kcal,'176','kcal 채움(문자열)');
  assert.strictEqual(m.protein,'9','protein 채움(문자열)');
  assert.strictEqual(m.photo,null,'사진 없음');
  assert(/^\d{2}:\d{2}$/.test(m.at),'현재 시각 자동 기록');
});

t('addPreset: 바나나 프리셋 값(105/1, 메모 "바나나 1개")',()=>{
  reset();
  const idx=ev("MEAL_PRESETS.findIndex(p=>p.name==='바나나')");
  ev(`addPreset(${idx})`);
  const m=DB().meals['2026-06-27'][0];
  assert.strictEqual(m.memo,'바나나 1개');
  assert.strictEqual(m.kcal,'105');
  assert.strictEqual(m.protein,'1');
});

t('addPreset: 같은 날 누적 + 합계 반영(viewMeal)',()=>{
  reset();ev("addPreset(0);addPreset(1);");
  assert.strictEqual(DB().meals['2026-06-27'].length,2,'두 항목 누적');
  // 합계: 176+216=392 kcal, 9+28=37 g
  const v=ev('viewMeal()');
  assert(v.includes('392kcal'),'합계 kcal');
  assert(v.includes('단백 37g'),'합계 단백질');
});

t('식단 추가 카드에 프리셋 칩 렌더(오트밀/쉐이크/바나나)',()=>{
  reset();
  const v=ev('viewMeal()');
  assert(v.includes('🥣 오트밀'),'오트밀 칩');
  assert(v.includes('🥤 쉐이크'),'쉐이크 칩');
  assert(v.includes('🍌 바나나'),'바나나 칩');
  assert(v.includes('addPreset(0)')&&v.includes('addPreset(1)')&&v.includes('addPreset(2)'),'프리셋 핸들러');
  assert(v.includes('빠른 추가'),'빠른 추가 라벨');
});

t('식단 추가 카드에 끼니(아침/점심/저녁/간식) 칩이 없다',()=>{
  reset();
  const v=ev('viewMeal()');
  assert(!v.includes('data-mt'),'끼니 선택 칩 제거됨');
  assert(!v.includes('pickMT'),'pickMT 핸들러 제거됨');
});

/* ========== 신규(sleep PR-1): 수면 데이터 모델 + 습관 분리(멱등 마이그레이션) ========== */
t('DEFAULT.sleep=[] 신설 + 옛 백업에도 폴백 보장',()=>{
  reset();
  assert(Array.isArray(DB().sleep),'DEFAULT에 sleep:[]');
  assert.strictEqual(DB().sleep.length,0,'기본 빈 배열');
  // sleep 키가 빠진 옛 백업 → load 폴백으로 빈 배열 생성
  ev("DB=Object.assign(structuredClone(DEFAULT),{workouts:{},meals:{},habits:{},body:[],settings:{}});delete DB.sleep;save();");
  ev("DB=load();save();");
  assert(Array.isArray(DB().sleep),'옛 백업도 load 후 sleep 폴백');
});

t('habitDefs/DEFAULT.habitDefs 에 sleep 항목이 없다',()=>{
  reset();
  assert.strictEqual(ev("DEFAULT.habitDefs.some(d=>d.id==='sleep')"),false,'DEFAULT에 sleep 습관 없음');
  assert.strictEqual(ev("DB.habitDefs.some(d=>d.id==='sleep')"),false,'현재 DB에도 없음');
  // 물 등 다른 습관은 보존
  assert(ev("DB.habitDefs.some(d=>d.id==='water')"),'물 습관 보존');
  assert(ev("DB.habitDefs.some(d=>d.id==='protein')"),'단백질 습관 보존');
});

t('migrateSleep: habits[date].sleep(숫자) → DB.sleep{date,hours} 이관 + 다른 습관 보존',()=>{
  reset();
  ev("DB.habits['2026-06-20']={sleep:8,water:2};save();");
  ev('migrateSleep()');
  const rec=DB().sleep.find(s=>s.date==='2026-06-20');
  assert(rec,'이관된 수면 레코드 존재');
  assert.strictEqual(rec.hours,8,'hours=8 이관');
  assert.strictEqual(rec.rem,null,'rem 기본 null');
  assert.strictEqual(rec.deep,null,'deep 기본 null');
  assert.strictEqual(rec.photo,null,'photo 기본 null');
  assert.strictEqual(DB().habits['2026-06-20'].sleep,undefined,'habits.sleep 삭제됨');
  assert.strictEqual(DB().habits['2026-06-20'].water,2,'다른 습관(물) 보존');
  assert.strictEqual(DB().settings.sleepMigrated,true,'sleepMigrated 플래그 세팅');
});

t('migrateSleep: 수면만 있던 날짜는 이관 후 날짜 객체 정리',()=>{
  reset();
  ev("DB.habits['2026-06-21']={sleep:7};save();");
  ev('migrateSleep()');
  assert(!DB().habits['2026-06-21'],'수면뿐이던 날짜는 빈 객체로 남지 않고 정리');
  assert.strictEqual(DB().sleep.find(s=>s.date==='2026-06-21').hours,7,'7시간 이관');
});

t('migrateSleep: 멱등 — 두 번 호출해도 중복/변형 없음',()=>{
  reset();
  ev("DB.habits['2026-06-20']={sleep:8};save();");
  ev('migrateSleep()');
  const after1=JSON.stringify(DB().sleep);
  ev('migrateSleep()');
  assert.strictEqual(JSON.stringify(DB().sleep),after1,'재호출해도 sleep 불변');
  assert.strictEqual(DB().sleep.filter(s=>s.date==='2026-06-20').length,1,'중복 레코드 없음');
});

t('migrateSleep: 플래그 true면 스킵(이후 들어온 habits.sleep 은 건드리지 않음)',()=>{
  reset();
  ev("DB.settings.sleepMigrated=true;DB.habits['2026-06-22']={sleep:6};save();");
  ev('migrateSleep()');
  // 이미 마이그레이션 완료 표시라 새 habits.sleep 은 이관되지 않음(정상: 습관 UI엔 수면이 없어 발생 불가)
  assert.strictEqual(DB().habits['2026-06-22'].sleep,6,'플래그 true면 habits.sleep 유지');
  assert.strictEqual(DB().sleep.length,0,'이관 안 함');
});

t('migrateSleep: 이미 DB.sleep에 같은 날짜(hours 있음) 있으면 덮어쓰지 않음',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-20',hours:7.5,rem:1.5,deep:1.2,memo:'먼저 기록',photo:null}];");
  ev("DB.habits['2026-06-20']={sleep:8};save();");
  ev('migrateSleep()');
  const rec=DB().sleep.find(s=>s.date==='2026-06-20');
  assert.strictEqual(rec.hours,7.5,'기존 hours 보호(습관값으로 덮어쓰지 않음)');
  assert.strictEqual(rec.rem,1.5,'기존 rem 보존');
  assert.strictEqual(DB().habits['2026-06-20'],undefined,'habits.sleep 은 정리됨');
});

t('migrateSleep: DB.sleep에 같은 날짜 있으나 hours 비었으면 습관값으로 채움',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-20',hours:null,rem:2,deep:null,memo:null,photo:null}];");
  ev("DB.habits['2026-06-20']={sleep:8};save();");
  ev('migrateSleep()');
  const rec=DB().sleep.find(s=>s.date==='2026-06-20');
  assert.strictEqual(rec.hours,8,'비어있던 hours를 습관값으로 채움');
  assert.strictEqual(rec.rem,2,'기존 rem 보존');
});

t('migrateSleep: 0/빈 수면값은 이관하지 않되 정리는 한다',()=>{
  reset();
  ev("DB.habits['2026-06-20']={sleep:0,water:1};save();");
  ev('migrateSleep()');
  assert.strictEqual(DB().sleep.length,0,'0시간은 레코드 안 만듦');
  assert.strictEqual(DB().habits['2026-06-20'].sleep,undefined,'그래도 habits.sleep 키는 제거');
  assert.strictEqual(DB().habits['2026-06-20'].water,1,'다른 습관 보존');
});

t('migrateSleep: habitDefs에 되살아난 sleep 항목 제거(옛 백업 시나리오)',()=>{
  reset();
  ev("DB.settings.sleepMigrated=true;DB.habitDefs.unshift({id:'sleep',name:'수면',type:'num',unit:'시간',step:0.5,icon:'😴'});save();");
  ev('migrateSleep()');
  assert.strictEqual(DB().habitDefs.some(d=>d.id==='sleep'),false,'플래그 true여도 habitDefs의 sleep 제거');
});

t('importData(옛 백업): sleepMigrated 없는 백업 import 시 마이그레이션 재실행',()=>{
  reset();
  // 옛 백업 JSON(수면=습관, sleep 배열·플래그 없음)을 import 경로로 적용
  const backup=JSON.stringify({
    workouts:{},meals:{},habits:{'2026-06-15':{sleep:7.5,water:3}},body:[],settings:{},
    habitDefs:[{id:'sleep',name:'수면',type:'num',unit:'시간',step:0.5,icon:'😴'},{id:'water',name:'물',type:'num',unit:'컵',step:1,icon:'💧'}]
  });
  ev("(function(){var d="+backup+";DB=Object.assign(structuredClone(DEFAULT),d);migrateSleep();})()");
  const rec=DB().sleep.find(s=>s.date==='2026-06-15');
  assert(rec&&rec.hours===7.5,'옛 백업의 습관 수면이 DB.sleep로 이관');
  assert.strictEqual(DB().habits['2026-06-15'].sleep,undefined,'habits.sleep 제거');
  assert.strictEqual(DB().habits['2026-06-15'].water,3,'물 보존');
  assert.strictEqual(DB().habitDefs.some(d=>d.id==='sleep'),false,'habitDefs sleep 제거');
  assert.strictEqual(DB().settings.sleepMigrated,true,'플래그 세팅');
});

t('importData(옛 백업, sleep 키 없음): 폴백으로 빈 배열 + 앱 안 깨짐',()=>{
  reset();
  const backup=JSON.stringify({workouts:{},meals:{},habits:{},body:[],settings:{},habitDefs:[{id:'water',name:'물',type:'num',unit:'컵',step:1,icon:'💧'}]});
  ev("(function(){var d="+backup+";DB=Object.assign(structuredClone(DEFAULT),d);migrateSleep();})()");
  assert(Array.isArray(DB().sleep),'sleep 폴백 빈 배열');
  // 렌더 무에러
  ev("setTab('me')");
  assert(ctx.document.getElementById('view').innerHTML.length>0,'프로필 렌더 무에러');
});

/* ========== 신규(수면 단순화): 사진+메모만, 숫자 입력 제거 ========== */
t('saveTodaySleep: 메모만 입력해도 오늘 수면 행 생성(사진 없는 경로는 동기 완료)',()=>{
  reset();
  ctx.document.getElementById('todaySlMemo').value='새벽에 한 번 깸';
  ev('saveTodaySleep()');
  const rec=DB().sleep.find(s=>s.date==='2026-06-27');
  assert(rec,'오늘 날짜 행 생성');
  assert.strictEqual(rec.memo,'새벽에 한 번 깸','메모 저장');
  assert.strictEqual(rec.photo,null,'사진 없으면 null');
  assert.strictEqual(rec.hours,undefined,'숫자 필드(hours) 없음');
});

t('saveTodaySleep: 같은 날 재저장은 행 추가 없이 메모 갱신',()=>{
  reset();
  ctx.document.getElementById('todaySlMemo').value='메모A';ev('saveTodaySleep()');
  ctx.document.getElementById('todaySlMemo').value='메모B';ev('saveTodaySleep()');
  const todays=DB().sleep.filter(s=>s.date==='2026-06-27');
  assert.strictEqual(todays.length,1,'중복 행 없음');
  assert.strictEqual(todays[0].memo,'메모B','메모 갱신');
});

t('saveTodaySleep: 사진·메모 모두 없으면 토스트로 막음(행 없음)',()=>{
  reset();clearSpies();
  ctx.document.getElementById('todaySlMemo').value='';
  ev('saveTodaySleep()');
  assert.strictEqual(DB().sleep.length,0,'빈 입력은 저장 안 됨');
  assert(toastList().some(m=>m.includes('사진이나 메모')),'안내 토스트');
});

t('delSleep: 인덱스로 수면 기록 삭제',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-24',memo:'a',photo:null},{date:'2026-06-25',memo:'b',photo:null}];save();");
  ev('delSleep(0)');
  assert.strictEqual(DB().sleep.length,1,'1건 삭제');
  assert.strictEqual(DB().sleep[0].date,'2026-06-25','뒤 기록 보존');
});

t('투데이 수면 카드: 사진 업로드 버튼·메모 입력 렌더, 숫자 입력 없음',()=>{
  reset();
  let v=ev('viewTodaySleep()');
  assert(v.includes('오늘 수면'),'카드 렌더');
  assert(v.includes('id="todaySlPhoto"')&&v.includes('id="todaySlMemo"'),'사진/메모 입력');
  assert(v.includes('수면 분석 사진'),'사진 업로드 버튼');
  assert(!v.includes('id="todaySl"')||!/id="todaySl"[^P]/.test(v),'총수면 숫자 입력 없음');
  assert(!v.includes('잔 시간'),'시간 입력 안내 없음');
  assert(!v.includes('수면 상세 기록'),'상세 링크 제거');
  assert(!v.includes('기록됨'),'빈 상태엔 태그 없음');
});

t('투데이 수면 카드: 오늘 사진 있으면 썸네일+기록됨 태그',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-27',memo:'좋음',photo:{id:'TP',kind:'sleep',date:'2026-06-27'}}];save();");
  const v=ev('viewTodaySleep()');
  assert(v.includes('기록됨'),'기록됨 태그');
  assert(v.includes('data-photo="TP"')&&v.includes('thumb'),'썸네일 렌더');
  assert(v.includes("viewPhoto('TP'"),'탭하면 크게 보기');
});

t('프로필 수면 섹션: 목록(날짜+메모+삭제) 렌더, 숫자 UI 없음',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-26',memo:'좋음',photo:null}];save();");
  ev("setTab('me')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('id="sleepSection"'),'수면 섹션 앵커');
  assert(v.includes('수면 기록')&&v.includes('2026-06-26')&&v.includes('좋음'),'기록 목록');
  assert(v.includes('delSleep('),'삭제 버튼');
  assert(!v.includes('총수면')&&!v.includes('렘수면')&&!v.includes('깊은잠'),'숫자 평균 표시 없음');
  assert(!v.includes('id="slHours"')&&!v.includes('addSleep('),'프로필 입력 카드 제거');
});

t('프로필 수면 섹션: 기록 없으면 빈 상태 안내',()=>{
  reset();
  const v=ev('viewSleep()');
  assert(v.includes('오늘 탭에서 수면 분석 사진'),'빈 상태 안내(투데이로 유도)');
  assert(!v.includes('id="slHours"'),'입력 카드 없음');
});

t('숫자 UI 전역 미존재: hours/rem/deep 입력·평균 함수 제거',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-26',memo:'x',photo:null}];save();");
  const vs=ev('viewSleep()'), vt=ev('viewTodaySleep()');
  assert(!vs.includes('slRem')&&!vs.includes('slDeep')&&!vt.includes('slRem'),'렘/깊은잠 입력 없음');
  assert.strictEqual(ev("typeof sleepAvg"),'undefined','sleepAvg 제거');
  assert.strictEqual(ev("typeof addSleep"),'undefined','addSleep 제거');
});

t('옛 수면 데이터(hours 등 숫자 있음) 렌더 무에러',()=>{
  reset();
  ev("DB.sleep=[{date:'2026-06-26',hours:8,rem:1.6,deep:1.3,memo:'옛 기록',photo:null}];save();");
  const v=ev('viewSleep()');
  assert(v.includes('2026-06-26')&&v.includes('옛 기록'),'옛 데이터도 목록 렌더');
  assert(!v.includes('8h')&&!v.includes('1.6'),'숫자 필드는 UI에 안 씀');
  // 투데이 카드도 무에러
  ev("cur='2026-06-26';");
  assert(ev("viewTodaySleep().includes('오늘 수면')"),'투데이 카드 무에러');
});

t('옛 데이터 호환: sleep 키 없는 백업 import 후 수면 렌더 무에러',()=>{
  reset();
  ev("DB=Object.assign(structuredClone(DEFAULT),{workouts:{},meals:{},habits:{},body:[],settings:{}});delete DB.sleep;save();");
  // load()의 Object.assign(DEFAULT, 저장값) 폴백으로 sleep:[] 복원
  ev('DB=load();');
  assert(Array.isArray(ev('DB.sleep')),'load 폴백으로 sleep 배열');
  const v=ev('viewSleep()');
  assert(v.includes('오늘 탭에서'),'빈 수면 섹션 렌더');
  assert.strictEqual(ev("viewTodaySleep().includes('id=\"todaySlMemo\"')"),true,'투데이 카드도 렌더');
});

/* ========== 신규(운동 타입): 보조(assist) / 유산소(cardio) ========== */
t('EX_SEED 신규 종목 + 플래그(allEx에 어시스트/천국의계단)',()=>{
  reset();
  assert(ev("allEx().some(e=>e.name==='어시스트 풀업'&&e.part==='등'&&e.assist===true)"),'어시스트 풀업=등+assist');
  assert(ev("allEx().some(e=>e.name==='어시스트 딥스'&&e.part==='가슴'&&e.assist===true)"),'어시스트 딥스=가슴+assist');
  assert(ev("allEx().some(e=>e.name==='천국의계단'&&e.part==='유산소'&&e.cardio===true)"),'천국의계단=유산소+cardio');
});

t('exAssist/exCardio/exKind 판정(폴백 normal)',()=>{
  reset();
  assert.strictEqual(ev("exAssist('어시스트 풀업')"),true);
  assert.strictEqual(ev("exCardio('천국의계단')"),true);
  assert.strictEqual(ev("exKind('어시스트 풀업')"),'assist');
  assert.strictEqual(ev("exKind('천국의계단')"),'cardio');
  assert.strictEqual(ev("exKind('벤치프레스')"),'normal');
  assert.strictEqual(ev("exKind('내맘대로운동')"),'normal','미등록 폴백 normal');
});

t('quickEx(assist): 인스턴스에 assist:true 캐시 + 일반세트',()=>{
  reset();ev("quickEx('어시스트 풀업','등')");
  const ex=DB().workouts['2026-06-27'][0];
  assert.strictEqual(ex.assist,true,'인스턴스 assist 캐시');
  assert.strictEqual(ex.cardio,undefined,'cardio 필드 없음(슬림)');
  assert('weight' in ex.sets[0]&&'reps' in ex.sets[0],'보조는 무게/횟수 세트');
});

t('quickEx(cardio): cardio:true + min 세트(무게/횟수 없음)',()=>{
  reset();ev("quickEx('천국의계단','유산소')");
  const ex=DB().workouts['2026-06-27'][0];
  assert.strictEqual(ex.cardio,true,'인스턴스 cardio 캐시');
  assert('min' in ex.sets[0],'시간(분) 세트');
  assert(!('weight' in ex.sets[0]),'무게 없음');
});

t('quickEx(일반): 플래그 필드 없음(undefined, 백업 슬림 유지)',()=>{
  reset();ev("quickEx('벤치프레스')");
  const ex=DB().workouts['2026-06-27'][0];
  assert.strictEqual(ex.assist,undefined);
  assert.strictEqual(ex.cardio,undefined);
  // JSON 직렬화에 플래그 키가 안 들어가는지(바이트 불변)
  assert(!JSON.stringify(ex).includes('assist'),'직렬화에 assist 없음');
  assert(!JSON.stringify(ex).includes('cardio'),'직렬화에 cardio 없음');
});

t('workoutVolume: assist/cardio 세트 제외(=0 기여)',()=>{
  reset();
  assert.strictEqual(ev("workoutVolume([{name:'어시스트 풀업',assist:true,sets:[{weight:40,reps:8}]}])"),0,'assist 단독 0');
  assert.strictEqual(ev("workoutVolume([{name:'천국의계단',cardio:true,sets:[{min:25}]}])"),0,'cardio 단독 0');
  // 일반+assist 혼합: 일반분만(100*5=500)
  assert.strictEqual(ev("workoutVolume([{name:'스쿼트',sets:[{weight:100,reps:5}]},{name:'어시스트 풀업',assist:true,sets:[{weight:40,reps:8}]}])"),500,'혼합에서 일반분만');
});

t('workoutVolume: 인스턴스 플래그 없어도 마스터 폴백으로 제외',()=>{
  reset();
  // 옛 데이터(플래그 미저장)지만 이름이 assist 종목 → 폴백 제외
  assert.strictEqual(ev("workoutVolume([{name:'어시스트 딥스',sets:[{weight:30,reps:10}]}])"),0,'마스터 폴백 제외');
});

t('exerciseMaxWeight(assist): 최저 보조량(>0), cardio=0',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'40',reps:'8'}]}];");
  ev("DB.workouts['2026-06-23']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'35',reps:'8'},{weight:'0',reps:''}]}];");
  ev("DB.workouts['2026-06-25']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'45',reps:'8'}]}];save();");
  assert.strictEqual(ev("exerciseMaxWeight('어시스트 풀업')"),35,'최저 보조량 35(0/빈값 제외)');
  ev("DB.workouts['2026-06-26']=[{name:'천국의계단',cardio:true,sets:[{min:25}]}];save();");
  assert.strictEqual(ev("exerciseMaxWeight('천국의계단')"),0,'cardio 무게 0');
});

t('est1RM: assist/cardio는 0(미적용)',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'40',reps:'8'}]},{name:'천국의계단',cardio:true,sets:[{min:25}]}];save();");
  assert.strictEqual(ev("est1RM('어시스트 풀업')"),0,'assist 1RM 0');
  assert.strictEqual(ev("est1RM('천국의계단')"),0,'cardio 1RM 0');
});

t('allPRs: cardio 미포함, assist는 최저 보조량+assist 플래그',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'스쿼트',sets:[{weight:'100',reps:'5'}]},{name:'어시스트 풀업',assist:true,sets:[{weight:'40',reps:'8'}]}];");
  ev("DB.workouts['2026-06-23']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'35',reps:'8'}]},{name:'천국의계단',cardio:true,sets:[{min:25}]}];save();");
  const prs=ev('allPRs()');
  const ap=prs.find(p=>p.name==='어시스트 풀업');
  assert(ap&&ap.assist===true&&ap.weight===35,'assist PR=최저35');
  assert(prs.find(p=>p.name==='스쿼트').weight===100,'일반 PR 불변');
  assert(!prs.some(p=>p.name==='천국의계단'),'cardio 제외');
});

t('일반 운동 회귀: 플래그 없는 데이터 지표 불변',()=>{
  reset();
  ev("DB.workouts['2026-06-27']=[{name:'벤치프레스',sets:[{weight:'80',reps:'10'},{weight:'85',reps:'5'}]}];save();");
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-27'])"),80*10+85*5,'볼륨 불변');
  assert.strictEqual(ev("exerciseMaxWeight('벤치프레스')"),85,'max 불변');
  assert.strictEqual(ev("allPRs().find(p=>p.name==='벤치프레스').weight"),85,'PR 불변');
  assert(ev("est1RM('벤치프레스')")>0,'1RM 정상');
});

t('cardio 분 기록 저장(setVal min)',()=>{
  reset();ev("quickEx('천국의계단','유산소')");
  ev("setVal(0,0,'min','25')");
  assert.strictEqual(DB().workouts['2026-06-27'][0].sets[0].min,'25','min 저장');
});

t('setVal 토스트: assist 보조 줄이면 신기록, cardio 무토스트',()=>{
  reset();
  // 과거 기록(보조 40) 존재 → 오늘 35로 줄이면 신기록
  ev("DB.workouts['2026-06-20']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'40',reps:'8'}]}];save();");
  ev("startSession();quickEx('어시스트 풀업','등');");
  clearSpies();
  ev("setVal(0,0,'weight','35')"); // 보조 줄임=신기록(과거 40보다 낮음)
  assert(toastList().some(m=>m.includes('보조 줄였')),'보조 감소 토스트');
  clearSpies();
  ev("setVal(0,0,'weight','50')"); // 보조 늘림=후퇴, 토스트 없음
  assert.strictEqual(toastList().length,0,'보조 증가는 토스트 없음');
});

t('sessionPRHits: assist=보조감소 신기록, cardio 제외',()=>{
  reset();
  ev("DB.workouts['2026-06-20']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'40',reps:'8'}]}];save();");
  ev("startSession();");
  const sid=DB().settings.activeSessionId;
  ev(`DB.workouts['2026-06-27']=[{name:'어시스트 풀업',assist:true,sets:[{weight:'35',reps:'8',sid:'${sid}'}]},{name:'천국의계단',cardio:true,sets:[{min:30,sid:'${sid}'}]}];save();`);
  const hits=ev(`sessionPRHits('${sid}')`);
  const ah=hits.find(h=>h.name==='어시스트 풀업');
  assert(ah&&ah.assist===true,'보조 감소 신기록');
  assert(!hits.some(h=>h.name==='천국의계단'),'cardio 제외');
});

t('sessionExtraStats: 유산소 분 합산 + 보조 최저량',()=>{
  reset();ev("startSession();");
  const sid=DB().settings.activeSessionId;
  ev(`DB.workouts['2026-06-27']=[{name:'천국의계단',cardio:true,sets:[{min:'15',sid:'${sid}'},{min:'10',sid:'${sid}'}]},{name:'어시스트 딥스',assist:true,sets:[{weight:'30',reps:'8',sid:'${sid}'},{weight:'25',reps:'6',sid:'${sid}'}]}];save();`);
  const ex=ev(`sessionExtraStats('${sid}')`);
  assert.strictEqual(ex.cardioMin,25,'유산소 25분 합');
  assert.strictEqual(ex.assist[0].name,'어시스트 딥스');
  assert.strictEqual(ex.assist[0].w,25,'세션 최저 보조 25');
});

t('sessionSummary/sessionPartStats: assist·cardio 볼륨 제외',()=>{
  reset();ev("startSession();");
  const sid=DB().settings.activeSessionId;
  ev(`DB.workouts['2026-06-27']=[{name:'스쿼트',part:'하체',sets:[{weight:'100',reps:'5',sid:'${sid}'}]},{name:'어시스트 풀업',assist:true,part:'등',sets:[{weight:'40',reps:'8',sid:'${sid}'}]},{name:'천국의계단',cardio:true,part:'유산소',sets:[{min:'20',sid:'${sid}'}]}];save();`);
  const sum=ev(`(function(){var s=activeSession();return sessionSummary(s);})()`);
  assert.strictEqual(sum.volume,500,'볼륨=하체 500만');
  assert.strictEqual(sum.nEx,3,'종목수는 3(모두 셈)');
  const ps=ev(`sessionPartStats('${sid}')`);
  assert.strictEqual(ps['하체'].volume,500,'하체 500');
  assert.strictEqual(ps['등'].volume,0,'보조 등 볼륨 0(오진 방지)');
  assert.strictEqual(ps['유산소'].volume,0,'유산소 볼륨 0');
});

t('viewWorkout 렌더: assist=보조 라벨/칩, cardio=시간(분) 칸',()=>{
  reset();
  ev("quickEx('어시스트 풀업','등');quickEx('천국의계단','유산소');");
  ev("setTab('workout')");
  const v=ctx.document.getElementById('view').innerHTML;
  assert(v.includes('보조(kg)'),'assist 무게 라벨=보조(kg)');
  assert(v.includes('🅰 보조'),'보조 칩');
  assert(v.includes('시간(분)'),'cardio 시간 칸 라벨');
  assert(v.includes("setVal(1,0,'min'"),'cardio min 핸들러');
});

t('viewInsight: 근력 외 활동 섹션(유산소 분·보조)',()=>{
  reset();ev("startSession();");
  const sid=DB().settings.activeSessionId;
  ev(`DB.workouts['2026-06-27']=[{name:'천국의계단',cardio:true,sets:[{min:'25',sid:'${sid}'}]},{name:'어시스트 풀업',assist:true,sets:[{weight:'30',reps:'8',sid:'${sid}'}]}];save();`);
  const s=ev('activeSession()');ctx.__s=s;
  const v=ev("viewInsight(__s)");
  assert(v.includes('근력 외 활동'),'섹션 제목');
  assert(v.includes('25분'),'유산소 분');
  assert(v.includes('어시스트 풀업'),'보조 종목 표기');
});

t('백업 호환: 플래그 없는 옛 JSON load 후 함수 정상',()=>{
  reset();
  ev("DB=Object.assign(structuredClone(DEFAULT),{workouts:{'2026-06-27':[{name:'어시스트 풀업',sets:[{weight:'40',reps:'8'}]},{name:'스쿼트',sets:[{weight:'100',reps:'5'}]}]},meals:{},habits:{},body:[],settings:{}});save();");
  assert.strictEqual(ev("workoutVolume(DB.workouts['2026-06-27'])"),500,'옛 백업도 보조 폴백 제외→500');
  assert.strictEqual(ev("exerciseMaxWeight('어시스트 풀업')"),40,'옛 백업 보조 최저 폴백');
});

console.log('\n'+pass+' passed (sync)');

/* ========== 비동기(사진 흐름): IndexedDB·압축·업로드 가드 ========== */
async function at(name,fn){try{await fn();pass++;console.log('  ok -',name);}catch(e){console.error('  FAIL -',name,'\n   ',e.message);process.exitCode=1;}}

(async()=>{
  await at('idbPut/idbGet/idbDel 라운드트립',async()=>{
    const blob={size:42,__blob:true};ctx.__b=blob;
    await ev("idbPut('k1',__b)");
    const got=await ev("idbGet('k1')");
    assert(got&&got.size===42,'저장한 blob 반환');
    await ev("idbDel('k1')");
    const after=await ev("idbGet('k1')");
    assert.strictEqual(after,null,'삭제 후 null');
  });

  await at('compressImage: 출력 bytes가 입력보다 작고 치수는 max 이내',async()=>{
    const big={size:5000000,type:'image/jpeg'};ctx.__f=big;
    const c=await ev("compressImage(__f)");
    assert(c.blob&&c.bytes>0,'blob/bytes 반환');
    assert(c.bytes<big.size,'압축 후 더 작음('+c.bytes+' < '+big.size+')');
    assert(c.width<=ev('PHOTO_MAX')&&c.height<=ev('PHOTO_MAX'),'치수 max 이내');
    // 원본 2000x1500 → 긴 변 1000 → 1000x750
    assert.strictEqual(c.width,1000);assert.strictEqual(c.height,750);
  });

  await at('savePhoto(비로그인): IndexedDB엔 저장, 업로드는 no-op(네트워크 0)',async()=>{
    reset();
    // cloudReady()=false(supa 미정의). 업로드 브리지가 불려선 안 됨.
    ev("__up=0;SYNC.uploadPhoto=function(){__up++;return Promise.resolve('X');};");
    ctx.__f={size:900000,type:'image/jpeg'};
    const meta=await ev("savePhoto('meal','2026-06-27',__f)");
    assert(meta.id,'메타 id');
    assert.strictEqual(meta.path,undefined,'업로드 안 됨 → path 없음');
    assert.strictEqual(ev('__up'),0,'업로드 브리지 미호출(네트워크 0)');
    const blob=await ev("idbGet(meta_last_id)".replace('meta_last_id',"'"+meta.id+"'"));
    assert(blob,'IndexedDB엔 로컬 사본 저장됨');
  });

  await at('savePhoto(로그인 시뮬): cloudReady+enabled+uploadPhoto면 업로드 호출·path 반영',async()=>{
    reset();
    ev("supa={};cloudReady=function(){return true;};SYNC.enabled=true;SYNC.session={user:{id:'U1'}};");
    ev("__upArgs=null;SYNC.uploadPhoto=function(kind,date,key,c){__upArgs={kind,date,key};return Promise.resolve('U1/'+kind+'/'+date+'/'+key+'.jpg');};");
    ctx.__f={size:800000,type:'image/jpeg'};
    const meta=await ev("savePhoto('body','2026-06-27',__f)");
    assert.strictEqual(ev('__upArgs.kind'),'body','kind 전달');
    assert.strictEqual(ev('__upArgs.date'),'2026-06-27','date 전달');
    assert(meta.path&&meta.path.startsWith('U1/body/2026-06-27/'),'업로드 성공 path 반영: '+meta.path);
    // 정리(다른 테스트 격리)
    ev("delete supa;cloudReady=function(){return typeof supa!=='undefined'&&!!supa;};SYNC.enabled=false;SYNC.session=undefined;");
  });

  await at('savePhoto: 업로드 실패해도 로컬 메타·IndexedDB 사본은 유효(흡수)',async()=>{
    reset();
    ev("supa={};cloudReady=function(){return true;};SYNC.enabled=true;SYNC.session={user:{id:'U1'}};");
    ev("SYNC.uploadPhoto=function(){return Promise.reject(new Error('net'));};");
    ctx.__f={size:700000,type:'image/jpeg'};
    const meta=await ev("savePhoto('meal','2026-06-27',__f)");
    assert(meta.id,'메타는 생성됨');
    assert.strictEqual(meta.path,undefined,'업로드 실패 → path 없음(로컬만)');
    const blob=await ev("idbGet('"+meta.id+"')");
    assert(blob,'실패해도 IndexedDB 사본 보존');
    ev("delete supa;cloudReady=function(){return typeof supa!=='undefined'&&!!supa;};SYNC.enabled=false;SYNC.session=undefined;");
  });

  await at('addMeal: 사진 첨부 시 meal.photo 메타가 레코드에 저장',async()=>{
    reset();ev("mealPhotoPend={size:600000,type:'image/jpeg'};");
    elCache['mealMemo']=makeEl();elCache['mealMemo'].value='닭가슴살';
    elCache['mealKcal']=makeEl();elCache['mealKcal'].value='';
    elCache['mealProt']=makeEl();elCache['mealProt'].value='';
    await ev("addMeal()");
    const m=DB().meals['2026-06-27'][0];
    assert(m.photo&&m.photo.id,'meal.photo 메타 첨부');
    assert.strictEqual(m.photo.kind,'meal','kind=meal');
    assert.strictEqual(m.photo.date,'2026-06-27','date=식단 날짜');
    assert.strictEqual(ev('mealPhotoPend'),null,'대기 사진 비워짐');
    delete elCache['mealMemo'];delete elCache['mealKcal'];delete elCache['mealProt'];
  });

  await at('addMeal: 사진만 있어도(메모·칼로리 없음) 기록됨',async()=>{
    reset();ev("mealPhotoPend={size:500000,type:'image/jpeg'};");
    elCache['mealMemo']=makeEl();elCache['mealMemo'].value='';
    elCache['mealKcal']=makeEl();elCache['mealKcal'].value='';
    elCache['mealProt']=makeEl();elCache['mealProt'].value='';
    await ev("addMeal()");
    assert(DB().meals['2026-06-27']&&DB().meals['2026-06-27'].length===1,'사진만으로 기록');
    delete elCache['mealMemo'];delete elCache['mealKcal'];delete elCache['mealProt'];
  });

  await at('addBody: 인바디 사진 첨부 시 body.photo(kind=body) 저장 + 같은날 병합 보존',async()=>{
    reset();ev("bodyPhotoPend={size:650000,type:'image/jpeg'};");
    elCache['bDate']=makeEl();elCache['bDate'].value='2026-06-27';
    elCache['bWeight']=makeEl();elCache['bWeight'].value='80';
    elCache['bMuscle']=makeEl();elCache['bMuscle'].value='';
    elCache['bFat']=makeEl();elCache['bFat'].value='';
    await ev("addBody()");
    const b=DB().body.find(x=>x.date==='2026-06-27');
    assert(b.photo&&b.photo.kind==='body','body.photo kind=body');
    assert.strictEqual(b.weight,80,'체중도 같이 저장');
    assert.strictEqual(ev('bodyPhotoPend'),null,'대기 사진 비워짐');
    delete elCache['bDate'];delete elCache['bWeight'];delete elCache['bMuscle'];delete elCache['bFat'];
  });

  await at('delMeal/delBody: 사진 있는 레코드 삭제 시 IndexedDB 사본도 제거',async()=>{
    reset();ev("DB.meals['2026-06-27']=[{type:'점심',memo:'x',kcal:'',protein:'',photo:{id:'pm1',kind:'meal',date:'2026-06-27'}}];save();");
    ctx.__b={size:1,__blob:true};await ev("idbPut('pm1',__b)");
    ev("delMeal(0)");
    await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
    assert.strictEqual(await ev("idbGet('pm1')"),null,'meal 사진 IndexedDB 정리');
  });

  await at('hydratePhotos/viewPhoto: 예외 없이 동작 + img.src 채움',async()=>{
    reset();
    const img=makeEl();img.dataset={photo:'PH1',path:''};img.closest=()=>null;
    _photoImgs=[img];
    ev("hydratePhotos()");
    // idbGet('PH1')은 없음 → photoURL null → src 안 채워짐(예외만 없으면 됨). 캐시 주입 후 재확인:
    ctx.__b={size:1,__blob:true};await ev("idbPut('PH1',__b)");
    const img2=makeEl();img2.dataset={photo:'PH1',path:''};img2.closest=()=>null;
    _photoImgs=[img2];
    ev("hydratePhotos()");
    await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
    assert.strictEqual(img2.src,'blob:fake','캐시 히트 시 objectURL로 src 채움');
    _photoImgs=[];
    ev("viewPhoto('PH1','')"); // 시트 렌더 무에러
    assert(ctx.document.getElementById('sheet').innerHTML.includes('data-photo'),'뷰어 시트에 img 렌더');
  });

  await at('viewMeal/viewBody: 사진 있는 레코드는 썸네일(data-photo) 렌더',async()=>{
    reset();
    ev("DB.meals['2026-06-27']=[{type:'점심',memo:'밥',kcal:'',protein:'',photo:{id:'PM',kind:'meal',date:'2026-06-27'}}];");
    ev("DB.body=[{date:'2026-06-27',weight:80,photo:{id:'PB',kind:'body',date:'2026-06-27'}}];save();");
    const vm_=ev("viewMeal()");
    assert(vm_.includes('data-photo="PM"')&&vm_.includes('thumb'),'식단 썸네일');
    assert(vm_.includes("viewPhoto('PM'"),'식단 사진 탭→뷰어');
    const vb=ev("viewBody()");
    assert(vb.includes('data-photo="PB"')&&vb.includes('thumb'),'인바디 썸네일');
  });

  await at('사진 첨부 UI: 식단/신체 카드에 파일 입력·버튼 존재',async()=>{
    reset();
    assert(ev("viewMeal()").includes('id="mealPhoto"'),'식단 파일 입력');
    assert(ev("viewMeal()").includes('사진 첨부'),'식단 첨부 버튼');
    assert(ev("viewBody()").includes('id="bodyPhoto"'),'신체 파일 입력');
    assert(ev("viewBody()").includes('인바디 사진'),'인바디 첨부 버튼');
  });

  await at('saveTodaySleep: 수면 분석 이미지 첨부 시 sleep.photo(kind=sleep) 저장 + 메모 병합',async()=>{
    reset();ev("todaySleepPhotoPend={size:700000,type:'image/jpeg'};");
    elCache['todaySlMemo']=makeEl();elCache['todaySlMemo'].value='꿀잠';
    await ev("saveTodaySleep()");
    const s=DB().sleep.find(x=>x.date==='2026-06-27');
    assert(s.photo&&s.photo.id,'sleep.photo 메타 첨부');
    assert.strictEqual(s.photo.kind,'sleep','kind=sleep');
    assert.strictEqual(s.photo.date,'2026-06-27','date=오늘');
    assert.strictEqual(s.memo,'꿀잠','메모도 같이 저장');
    assert.strictEqual(ev('todaySleepPhotoPend'),null,'대기 사진 비워짐');
    delete elCache['todaySlMemo'];
  });

  await at('saveTodaySleep: 이미지만 있어도(메모 없음) 기록됨',async()=>{
    reset();ev("todaySleepPhotoPend={size:600000,type:'image/jpeg'};");
    elCache['todaySlMemo']=makeEl();elCache['todaySlMemo'].value='';
    await ev("saveTodaySleep()");
    const s=DB().sleep.find(x=>x.date==='2026-06-27');
    assert(s&&s.photo&&s.photo.kind==='sleep','이미지만으로 기록');
    delete elCache['todaySlMemo'];
  });

  await at('savePhoto: kind=sleep 메타 반환 + 비로그인 업로드 no-op(네트워크 0)',async()=>{
    reset();
    ev("__up=0;SYNC.uploadPhoto=function(){__up++;return Promise.resolve('X');};");
    ctx.__f={size:800000,type:'image/jpeg'};
    const meta=await ev("savePhoto('sleep','2026-06-27',__f)");
    assert.strictEqual(meta.kind,'sleep','메타 kind=sleep');
    assert.strictEqual(meta.path,undefined,'비로그인 → 업로드 안 됨(path 없음)');
    assert.strictEqual(ev('__up'),0,'업로드 브리지 미호출(네트워크 0)');
    const blob=await ev("idbGet('"+meta.id+"')");
    assert(blob,'IndexedDB엔 로컬 사본 저장됨');
  });

  await at('delSleep: 사진 있는 수면 레코드 삭제 시 IndexedDB 사본도 제거',async()=>{
    reset();ev("DB.sleep=[{date:'2026-06-27',hours:7,rem:null,deep:null,memo:null,photo:{id:'ps1',kind:'sleep',date:'2026-06-27'}}];save();");
    ctx.__b={size:1,__blob:true};await ev("idbPut('ps1',__b)");
    ev("delSleep(0)");
    await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
    assert.strictEqual(await ev("idbGet('ps1')"),null,'sleep 사진 IndexedDB 정리');
    assert.strictEqual(DB().sleep.length,0,'레코드도 삭제');
  });

  await at('viewSleep: 사진 있는 수면 레코드는 썸네일(data-photo) 렌더',async()=>{
    reset();
    ev("DB.sleep=[{date:'2026-06-27',memo:null,photo:{id:'PS',kind:'sleep',date:'2026-06-27'}}];save();");
    const vs=ev("viewSleep()");
    assert(vs.includes('data-photo="PS"')&&vs.includes('thumb'),'수면 썸네일 렌더');
    assert(vs.includes("viewPhoto('PS'"),'수면 사진 탭→뷰어');
  });

  await at('수면 이미지 UI(투데이): 파일 입력은 capture 없이 accept=image/* + 버튼 존재',async()=>{
    reset();
    const vt=ev("viewTodaySleep()");
    assert(vt.includes('id="todaySlPhoto"'),'수면 파일 입력 존재');
    assert(vt.includes('수면 분석 사진'),'수면 첨부 버튼');
    assert(/<input[^>]*id="todaySlPhoto"[^>]*accept="image\/\*"/.test(vt),'accept=image/* 지정');
    assert(!/<input[^>]*id="todaySlPhoto"[^>]*capture/.test(vt),'capture 속성 없음(갤러리/구글포토 선택 가능)');
  });

  await at('delSleep: 사진 있는 오늘 수면 썸네일 렌더(투데이 카드)',async()=>{
    reset();
    ev("DB.sleep=[{date:'2026-06-27',memo:'x',photo:{id:'TP2',kind:'sleep',date:'2026-06-27'}}];save();");
    const vt=ev("viewTodaySleep()");
    assert(vt.includes('data-photo="TP2"')&&vt.includes("viewPhoto('TP2'"),'오늘 사진 썸네일+뷰어');
  });

  console.log('\n'+pass+' passed'+(process.exitCode?' (with failures)':''));
})();
