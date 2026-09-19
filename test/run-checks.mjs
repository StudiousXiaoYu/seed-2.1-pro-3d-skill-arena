// 最终收尾行为验收：Playwright 驱动系统 Edge，加载本地页面并断言完整战斗闭环
// 运行：npm test（自动起静态服务，无需额外开服）
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVID = join(ROOT, 'evidence', 'final-polish');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const MIME = {
  '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
  '.css':'text/css','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml'
};

let pass=0, fail=0;
const results=[];
function check(name, cond, extra=''){
  if(cond){ pass++; results.push('  PASS  '+name); }
  else { fail++; results.push('  FAIL  '+name+(extra?'  -> '+extra:'')); }
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const server=createServer(async(req,res)=>{
  try{
    let p=decodeURIComponent(new URL(req.url,'http://x').pathname);
    if(p.endsWith('/')) p+='index.html';
    const fp=join(ROOT, normalize(p).replace(/^([/\\])+/,''));
    const buf=await readFile(fp);
    res.writeHead(200,{'Content-Type':MIME[extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(buf);
  }catch{ res.writeHead(404); res.end('404'); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
await mkdir(EVID,{recursive:true});

const requestedChannel=process.env.BROWSER_CHANNEL||'msedge';
const browser=await chromium.launch({
  ...(requestedChannel==='chromium'?{}:{channel:requestedChannel}), headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
});
const page=await browser.newPage({ viewport:{width:1280,height:800} });
const pageErrors=[]; const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });

async function snap(){ return page.evaluate(()=>window.__dbg.snapshot()); }
async function waitFor(fn, ms=4000, label=''){
  const t0=Date.now();
  for(;;){
    const v=await fn();
    if(v) return v;
    if(Date.now()-t0>ms) throw new Error('timeout waiting: '+label);
    await sleep(100);
  }
}

try{
  await page.goto(BASE,{waitUntil:'load'});
  await waitFor(()=>page.evaluate(()=>window.__dbg&&window.__dbg.ready()),15000,'actors load');
  await sleep(1500); // 等 Idle 动画与 ps.json

  // ---------- 1. 初始 HUD ----------
  let s=await snap();
  check('初始状态 playing', s.state==='playing', JSON.stringify(s));
  check('玩家满血 100', s.heroHp===100);
  check('敌人满血 220', s.enemyHp===220);
  check('初始无箭矢', s.arrows===0);
  check('初始无投射物', s.projActive===false);
  const heroNum=await page.textContent('#hero-hp-num');
  const enemyNum=await page.textContent('#enemy-hp-num');
  const desc=await page.textContent('#skill-desc');
  check('HUD 玩家生命文本', /100\s*\/\s*100/.test(heroNum), heroNum);
  check('HUD 敌人生命文本', /220\s*\/\s*220/.test(enemyNum), enemyNum);
  check('HUD 技能说明非空', !!desc && desc.includes('火球'));
  const enemyHudVisible=await page.evaluate(()=>getComputedStyle(document.getElementById('enemy-hud')).opacity);
  check('敌人头顶血条可见', enemyHudVisible==='1');
  await page.screenshot({path:join(EVID,'01-initial-hud.png')});

  // 初始截图后加速仿真（固定子步，逻辑与正常帧率等价；抵消无头 SwiftShader 低帧率）
  await page.evaluate(()=>window.__dbg.setTimeScale(6));

  // ---------- 2. 战斗：技能真实伤害 ----------
  // 满蓄火球（暴击）
  await page.evaluate(()=>window.__dbg.castFire(1));
  await waitFor(async()=>(await snap()).enemyHp<220,8000,'fireball hit');
  s=await snap();
  check('火球对敌人造成伤害', s.enemyHp<=130 && s.enemyHp>0, 'hp='+s.enemyHp);
  await waitFor(async()=>(await snap()).projActive===false,8000,'fireball cleanup');
  check('火球结算后投射物已回收', (await snap()).projActive===false);

  // 敌箭命中玩家：强制立即射一箭（期间 AI 也可能自然射击）
  await page.evaluate(()=>window.__dbg.enemyShootNow());
  await waitFor(async()=>(await snap()).heroHp<100,8000,'arrow hit hero');
  const afterArrow=await snap();
  check('敌箭命中玩家扣血（且未死）', afterArrow.heroHp>0 && afterArrow.heroHp<100, 'hp='+afterArrow.heroHp);
  await waitFor(async()=>(await snap()).arrows===0,8000,'arrow despawn');
  check('敌箭命中/落地后已移除', (await snap()).arrows===0);

  // 天雷
  const hpBefore=(await snap()).enemyHp;
  await page.evaluate(()=>window.__dbg.castAtEnemy(1));
  await waitFor(async()=>(await snap()).enemyHp<hpBefore,8000,'lightning hit');
  check('天雷造成伤害', true);

  // 冰刺：冻结 + 伤害
  await page.evaluate(()=>window.__dbg.castAtEnemy(2));
  await waitFor(async()=>{ const x=await snap(); return x.frozen; },5000,'freeze');
  check('冰刺冻结敌人', (await snap()).frozen===true);
  const hpIce=(await snap()).enemyHp;
  await waitFor(async()=>(await snap()).enemyHp<hpIce,5000,'ice hit');
  check('冰刺造成伤害', true);

  // 水弹
  const hpBeforeW=(await snap()).enemyHp;
  await page.evaluate(()=>window.__dbg.castAtEnemy(4));
  await waitFor(async()=>(await snap()).enemyHp<hpBeforeW,8000,'water hit');
  check('水弹造成伤害', true);

  // 回到正常倍速走击杀线：6 倍速下敌箭会在验收完成前把主角射死导致状态转 lost
  await page.evaluate(()=>window.__dbg.setTimeScale(1));
  await sleep(300);
  // 陨星：先补一次冰冻把敌人钉在落点，截战斗中画面
  await page.evaluate(()=>window.__dbg.castAtEnemy(2));
  await waitFor(async()=>(await snap()).frozen,5000,'refreeze before meteor');
  const hpBeforeM=(await snap()).enemyHp;
  await page.evaluate(()=>window.__dbg.castAtEnemy(3));
  await sleep(650);
  await page.screenshot({path:join(EVID,'02-battle.png')});
  // 等陨星命中（伤害或死亡二选一）
  await waitFor(async()=>{ const x=await snap(); return x.state==='won'||x.enemyHp<hpBeforeM; },8000,'meteor resolve');

  // ---------- 3. 击杀 / 胜利 / 重开 ----------
  // 若残血未死（边缘 AoE 等），用已验收过的天雷收尾，保证进入胜利线
  for(let k=0;k<4 && (await snap()).state!=='won';k++){
    await page.evaluate(()=>window.__dbg.castAtEnemy(1));
    await sleep(900);
  }
  s=await waitFor(async()=>{ const x=await snap(); return x.state==='won'?x:null; },8000,'win state');
  check('击杀敌人进入 won', s.state==='won');
  await waitFor(async()=>(await snap()).overlayShown,5000,'win overlay');
  await waitFor(
    ()=>page.evaluate(()=>Number.parseFloat(getComputedStyle(document.getElementById('enemy-hud')).opacity)<0.01),
    2000,
    'enemy hud fade out'
  );
  check('敌人血条在死亡后隐藏', true);
  // 胜利后等残留箭落地，确认 AI 不再产新箭
  await waitFor(async()=>(await snap()).arrows===0,8000,'arrows drain after win');
  const arrowsAtWin=(await snap()).arrows;
  await sleep(1200);
  check('胜利后敌人不再射箭', (await snap()).arrows===arrowsAtWin && arrowsAtWin===0);

  // 点击重开按钮（真点击，验证按钮可点且无穿透问题）
  await page.click('#restart-btn');
  await sleep(600);
  s=await snap();
  check('点击重开 -> playing', s.state==='playing');
  check('重开后玩家满血', s.heroHp===100);
  check('重开后敌人满血', s.enemyHp===220);
  check('重开后无箭/无投射物', s.arrows===0 && s.projActive===false);
  check('重开后临时特效清空', s.effects<=4, 'effects='+s.effects);
  check('重开后结算遮罩隐藏', s.overlayShown===false);
  check('重开后敌人姿态回正', await page.evaluate(()=>Math.abs(window.__dbg.dummy.group.rotation.z)<0.02));
  check('重开后敌人位置复位', await page.evaluate(()=>{
    const p=window.__dbg.dummy.group.position; return Math.hypot(p.x-4.6,p.z)<0.2; }));
  check('重开后无飘字残留', await page.evaluate(()=>document.querySelectorAll('.float-dmg').length===0));
  await sleep(300);
  await page.screenshot({path:join(EVID,'03-result-restart.png')});

  // ---------- 4. 失败线 ----------
  await page.evaluate(()=>window.__dbg.killHero());
  s=await waitFor(async()=>{ const x=await snap(); return x.state==='lost'?x:null; },2000,'lose state');
  check('玩家阵亡进入 lost', s.state==='lost');
  await waitFor(async()=>(await snap()).overlayShown,3000,'lose overlay');
  // 结算状态下施法必须被吞掉（不能误触/幽灵火球）
  await page.evaluate(()=>{ window.__dbg.castAtEnemy(1); window.__dbg.castFire(1); });
  await sleep(500);
  s=await snap();
  check('结算后施法被屏蔽', s.projActive===false && s.enemyHp===220, JSON.stringify(s));
  await page.keyboard.press('r');
  await sleep(400);
  s=await snap();
  check('按 R 重开 -> playing', s.state==='playing' && s.heroHp===100 && s.overlayShown===false);

  // ---------- 5. 稳定 / 性能护栏 ----------
  for(let i=0;i<3;i++){
    await page.evaluate(()=>{ for(let k=1;k<=4;k++) window.__dbg.castAtEnemy(k); });
    await sleep(300);
    await page.evaluate(()=>window.__dbg.restart());
    await sleep(500);
  }
  await sleep(2000);
  s=await snap();
  check('多轮重开后无残留投射物', s.projActive===false && s.arrows===0);
  check('多轮重开后特效对象有界 (<=20)', s.effects<=20, 'effects='+s.effects);

  // 敌人死亡态下强制放箭无效
  await page.evaluate(()=>window.__dbg.killEnemy());
  await waitFor(async()=>(await snap()).state==='won',2000,'win2');
  await page.evaluate(()=>window.__dbg.enemyShootNow());
  await sleep(400);
  check('敌人死亡后不能放箭', (await snap()).arrows===0);

  // 窗口缩放不炸
  await page.evaluate(()=>window.__dbg.restart());
  await page.setViewportSize({width:1024,height:700});
  await sleep(400);
  const cw=await page.evaluate(()=>document.getElementById('scene').clientWidth);
  check('窗口缩放画布跟随', cw===1024, 'clientWidth='+cw);
  await page.setViewportSize({width:1280,height:800});
  await sleep(300);

  // ---------- 6. 控制台 ----------
  check('无未处理页面异常', pageErrors.length===0, pageErrors.slice(0,3).join(' | '));
  if(consoleErrors.length){
    console.log('  console.error 输出（不致命）:\n' + consoleErrors.slice(0,5).map(e=>'    '+e).join('\n'));
  } else {
    console.log('  （控制台无 error）');
  }
} catch(e){
  check('测试流程未抛异常: '+e.message, false, e.stack.split('\n').slice(0,3).join(' / '));
} finally {
  await page.close(); await browser.close(); server.close();
}

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
console.log('证据截图：' + EVID);
process.exit(fail?1:0);
