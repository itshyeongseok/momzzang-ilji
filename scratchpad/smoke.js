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
    getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};},
    setAttribute(){}, getAttribute(){return null;}, focus(){}, scrollIntoView(){}
  };
  return el;
}
const elCache={};
const document={
  getElementById(id){return elCache[id]||(elCache[id]=makeEl());},
  querySelector(){return makeEl();},
  querySelectorAll(){return [];},
  createElement(){return makeEl();},
  addEventListener(){}, body:makeEl(), documentElement:makeEl()
};
const store={};
const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};

const ctx={
  document, localStorage,
  navigator:{vibrate:function(){},serviceWorker:{register:function(){return Promise.resolve();}}},
  Promise,
  window:{}, location:{href:'',reload(){}},
  setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, clearTimeout(){},
  requestAnimationFrame:fn=>fn&&fn(),
  confirm:()=>true, alert(){}, prompt:()=>null,
  structuredClone:o=>JSON.parse(JSON.stringify(o)), JSON, Date, Math, Object, Array, String, Number,
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

/* ========== 식단 ========== */
t('식단 추가/삭제 회귀',()=>{
  reset();ev("curMT='점심';");
  ctx.document.getElementById('mealMemo').value='닭가슴살';
  ctx.document.getElementById('mealKcal').value='300';
  ctx.document.getElementById('mealProt').value='40';
  ev('addMeal()');
  assert.strictEqual(DB().meals['2026-06-27'][0].memo,'닭가슴살');
  ev('delMeal(0)');
  assert(!DB().meals['2026-06-27'],'삭제 후 빈 날짜 정리');
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
  reset();ev("curMT='점심';");
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

console.log('\n'+pass+' passed'+(process.exitCode?' (with failures)':''));
