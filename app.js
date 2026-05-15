// === DRINKS DATABASE ===
const DRINKS = [
  { name:"Piwo jasne (500ml / 5%)", cat:"Piwo", vol:500, alc:5.0, abs:0.85 },
  { name:"Piwo mocne (500ml / 7%)", cat:"Piwo", vol:500, alc:7.0, abs:0.85 },
  { name:"Wino czerwone (150ml / 13%)", cat:"Wino", vol:150, alc:13.0, abs:0.90 },
  { name:"Wino białe (150ml / 11%)", cat:"Wino", vol:150, alc:11.0, abs:0.90 },
  { name:"Wódka (50ml / 40%)", cat:"Mocne", vol:50, alc:40.0, abs:1.0 },
  { name:"Whisky (50ml / 40%)", cat:"Mocne", vol:50, alc:40.0, abs:1.0 },
  { name:"Shot (20ml / 40%)", cat:"Mocne", vol:20, alc:40.0, abs:1.0 },
  { name:"Drink koktajlowy (300ml / 8%)", cat:"Koktajl", vol:300, alc:8.0, abs:0.95 }
];

const METHODS = [
  { name:"Widmark (klasyczna)", desc:"Klasyczny wzór Widmarka (1932). Współczynnik eliminacji: stałe 0.15 ‰/h.",
    calcBAC(alc,w,r,t){ return Math.max(0, alc/(w*r) - 0.15*t); },
    elimRate(male){ return 0.15; } },
  { name:"Seidl (zmodyfikowana)", desc:"Modyfikacja Widmarka z korekcją metabolizmu (×1.055). Eliminacja: M 0.15, K 0.17 ‰/h.",
    calcBAC(alc,w,r,t,male){ return Math.max(0, (alc*1.055)/(w*r) - this.elimRate(male)*t); },
    elimRate(male){ return male ? 0.15 : 0.17; } }
];

// === STATE ===
let consumed = [];
let methodIdx = 0;
let cachedBAC = 0;

function getUser() {
  return {
    weight: +document.getElementById('weight').value,
    height: +document.getElementById('height').value,
    age: +document.getElementById('age').value,
    male: document.querySelector('input[name="sex"]:checked').value === 'male',
    drinkDur: +document.getElementById('drinkDuration').value,
    hoursSince: +document.getElementById('hoursSince').value,
    get r() { return this.male ? 0.68 : 0.55; },
    get hours() { return this.drinkDur / 2 + this.hoursSince; }
  };
}

function pureAlcG(d) { return d.vol * (d.alc/100) * 0.789; }

function totalAlcohol() {
  let sum = 0;
  for (const c of consumed) sum += pureAlcG(DRINKS[c.drinkIdx]) * DRINKS[c.drinkIdx].abs * c.qty;
  return sum;
}

function calcBAC(mIdx, user, alc) {
  if (!alc && alc !== 0) alc = totalAlcohol();
  if (!user) user = getUser();
  const mi = (mIdx !== undefined && mIdx !== null) ? mIdx : methodIdx;
  return METHODS[mi].calcBAC(alc, user.weight, user.r, user.hours, user.male);
}

function timeTillSober() {
  const alc = totalAlcohol(); if (alc <= 0) return 0;
  const u = getUser();
  const m = METHODS[methodIdx];
  const peakT = u.drinkDur / 2;
  const peak = m.calcBAC(alc, u.weight, u.r, peakT, u.male);
  const elim = m.elimRate(u.male);
  if (elim <= 0) return 0;
  return Math.max(0, peak / elim - u.hoursSince);
}

// === CALCULATOR UI ===
function initCalc() {
  const sel = document.getElementById('drinkSelect');
  DRINKS.forEach((d, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `[${d.cat}] ${d.name}`; sel.appendChild(o); });
  document.getElementById('btnAdd').onclick = addDrink;
  document.getElementById('btnClear').onclick = () => { consumed = []; updateCalc(); };
  document.getElementById('methodSelect').onchange = e => { methodIdx = +e.target.value; updateMethodDesc(); updateCalc(); };
  ['weight','height','age','drinkDuration','hoursSince'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateCalc));
  document.querySelectorAll('input[name="sex"]').forEach(r => r.addEventListener('change', updateCalc));
  updateMethodDesc();
  initMethodBars();
}

function addDrink() {
  const idx = +document.getElementById('drinkSelect').value;
  const qty = +document.getElementById('drinkQty').value;
  consumed.push({ drinkIdx: idx, qty });
  updateCalc();
}

function updateCalc() {
  updateDrinksTable();
  const alc = totalAlcohol();
  document.getElementById('totalAlcohol').textContent = `Suma alkoholu: ${alc.toFixed(1)} g`;
  const bac = calcBAC();
  const el = document.getElementById('bacValue');
  el.textContent = `Twoje promile: ${bac.toFixed(2)} ‰`;
  el.style.color = bac < 0.2 ? '#4cb88a' : bac < 0.5 ? '#e0b040' : '#d45555';
  const ts = timeTillSober();
  const h = Math.floor(ts), m = Math.round((ts - h) * 60);
  document.getElementById('timeSober').textContent = `Czas do trzeźwości: ${h}h ${m}min`;
  const ds = document.getElementById('driveStatus');
  if (alc <= 0) { ds.textContent = 'Status: brak danych'; ds.style.color = '#555870'; }
  else if (bac < 0.2) { ds.textContent = 'Możesz prowadzić (BAC < 0.2‰)'; ds.style.color = '#4cb88a'; }
  else { ds.textContent = 'NIE WOLNO PROWADZIĆ (limit 0.2‰)'; ds.style.color = '#d45555'; }
  updateMethodBars();
  cachedBAC = bac;
}

function updateDrinksTable() {
  const tb = document.getElementById('drinksBody'); tb.innerHTML = '';
  consumed.forEach((c, i) => {
    const d = DRINKS[c.drinkIdx]; const g = (pureAlcG(d) * d.abs * c.qty).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.name}</td><td>${d.cat}</td><td>${c.qty}</td><td>${g}</td><td><button class="btn-remove" onclick="consumed.splice(${i},1);updateCalc()">×</button></td>`;
    tb.appendChild(tr);
  });
}

function updateMethodDesc() {
  document.getElementById('methodDesc').textContent = METHODS[methodIdx].desc;
}

function initMethodBars() {
  const wrap = document.getElementById('methodComparison');
  const colors = ['#4a8fe7', '#4cb88a'];
  METHODS.forEach((m, i) => {
    wrap.innerHTML += `<div class="method-row"><span class="method-name">${m.name}</span><div class="method-bar-wrap"><div class="method-bar"><div class="method-bar-fill" id="bar${i}" style="width:0%;background:${colors[i]}"></div></div><span class="method-bac" id="bac${i}" style="color:${colors[i]}">0.00 ‰</span></div></div>`;
  });
}

function updateMethodBars() {
  const u = getUser(), alc = totalAlcohol();
  METHODS.forEach((m, i) => {
    const bac = m.calcBAC(alc, u.weight, u.r, u.hours, u.male);
    const pct = Math.min(bac / 4 * 100, 100);
    document.getElementById('bar' + i).style.width = pct + '%';
    document.getElementById('bac' + i).textContent = Math.max(0, bac).toFixed(2) + ' ‰';
  });
}

// === SHOOTING GAME ===
const GAME = {
  MAX_ROUNDS: 3, SHOTS_PER_ROUND: 10,
  round: 0, shots: 0, roundScore: 0, totalScore: 0,
  roundScores: [], shotHistory: [], lastPts: -1,
  active: false, over: false, dynamic: false,
  target: { x: 400, y: 300, r: 100, vx: 0.7, vy: 0.5 },
  startRound() {
    if (this.over || this.round >= this.MAX_ROUNDS) return;
    this.round++; this.shots = this.SHOTS_PER_ROUND; this.roundScore = 0;
    this.shotHistory = []; this.active = true; this.lastPts = -1;
    this.target.x = 400; this.target.y = 300;
  },
  shoot(tx, ty) {
    if (!this.active || this.shots <= 0) return 0;
    const bac = calcBAC();
    const dev = lerp(bac, 0, 3, 0, 80) * (Math.random() * 2 - 1);
    const dev2 = lerp(bac, 0, 3, 0, 80) * (Math.random() * 2 - 1);
    const ax = tx + dev, ay = ty + dev2;
    const dist = Math.hypot(ax - this.target.x, ay - this.target.y);
    const ring = Math.floor(dist / (this.target.r / 10));
    const pts = ring >= 10 ? 0 : 10 - ring;
    this.roundScore += pts; this.totalScore += pts; this.shots--;
    this.shotHistory.push(pts); this.lastPts = pts;
    if (this.shots <= 0) { this.active = false; this.roundScores.push(this.roundScore);
      if (this.round >= this.MAX_ROUNDS) this.over = true; }
    return pts;
  },
  update() {
    if (!this.dynamic || !this.active) return;
    const t = this.target;
    t.x += t.vx; t.y += t.vy;
    if (t.x < t.r + 50 || t.x > 750 - t.r) t.vx *= -1;
    if (t.y < t.r + 50 || t.y > 550 - t.r) t.vy *= -1;
  },
  reset() {
    this.round = 0; this.shots = 0; this.roundScore = 0; this.totalScore = 0;
    this.roundScores = []; this.shotHistory = []; this.active = false; this.over = false;
    this.lastPts = -1; this.target.x = 400; this.target.y = 300;
  }
};

function lerp(v, a, b, c, d) { return c + Math.max(0, Math.min(1, (v-a)/(b-a))) * (d-c); }

function getDifficulty() {
  const bac = cachedBAC;
  return {
    bac, sway: lerp(bac,0,3,0,90), lag: lerp(bac,0,3,0,0.9),
    dev: lerp(bac,0,3,0,80), blur: lerp(bac,0,3,0,0.8), tilt: lerp(bac,0.3,3,0,8),
    get color() { return bac<=0?'#4cb88a':bac<0.3?'#8cc864':bac<0.5?'#e0b040':bac<1?'#dc8c46':bac<2?'#d25555':'#6482c8'; },
    get level() { return bac<=0?'Trzeźwy':bac<0.3?'Lekko wstawiony':bac<0.5?'Wstawiony':bac<1?'Pijany':bac<2?'Bardzo pijany':'Ekstremalnie pijany'; }
  };
}

// === GAME RENDERER ===
let canvas, ctx, mouseX = 400, mouseY = 300, crossX = 400, crossY = 300;
let swayPhase = 0, recoilT = 0, flashT = 0, feedT = 0, feedPts = 0;

function canvasCoords(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) / r.width * 800, y: (clientY - r.top) / r.height * 600 };
}

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  if (r.width < 1) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(r.width * dpr);
  const h = Math.round(r.width * dpr * 0.75); // 4:3
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function initGame() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = 800; canvas.height = 600;
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousemove', e => { const c = canvasCoords(e.clientX, e.clientY); mouseX = c.x; mouseY = c.y; });
  canvas.addEventListener('click', e => { const c = canvasCoords(e.clientX, e.clientY); mouseX = c.x; mouseY = c.y; onCanvasClick(); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; const c = canvasCoords(t.clientX, t.clientY); mouseX = c.x; mouseY = c.y; }, {passive:false});
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; const c = canvasCoords(t.clientX, t.clientY); mouseX = c.x; mouseY = c.y; crossX = mouseX; crossY = mouseY; onCanvasClick(); }, {passive:false});

  document.getElementById('btnStartRound').onclick = () => { GAME.startRound(); updateGameStatus(); };
  document.getElementById('btnNewGame').onclick = () => { GAME.reset(); updateGameStatus(); };
  document.getElementById('targetMode').onchange = e => { GAME.dynamic = e.target.value === 'dynamic'; };
  requestAnimationFrame(gameLoop);
}

function onCanvasClick() {
  if (!GAME.active) return;
  const pts = GAME.shoot(crossX, crossY);
  recoilT = 0.15; flashT = 0.08; feedPts = pts; feedT = 1.5;
  updateGameStatus();
  if (GAME.over) setTimeout(onGameOver, 500);
}

function updateGameStatus() {
  const s = document.getElementById('gameStatus');
  if (GAME.over) s.textContent = `Koniec gry! Wynik: ${GAME.totalScore}/300`;
  else if (GAME.active) s.textContent = `Runda ${GAME.round} | Strzały: ${GAME.shots} | Wynik: ${GAME.totalScore}`;
  else if (GAME.round > 0) s.textContent = `Runda ${GAME.round} zakończona (${GAME.roundScores[GAME.roundScores.length-1]} pkt)`;
  else s.textContent = 'Gotowy do gry';
}

function gameLoop() {
  const dt = 1/60;
  resizeCanvas();
  const W = canvas.width, H = canvas.height;
  const sx = W/800, sy = H/600;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(sx, sy);
  const diff = getDifficulty();
  swayPhase += dt * (1 + diff.bac * 0.5);
  const sm = 1 - diff.lag; crossX += (mouseX - crossX) * Math.max(0.05, sm); crossY += (mouseY - crossY) * Math.max(0.05, sm);
  if (diff.sway > 0.1) { crossX += diff.sway * Math.sin(swayPhase * 3.7) * 0.3; crossY += diff.sway * Math.sin(swayPhase * 4.3) * 0.3; }
  GAME.update();
  if (recoilT > 0) recoilT -= dt; if (flashT > 0) flashT -= dt; if (feedT > 0) feedT -= dt;
  drawBg(); drawRange(); drawTarget(diff); drawDrunk(diff); drawFeedback(); drawCrosshair(diff); drawHUD(diff); drawIntoxBar(diff);
  if (GAME.over) drawOverlay('KONIEC GRY!', `Wynik: ${GAME.totalScore} / 300`, diff);
  else if (!GAME.active && GAME.round > 0 && !GAME.over) drawOverlay(`Runda ${GAME.round} zakończona!`, `${GAME.roundScores[GAME.roundScores.length-1]} / 100 pkt`);
  else if (GAME.round === 0 && !GAME.over) { ctx.font = '500 22px Inter'; ctx.fillStyle = 'rgba(160,170,190,0.5)'; ctx.textAlign = 'center'; ctx.fillText('Kliknij "Rozpocznij rundę"', 400, 290); ctx.fillText('aby zacząć grę', 400, 320); }
  ctx.restore();
  requestAnimationFrame(gameLoop);
}

function drawBg() { const g = ctx.createLinearGradient(0,0,0,600); g.addColorStop(0,'#0c0e18'); g.addColorStop(1,'#121424'); ctx.fillStyle = g; ctx.fillRect(0,0,800,600); }

function drawRange() {
  const vx=400,vy=210,nw=720,fw=200;
  // floor
  ctx.fillStyle='#1c2030'; ctx.beginPath(); ctx.moveTo(vx-fw/2,vy); ctx.lineTo(vx+fw/2,vy); ctx.lineTo(vx+nw/2,600); ctx.lineTo(vx-nw/2,600); ctx.fill();
  // walls
  ctx.fillStyle='#161a28'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(vx-fw/2,vy); ctx.lineTo(vx-nw/2,600); ctx.lineTo(0,600); ctx.fill();
  ctx.beginPath(); ctx.moveTo(800,0); ctx.lineTo(vx+fw/2,vy); ctx.lineTo(vx+nw/2,600); ctx.lineTo(800,600); ctx.fill();
  // ceiling
  ctx.fillStyle='#0e101c'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(800,0); ctx.lineTo(vx+fw/2,vy); ctx.lineTo(vx-fw/2,vy); ctx.fill();
  // back wall
  ctx.fillStyle='#202436'; ctx.fillRect(vx-fw/2,vy-60,fw,200);
  // lane line
  ctx.strokeStyle='#3c466440'; ctx.setLineDash([6,8]); ctx.beginPath(); ctx.moveTo(400,vy); ctx.lineTo(400,600); ctx.stroke(); ctx.setLineDash([]);
}

function drawTarget(diff) {
  if (GAME.round <= 0 && !GAME.active) return;
  const t = GAME.target, colors = ['#d45555','#fff','#4a8fe7','#fff','#4cb88a','#fff','#e0b040','#fff','#555','#fff'];
  for (let i = 10; i >= 1; i--) {
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * i / 10, 0, Math.PI*2);
    ctx.fillStyle = colors[10-i]; ctx.fill();
    ctx.strokeStyle = '#00000030'; ctx.lineWidth = 0.5; ctx.stroke();
  }
}

function drawDrunk(diff) {
  if (diff.blur < 0.02) return;
  // ghost
  ctx.save(); ctx.globalAlpha = diff.blur*0.25; ctx.translate(diff.blur*12, diff.blur*6); drawTarget(diff); ctx.restore();
  // vignette
  const g = ctx.createRadialGradient(400,300,200,400,300,500);
  g.addColorStop(0,'transparent'); g.addColorStop(0.7,`rgba(0,0,0,${diff.blur*0.3})`); g.addColorStop(1,`rgba(0,0,0,${diff.blur*0.7})`);
  ctx.fillStyle=g; ctx.fillRect(0,0,800,600);
}

function drawFeedback() {
  if (flashT > 0) { ctx.fillStyle = `rgba(200,220,255,${flashT*5*0.1})`; ctx.fillRect(0,0,800,600); }
  if (feedT > 0 && feedPts >= 0) {
    const a = Math.min(1, feedT*2), yo = (1.5-feedT)*30;
    ctx.font = '700 36px Inter'; ctx.textAlign = 'center';
    ctx.fillStyle = feedPts===0?`rgba(210,80,80,${a})`:feedPts===10?`rgba(220,180,60,${a})`:`rgba(80,180,240,${a})`;
    ctx.fillText(feedPts===0?'PUDŁO!':feedPts===10?`BULLSEYE! +${feedPts}`:`+${feedPts}`, 400, 380-yo);
  }
}

function drawCrosshair(diff) {
  let cx=crossX, cy=crossY; if (recoilT>0) cy -= recoilT*40;
  const col = diff.bac>1?'rgba(210,80,80,0.85)':diff.bac>0.5?'rgba(220,180,60,0.82)':'rgba(80,180,240,0.85)';
  ctx.strokeStyle=col; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx-18,cy); ctx.lineTo(cx-4,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+4,cy); ctx.lineTo(cx+18,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-18); ctx.lineTo(cx,cy-4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy+4); ctx.lineTo(cx,cy+18); ctx.stroke();
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
}

function drawHUD(diff) {
  // Left panel
  ctx.fillStyle='rgba(12,14,28,0.7)'; roundRect(10,10,210,90,6);
  ctx.font='600 14px Inter'; ctx.fillStyle='#c8d0e6'; ctx.textAlign='left';
  ctx.fillText(`Wynik: ${GAME.totalScore}`, 20, 32);
  ctx.font='400 11px Inter'; ctx.fillStyle='#a0aabe';
  ctx.fillText(`Runda: ${GAME.round} / ${GAME.MAX_ROUNDS}`, 20, 52);
  ctx.fillText(`Strzały: ${GAME.shots} / ${GAME.SHOTS_PER_ROUND}`, 20, 68);
  if (GAME.round>0) { ctx.fillStyle='#8c96aa'; ctx.fillText(`Runda: ${GAME.roundScore} pkt`, 20, 84); }
  // Right panel
  ctx.fillStyle='rgba(12,14,28,0.7)'; roundRect(580,10,210,60,6);
  ctx.font='600 14px Inter'; ctx.fillStyle=diff.color; ctx.textAlign='right';
  ctx.fillText(`BAC: ${diff.bac.toFixed(2)} ‰`, 780, 32);
  ctx.font='400 11px Inter'; ctx.fillText(diff.level, 780, 52);
  // Shot dots
  if (GAME.shotHistory.length) {
    const sy=575, sx=400-GAME.shotHistory.length*14;
    GAME.shotHistory.forEach((p,i) => {
      ctx.fillStyle=p===0?'#d25050':p>=9?'#dcb43c':p>=7?'#50b4f0':'#8c96aa';
      ctx.beginPath(); ctx.arc(sx+i*28, sy, 10, 0, Math.PI*2); ctx.fill();
      ctx.font='700 8px Inter'; ctx.fillStyle='#000'; ctx.textAlign='center'; ctx.fillText(p, sx+i*28, sy+3);
    });
  }
}

function drawIntoxBar(diff) {
  if (diff.bac<=0) return;
  const bw=200,bh=12,bx=300,by=555;
  ctx.fillStyle='#121424'; roundRect(bx,by,bw,bh,6);
  const fill=Math.min(diff.bac/3,1);
  ctx.fillStyle=diff.color; roundRect(bx,by,bw*fill,bh,6);
}

function drawOverlay(title, sub, diff) {
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,800,600);
  ctx.font='700 36px Inter'; ctx.fillStyle='#dcb43c'; ctx.textAlign='center'; ctx.fillText(title, 400, 220);
  ctx.font='400 22px Inter'; ctx.fillStyle='#c8d0e6'; ctx.fillText(sub, 400, 270);
  if (GAME.roundScores.length) {
    ctx.font='400 15px Inter'; ctx.fillStyle='#8c96aa';
    GAME.roundScores.forEach((s,i) => ctx.fillText(`Runda ${i+1}: ${s} / 100 pkt`, 400, 310+i*28));
  }
  ctx.font='400 13px Inter'; ctx.fillStyle='#7882a0';
  ctx.fillText(GAME.over?'Kliknij "Nowa gra" aby zagrać ponownie':'Kliknij "Rozpocznij rundę" aby kontynuować', 400, 440);
}

function roundRect(x,y,w,h,r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill(); }

// === SCOREBOARD (Firebase Firestore) ===
const scoresRef = db.collection('scores');

function onGameOver() {
  const name = prompt('Wpisz swoje imię:');
  if (!name) return;
  scoresRef.add({
    name,
    score: GAME.totalScore,
    bac: parseFloat(cachedBAC.toFixed(2)),
    mode: GAME.dynamic ? 'Dynamiczna' : 'Statyczna',
    date: new Date().toLocaleDateString('pl-PL'),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => refreshScoreboard());
}

function refreshScoreboard() {
  scoresRef.orderBy('score', 'desc').limit(20).get().then(snap => {
    const tb = document.getElementById('scoresBody'); tb.innerHTML = '';
    const rec = document.getElementById('currentRecord');
    if (snap.empty) {
      rec.textContent = 'Aktualny rekord: brak – bądź pierwszy!';
      rec.style.color = '#555870';
      return;
    }
    snap.forEach((doc, i) => {
      const s = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${tb.rows.length + 1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.bac}</td><td>${s.mode || '-'}</td><td>${s.date}</td>`;
      tb.appendChild(tr);
    });
    const top = snap.docs[0].data();
    rec.textContent = `Aktualny rekord: ${top.score} pkt (${top.name})`;
    rec.style.color = '#e0b040';
  });
}

// === TABS + INIT ===
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs(); initCalc(); initGame(); refreshScoreboard();
});
