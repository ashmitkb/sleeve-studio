"use strict";
// ---------------------------------------------------------------- state and history
let state = lookState(LOOKS[0]), selected = state.layers[0].id, view = "flat", paintOn = false;
const brush = { kind: "ink", size: 3, color: COL.bone, mirror: false, erase: false };
let past = [], future = [], lastJson = JSON.stringify(state);
const KEY = "sleeve-studio-draft";
try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); if (d && Array.isArray(d.layers) && d.logo) { d.layers = d.layers.filter(l => PRESETS[l.type]); state = d; uid = Math.max(1, ...state.layers.map(l => l.id)) + 1; selected = state.layers[0]?.id ?? null; lastJson = JSON.stringify(state); } } catch (e) {}
function commit() { const j = JSON.stringify(state); if (j === lastJson) return; past.push(lastJson); if (past.length > 60) past.shift(); future = []; lastJson = j; try { localStorage.setItem(KEY, j); } catch (e) {} syncHistory(); runChecks(); }
function restore(j) { state = JSON.parse(j); lastJson = j; if (!state.layers.some(l => l.id === selected)) selected = state.layers[0]?.id ?? null; try { localStorage.setItem(KEY, j); } catch (e) {} buildPanels(); schedule(); }
const $ = id => document.getElementById(id);
function syncHistory() { $("undo").disabled = !past.length; $("redo").disabled = !future.length; }
let toastTimer = 0;
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove("show"), 3000); }

// ---------------------------------------------------------------- on-arm view
// The flat art wraps the front half of a tube. The tube follows an arm: elbow pinch, forearm bulge, wrist, slight bend.
const flatW = y => 170 - 60 * (y - 30) / 460;
const armProfile = y => 1 - .05 * Math.exp(-(((y - 245) / 30) ** 2)) + .07 * Math.exp(-(((y - 325) / 45) ** 2)) - .04 * Math.exp(-(((y - 480) / 25) ** 2));
const armBend = y => { const d = y - 250; return .075 * d / (1 + Math.exp(-d / 25)); };
const TB = 4, tabW = new Float32Array(560 * TB), tabB = new Float32Array(560 * TB); // lookups from y = -20 mm
for (let i = 0; i < tabW.length; i++) { const y = i / TB - 20; tabW[i] = flatW(y) / Math.PI * armProfile(y); tabB[i] = armBend(y); }
const look = (t, y) => t[Math.min(t.length - 1, Math.max(0, Math.round((y + 20) * TB)))];
let faceKey = "", faces = null;
function faceData(A) { // cached, so turning the arm doesn't redraw the artwork
  const key = JSON.stringify(state) + A + !!logoImg + (logoImg ? logoImg.src.length : 0); if (key === faceKey) return faces;
  const read = cv => cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height);
  const f = read(art(A)), b = read(art(A, state, false)); faceKey = key; faces = { w: f.width, h: f.height, front: f.data, back: b.data }; return faces;
}
function armImage(S, phi, repeat, A) {
  const F = faceData(A), PI = Math.PI, base = parseInt(state.base.slice(1), 16);
  const bc = [base >> 16 & 255, base >> 8 & 255, base & 255], dark = lum(state.base) < .3, rMax = 170 / PI * S * 1.08, y0 = 10;
  const w = Math.ceil(2 * rMax + 40 + armBend(520) * S), h = Math.ceil(520 * S + 40), cx0 = rMax + 20, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d"), im = c.createImageData(w, h), d = im.data, hOf = R => .17 * R;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v, wrap = a => { a = (a + PI) % (2 * PI); if (a < 0) a += 2 * PI; return a - PI; };
  const onFace = (a, wd) => { const f = Math.abs(a) > PI / 2 ? Math.sign(a) * PI - a : a; return CXA + f * wd / PI; }, CXA = 130;
  const clampX = x => Math.min(214.5, Math.max(45.5, x));
  // rim of the top opening, per screen column
  const wT = flatW(20), RT = look(tabW, 20) * S, cT = cx0 + armBend(20) * S, yf = new Float32Array(w), yb = new Float32Array(w), hT = hOf(RT);
  for (let X = 0; X < w; X++) { const t = (X + .5 - cT) / RT; if (Math.abs(t) > 1) { yf[X] = -1; continue; } const th = Math.asin(t), k = Math.cos(th);
    yf[X] = y0 + topY(clampX(onFace(wrap(th + phi), wT))) * S + hT * k; yb[X] = y0 + topY(clampX(onFace(wrap(PI - th + phi), wT))) * S - hT * k; }
  const sample = (src, x, y, o) => { const fx = x * A - .5, fy = y * A - .5, ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, W4 = F.w * 4, p = iy * W4 + ix * 4;
    for (let k = 0; k < 3; k++) o[k] = (src[p + k] * (1 - ax) + src[p + 4 + k] * ax) * (1 - ay) + (src[p + W4 + k] * (1 - ax) + src[p + W4 + 4 + k] * ax) * ay; };
  const px = [0, 0, 0], lightA = -.45;
  for (let Y = 0; Y < h; Y++) { let yEst = (Y + .5 - y0) / S; const rr = look(tabW, yEst) * S * 1.12 + 6, cr = cx0 + look(tabB, yEst) * S, full = yEst < 45, Xa = full ? 0 : Math.max(0, Math.floor(cr - rr)), Xb = full ? w : Math.min(w, Math.ceil(cr + rr));
    for (let X = Xa; X < Xb; X++) { const i = (Y * w + X) * 4, Xc = X + .5, Yc = Y + .5;
      if (yf[X] >= 0 && Yc >= yb[X] && Yc < yf[X]) { const dep = clamp01((Yc - yb[X]) / Math.max(1, yf[X] - yb[X])), t = (Xc - cT) / RT, sh = (.62 + .25 * (1 - dep) - .12 * Math.abs(t)) * .88; for (let k = 0; k < 3; k++) d[i + k] = bc[k] * sh + 9 * (dark ? 1 : 0); d[i + 3] = 255; continue; }
      let y = yEst, R = 0, cx = 0, t = 0, th = 0;
      for (let n = 0; n < 3; n++) { R = look(tabW, y) * S; cx = cx0 + look(tabB, y) * S; t = (Xc - cx) / R; t = t < -1 ? -1 : t > 1 ? 1 : t; th = Math.asin(t); y = (Yc - y0 - hOf(R) * Math.cos(th)) / S; }
      const edge = clamp01(R - Math.abs(Xc - cx) + .5); if (!edge) continue;
      const a = wrap(th + phi), isBack = Math.abs(a) > PI / 2, wd = flatW(y), xf = clampX(onFace(a, wd)), yT = topY(xf), yB = botY(xf), al = clamp01((y - yT) * S + .5) * clamp01((yB - y) * S + .5) * edge; if (!al) continue;
      const ys = Math.min(yB - .5, Math.max(yT + .5, y));
      if (isBack && !repeat) { px[0] = bc[0]; px[1] = bc[1]; px[2] = bc[2]; } else sample(isBack ? F.back : F.front, xf, ys, px);
      const dT = y - yT, dB = yB - y, co = Math.cos(th), lam = Math.max(0, Math.cos(th - lightA));
      let sh = (.58 + .42 * lam) * (.88 + .12 * co);
      sh *= 1 - .09 * Math.exp(-(((y - 250) / 22) ** 2)) * (.5 + .5 * Math.sin(y * .7 + th * 4));
      if (dT < 9 || dB < 6) sh *= .93;
      if ((Math.abs(dT - 8) < .35 || Math.abs(dB - 5) < .35) && Math.sin(th * 60) > 0) sh *= dark ? 1.5 : .78;
      const sheen = (dark ? 22 : 14) * Math.exp(-(((th - lightA + .15) / .22) ** 2)), n = 1 + (((X * 73856093 ^ Y * 19349663) >>> 0) % 997 / 997 - .5) * .05;
      for (let k = 0; k < 3; k++) d[i + k] = px[k] * sh * n + sheen; d[i + 3] = al * 255;
    } }
  c.putImageData(im, 0, 0); return cv;
}
function studioGround(c, w, h) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#ECEAE5"); g.addColorStop(1, "#D6D3CC"); c.fillStyle = g; c.fillRect(0, 0, w, h); }
function placeArm(c, img, cx, top, deg, S, q = 1) { c.save(); c.translate(cx, top + img.height / q / 2); c.rotate(deg * Math.PI / 180); c.scale(1 / q, 1 / q); c.shadowColor = "rgba(30,26,20,.32)"; c.shadowBlur = 18 * S; c.shadowOffsetX = 6 * S; c.shadowOffsetY = 8 * S; c.drawImage(img, -img.width / 2, -img.height / 2); c.restore(); }
function drawArm(c, w, h, barH) { studioGround(c, w, h); const S = Math.min((h - barH) / 545, w / 210), A = Math.min(6, Math.max(2, Math.ceil(S * 1.5))), q = armFast ? .4 : 1, img = armImage(S * q, armTurn * Math.PI / 180, armRepeat, A); placeArm(c, img, w / 2, Math.max(0, (h - barH - img.height / q) / 2), -2, S, q); }

// ---------------------------------------------------------------- stage
let armTurn = 0, armRepeat = false, armFast = false, armTimer = 0, flatT = { k: 1, ox: 0, oy: 0 };
const stage = $("stage"), sc = stage.getContext("2d");
let pending = false;
function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); }
function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function render() {
  const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect(), w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
  if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
  sc.setTransform(1, 0, 0, 1, 0, 0);
  if (view === "lay") { drawPair(sc, w, h); return; }
  if (view === "arm") { drawArm(sc, w, h, 56 * dpr); return; }
  const barH = paintOn ? $("stageBar").offsetHeight * dpr + 16 * dpr : 34 * dpr, k = Math.min((h - barH) / 540, w / 330), ox = (w - W * k) / 2, oy = (h - barH - H * k) / 2; flatT = { k, ox, oy };
  sc.fillStyle = css("--stage"); sc.fillRect(0, 0, w, h);
  const step = 50 * k; sc.strokeStyle = css("--stage-line"); sc.lineWidth = Math.max(1, dpr * .5); sc.beginPath();
  for (let x = ox % step; x < w; x += step) { sc.moveTo(x, 0); sc.lineTo(x, h); } for (let y = oy % step; y < h; y += step) { sc.moveTo(0, y); sc.lineTo(w, y); } sc.stroke();
  sc.save(); sc.shadowColor = "rgba(0,0,0,.22)"; sc.shadowBlur = 18 * dpr; sc.shadowOffsetY = 5 * dpr; sc.drawImage(art(k), ox, oy); sc.restore();
  if ($("zones").checked) drawZones(k, ox, oy, dpr);
}
function drawZones(k, ox, oy, dpr) {
  sc.save(); sc.translate(ox, oy); sc.scale(k, k);
  sc.save(); sc.clip(sleevePath); sc.fillStyle = "rgba(255,190,70,.14)"; sc.fillRect(0, ELBOW[0], W, ELBOW[1] - ELBOW[0]); sc.restore();
  sc.strokeStyle = "rgba(255,190,70,.75)"; sc.lineWidth = 1 / k * dpr; sc.setLineDash([4, 3]);
  sc.beginPath(); sc.moveTo(xl(40) + 10, 40); sc.lineTo(xl(482) + 10, 482); sc.moveTo(xr(40) - 10, 40); sc.lineTo(xr(482) - 10, 482); sc.stroke(); sc.setLineDash([]);
  sc.fillStyle = css("--warn"); sc.font = `6px "Archivo", sans-serif`; sc.textAlign = "left"; sc.textBaseline = "middle"; sc.fillText("elbow", xr(245) + 6, 240); sc.fillText("stretch", xr(245) + 6, 248);
  sc.restore();
}

// ---------------------------------------------------------------- panels
function thumb(cv, st) { const cw = 260, ch = 112, s = .46, a = art(s, st, false), c = cv.getContext("2d"); cv.width = cw; cv.height = ch; c.translate(cw / 2, ch / 2); c.rotate(Math.PI / 2); c.drawImage(a, -a.width / 2, -a.height / 2 - 2); }
let lib = "hand", group = "Ink", tab = "looks";
const SETS = { hand: ["Ink", "Paint", "Drawn", "Wear"], classic: ["Lines", "Texture", "Shapes", "Marks"] }, thumbJobs = [];
function applyLook(l, shuffle) { const st = lookState(l), keep = state.logo; st.logo = { ...keep, color: l.logo, on: l.logo !== l.base && keep.on !== false, font: st.logo.font, size: st.logo.size, track: st.logo.track }; state = st; if (shuffle) state.layers.forEach(x => { x.seed = 1 + Math.floor(Math.random() * 9999); }); selected = state.layers[0].id; commit(); buildPanels(); schedule(); }
function setTab(t) { tab = tab === t ? null : t; document.querySelectorAll("#rail button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === tab)); $("drawer").classList.toggle("closed", !tab); for (const [id, k] of [["tabLooks", "looks"], ["tabAdd", "add"], ["tabLayers", "layers"], ["tabLogo", "logo"], ["tabExport", "export"]]) $(id).hidden = tab !== k; }
const openTab = t => { if (tab !== t) setTab(t); };
function showGroup() {
  document.querySelectorAll("[data-lib]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lib === lib));
  document.querySelectorAll("#looks .card").forEach(c => { c.hidden = c.dataset.set !== lib; });
  $("groups").textContent = ""; SETS[lib].forEach(g => { const b = document.createElement("button"); b.textContent = g; b.setAttribute("aria-pressed", g === group); b.onclick = () => { group = g; showGroup(); }; $("groups").append(b); });
  document.querySelectorAll("#presets .card").forEach(c => { c.hidden = c.dataset.group !== group; });
}
function buildLibrary() {
  LOOKS.forEach(l => { const b = document.createElement("button"); b.className = "card"; b.dataset.set = l.set || "classic"; b.innerHTML = `<canvas></canvas><span>${l.name}</span>`; b.onclick = () => { applyLook(l); fadeStage(); toast(`${l.name} loaded`); }; $("looks").append(b); const job = () => thumb(b.firstChild, lookState(l)); thumbJobs.push(job); job(); });
  Object.entries(PRESETS).filter(([, P]) => !P.paint).forEach(([t, P]) => { const b = document.createElement("button"); b.className = "card"; b.dataset.group = P.group; b.innerHTML = `<canvas></canvas><span>${P.name}</span>`; b.onclick = () => { const light = lum(state.base) > .5, l = makeLayer(t, { color: P.knock ? state.base : light ? COL.ink : COL.bone }); state.layers.push(l); selected = l.id; commit(); buildPanels(); schedule(); openTab("layers"); toast(`${P.name} added`); }; $("presets").append(b); const th = P.knock ? { base: COL.bone, layers: [makeLayer("block", { color: COL.ink, seed: 1, p: { left: -60, right: -60 } }), makeLayer(t, { seed: 7, color: COL.bone })], logo: { on: false } } : { base: COL.ink, layers: [makeLayer(t, { seed: 7 })], logo: { on: false } }, job = () => thumb(b.firstChild, th); thumbJobs.push(job); job(); });
  document.querySelectorAll("[data-lib]").forEach(b => { b.onclick = () => { lib = b.dataset.lib; group = SETS[lib][0]; showGroup(); }; });
  showGroup();
}
function swatches(host, current, set, keys = Object.keys(COL)) {
  host.textContent = "";
  for (const n of keys) { const v = COL[n], b = document.createElement("button"); b.className = "sw"; b.style.background = v; b.title = n; b.setAttribute("aria-label", n); b.setAttribute("aria-pressed", String(v.toLowerCase() === current.toLowerCase())); b.onclick = () => { set(v); commit(); buildPanels(); schedule(); }; host.append(b); }
  const i = document.createElement("input"); i.type = "color"; i.value = current; i.id = host.id + "Custom"; i.setAttribute("aria-label", "Custom colour"); i.oninput = () => { set(i.value); schedule(); }; i.onchange = () => { commit(); buildPanels(); }; host.append(i);
}
function slider(host, id, label, q, get, set) {
  const row = document.createElement("div"); row.className = "row"; const fmt = v => (q.step < 1 ? (+v).toFixed(q.step < .1 ? 2 : 1) : v) + (q.unit ? " " + q.unit : "");
  row.innerHTML = `<label for="${id}">${label}</label><input type="range" id="${id}" min="${q.min}" max="${q.max}" step="${q.step}"><output>${fmt(get())}</output>`;
  const inp = row.children[1], out = row.children[2]; inp.value = get(); inp.oninput = () => { set(+inp.value); out.textContent = fmt(inp.value); schedule(); runChecks(); }; inp.onchange = commit; host.append(row);
}
function choice(host, id, label, q, get, set) {
  const row = document.createElement("div"); row.className = "row2"; row.innerHTML = `<label for="${id}">${label}</label><select id="${id}">${q.options.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`; const se = row.children[1]; se.value = get(); se.onchange = () => { set(+se.value); commit(); schedule(); }; host.append(row);
}
function buildLayers() {
  const host = $("layers"); host.textContent = "";
  if (!state.layers.length) { host.innerHTML = '<p class="note">Nothing here yet. Pick a look or add a layer.</p>'; return; }
  [...state.layers].reverse().forEach(l => { const i = state.layers.indexOf(l), d = document.createElement("div"); d.className = "layer" + (l.id === selected ? " on" : "") + (l.hidden ? " hiddenLayer" : "");
    d.innerHTML = `<button class="pick"><span class="chip" style="background:${l.color}"></span><b>${PRESETS[l.type].name}</b></button><span class="acts"><button aria-label="Move up" title="Move up">${ic("arrow-up", 15)}</button><button aria-label="Move down" title="Move down">${ic("arrow-down", 15)}</button><button aria-label="${l.hidden ? "Show" : "Hide"} layer" title="${l.hidden ? "Show" : "Hide"}">${ic(l.hidden ? "eye-off" : "eye", 15)}</button><button aria-label="Delete layer" title="Delete">${ic("trash-2", 15)}</button></span>`;
    const [up, dn, hide, del] = d.querySelectorAll(".acts button"), done = () => { commit(); buildPanels(); schedule(); };
    d.querySelector(".pick").onclick = () => { selected = l.id; buildPanels(); }; up.disabled = i === state.layers.length - 1; dn.disabled = i === 0;
    up.onclick = () => { state.layers.splice(i, 1); state.layers.splice(i + 1, 0, l); done(); }; dn.onclick = () => { state.layers.splice(i, 1); state.layers.splice(i - 1, 0, l); done(); };
    hide.onclick = () => { l.hidden = !l.hidden; done(); }; del.onclick = () => { state.layers.splice(i, 1); if (selected === l.id) selected = state.layers[0]?.id ?? null; done(); toast(`${PRESETS[l.type].name} deleted`); };
    host.append(d); });
}
function buildSettings() {
  const host = $("settings"), l = state.layers.find(x => x.id === selected); host.textContent = ""; host.hidden = !l; if (!l) return; const P = PRESETS[l.type];
  if (!P.noSide) { const d = document.createElement("div"); d.className = "seg"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "Sits on"); d.style.justifySelf = "start"; [["L", "Left"], ["both", "Both sides"], ["R", "Right"]].forEach(([v, t]) => { const b = document.createElement("button"); b.textContent = t; b.setAttribute("aria-pressed", l.side === v); b.onclick = () => { l.side = v; commit(); buildSettings(); schedule(); }; d.append(b); }); host.append(d); }
  if (P.text) { const d = document.createElement("div"); d.className = "row2"; d.innerHTML = '<label for="lText">Text</label><input type="text" id="lText" maxlength="30">'; const t = d.children[1]; t.value = l.text ?? "AREABOYS"; t.oninput = () => { l.text = t.value; schedule(); }; t.onchange = commit; host.append(d); }
  P.params.forEach(q => (q.options ? choice : slider)(host, "p_" + q.k, q.label, q, () => l.p[q.k], v => l.p[q.k] = v));
  if (P.paint) { const n = document.createElement("p"); n.className = "note"; n.textContent = `${l.strokes.length} stroke${l.strokes.length === 1 ? "" : "s"}. Press Paint to draw on this layer.`; const cl = document.createElement("button"); cl.id = "lClear"; cl.className = "quiet"; cl.textContent = "Clear all strokes"; cl.disabled = !l.strokes.length; cl.onclick = () => { l.strokes = []; l.rev = (l.rev || 0) + 1; commit(); buildPanels(); schedule(); toast("Strokes cleared"); }; host.append(n, cl); }
  else if (!P.knock) { const sw = document.createElement("div"); sw.className = "swatches"; sw.id = "layerSw"; host.append(sw); swatches(sw, l.color, v => l.color = v); }
  const dt = document.createElement("details"); dt.open = l.from > 0 || l.to < 46 || l.avoid; dt.innerHTML = "<summary>Position on the arm</summary><div></div>"; const in2 = dt.lastChild;
  slider(in2, "lFrom", "Start", { min: 0, max: 46, step: 1, unit: "cm" }, () => l.from, v => { l.from = Math.min(v, l.to - 1); });
  slider(in2, "lTo", "End", { min: 0, max: 46, step: 1, unit: "cm" }, () => l.to, v => { l.to = Math.max(v, l.from + 1); });
  const ck = document.createElement("label"); ck.className = "check"; ck.innerHTML = '<input type="checkbox" id="lAvoid"> Keep clear of the elbow'; ck.firstChild.checked = l.avoid; ck.firstChild.onchange = e => { l.avoid = e.target.checked; commit(); schedule(); }; in2.append(ck); host.append(dt);
  if (P.paint) return;
  const b = document.createElement("div"); b.className = "btns"; b.innerHTML = `<button class="quiet" id="lShuffle">${ic("shuffle", 15)}New variation</button><button class="quiet" id="lDup">${ic("copy", 15)}Duplicate</button>`; b.children[0].onclick = () => { l.seed = 1 + Math.floor(Math.random() * 9999); commit(); schedule(); }; b.children[1].onclick = () => { const c = { ...JSON.parse(JSON.stringify(l)), id: uid++, seed: 1 + Math.floor(Math.random() * 9999) }; state.layers.push(c); selected = c.id; commit(); buildPanels(); schedule(); }; host.append(b);
}
function buildLogo() {
  const g = state.logo; $("logoOn").checked = g.on; $("logoText").value = g.text; $("logoFont").value = g.font; $("logoDir").value = g.dir;
  const host = $("logoSliders"), more = $("logoMore"); host.textContent = ""; more.textContent = "";
  slider(host, "gSize", "Height", { min: 3, max: 40, step: .5, unit: "mm" }, () => g.size, v => g.size = v);
  slider(host, "gY", "Along arm", { min: 30, max: 485, step: 1, unit: "mm" }, () => g.y, v => g.y = v);
  slider(more, "gX", "Across", { min: 0, max: 100, step: 1, unit: "%" }, () => g.across, v => g.across = v);
  slider(more, "gT", "Spacing", { min: 0, max: 40, step: 1 }, () => g.track, v => g.track = v);
  swatches($("logoSw"), g.color, v => g.color = v, ["ink", "bone", "white", "lime", "red"]); $("logoClear").hidden = !logoImg;
}
function buildPanels() { swatches($("baseSw"), state.base, v => { state.base = v; state.layers.forEach(l => { if (PRESETS[l.type].knock) l.color = v; }); }); swatches($("paintSw"), brush.color, v => brush.color = v, ["ink", "bone", "lime", "red"]); buildLayers(); buildSettings(); buildLogo(); syncHistory(); runChecks(); }

// ---------------------------------------------------------------- print check
function runChecks() {
  const vis = state.layers.filter(l => !l.hidden), items = [], g = state.logo; let thin = 99, elbow = [];
  for (const l of vis) { const m = Math.min(...primsOf(l).filter(q => q.t !== "dots").map(q => q.w), 99); thin = Math.min(thin, m); const crosses = bandsOf(l).some(([a, b]) => a < ELBOW[1] && b > ELBOW[0]); if (crosses && m < .75 && !PRESETS[l.type].set) elbow.push(PRESETS[l.type].name); }
  items.push(thin >= .6 ? [1, "Lines are 0.6 mm or thicker."] : [0, `Thinnest line is ${thin.toFixed(2)} mm. Go to 0.6 mm or more so it survives stretch.`]);
  items.push(!elbow.length ? [1, "No hairlines across the elbow."] : [0, `${[...new Set(elbow)].join(", ")} crosses the elbow with lines under 0.75 mm. Thicken them or keep them clear of the elbow.`]);
  if (g.on) { const inElbow = g.y > ELBOW[0] - 12 && g.y < ELBOW[1] + 12, [x, y] = logoPos(g), span = g.dir === "across" ? g.size * Math.max(1, g.text.length) * .25 : g.size / 2, near = Math.min(x - xl(y), xr(y) - x) - span < 10;
    items.push(inElbow ? [0, "Logo sits in the elbow stretch zone. Move it toward the wrist or shoulder."] : near ? [0, "Logo is within 10 mm of a seam. Move it inward."] : [1, "Logo is clear of the elbow and seams."]); }
  const bad = items.filter(i => !i[0]).length, pill = $("printPill"); pill.textContent = bad ? `Print check: ${bad} to fix` : "Print check: OK"; pill.classList.toggle("bad", !!bad);
  $("checks").innerHTML = items.map(([ok, t]) => `<li><i class="${ok ? "pass" : "fix"}">${ok ? "OK" : "FIX"}</i><span>${t}</span></li>`).join("");
}

// ---------------------------------------------------------------- export
const dl = window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
async function save(filename, data) {
  const d = await dl;
  if (d) { try { await d.save({ filename, data }); toast(`Saved ${filename}.`); } catch (e) { toast(e && e.code === "declined" ? "Save cancelled." : `Couldn't save ${filename}. Try again in a moment.`); } return; }
  if (d === null) { toast("Saving isn't available in this view. Open the page on claude.ai."); return; }
  const a = document.createElement("a"), url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast(`Saved ${filename}.`);
}
const blobOf = cv => new Promise(r => cv.toBlob(r, "image/png"));
const num = n => +n.toFixed(2);
function logoRaster(g) { // the logo goes into the SVG as a 600 dpi image, so the printer needs no font
  const s = 24, c0 = document.createElement("canvas").getContext("2d"); let wmm, hmm;
  if (logoImg) { hmm = g.size; wmm = hmm * logoImg.width / logoImg.height; }
  else { c0.font = `100px "${g.font}"`; if ("letterSpacing" in c0) c0.letterSpacing = `${g.track}px`; wmm = c0.measureText(g.text).width * g.size / 100 + 2; hmm = g.size * 1.7; }
  const cv = document.createElement("canvas"); cv.width = Math.ceil(wmm * s); cv.height = Math.ceil(hmm * s); const c = cv.getContext("2d"); c.translate(cv.width / 2, cv.height / 2); c.scale(s, s);
  paintLogo(c, g); return { url: cv.toDataURL("image/png"), w: wmm, h: hmm };
}
function buildSvg() {
  const defs = [`<clipPath id="sleeve"><path d="${SLEEVE}"/></clipPath>`], body = [];
  state.layers.filter(l => !l.hidden).forEach((l, n) => { const inner = [];
    if (PRESETS[l.type].text) { const s = 12, cv = document.createElement("canvas"); cv.width = W * s; cv.height = H * s; const c = cv.getContext("2d"); c.scale(s, s); drawLayer(c, l); body.push(`<image href="${cv.toDataURL("image/png")}" x="0" y="0" width="${W}" height="${H}"/>`); return; }
    primsOf(l).forEach((q, m) => { if (q.t !== "grad") return; const id = `grad${n}_${m}`; defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(q.a[0])}" y1="${num(q.a[1])}" x2="${num(q.b[0])}" y2="${num(q.b[1])}"><stop offset="0" stop-color="${l.color}"/><stop offset="1" stop-color="${l.color}" stop-opacity="0"/></linearGradient>`); inner.push(`<rect x="${q.box[0]}" y="${q.box[1]}" width="${q.box[2]}" height="${q.box[3]}" fill="url(#${id})" opacity="${q.o}"/>`); });
    for (const q of primsOf(l)) { if (q.t === "grad") continue; const op = q.o < 1 ? ` opacity="${q.o}"` : "", col = q.c || l.color;
      if (q.t === "line") inner.push(`<polyline points="${q.pts.map(([x, y]) => num(x) + "," + num(y)).join(" ")}" fill="none" stroke="${col}" stroke-width="${num(q.w)}" stroke-linecap="round" stroke-linejoin="round"${op}/>`);
      else if (q.t === "poly") inner.push(`<path d="M${q.pts.map(([x, y]) => num(x) + " " + num(y)).join("L")}Z" fill="${col}"${op}/>`);
      else inner.push(`<path d="${q.arr.map(([x, y, r]) => `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0`).join("")}" fill="${col}"${op}/>`); }
    defs.push(`<clipPath id="band${n}">${bandsOf(l).map(([a, b]) => `<rect x="-20" y="${a}" width="300" height="${b - a}"/>`).join("")}</clipPath>`);
    body.push(`<g id="${PRESETS[l.type].name.replace(/\W+/g, "-")}-${n}" clip-path="url(#band${n})">${inner.join("")}</g>`); });
  if (state.logo.on) { const g = state.logo, [x, y] = logoPos(g), r = logoRaster(g); body.push(`<image href="${r.url}" x="${num(x - r.w / 2)}" y="${num(y - r.h / 2)}" width="${num(r.w)}" height="${num(r.h)}"${g.dir === "along" ? ` transform="rotate(-90 ${num(x)} ${num(y)})"` : ""}/>`); }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260mm" height="520mm" viewBox="0 0 260 520">\n<!-- 1 unit = 1 mm. Sleeve 46 cm long, 17 cm top, 11 cm wrist. -->\n<defs>${defs.join("")}</defs>\n<path d="${SLEEVE}" fill="${state.base}"/>\n<g clip-path="url(#sleeve)">\n${body.join("\n")}\n</g>\n</svg>\n`;
}

// ---------------------------------------------------------------- wiring
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fadeStage = () => { if (!calm) stage.animate([{ opacity: .15 }, { opacity: 1 }], { duration: 260, easing: "ease-out" }); };
function setView(v) { if (v !== view) fadeStage(); view = v; if (v !== "flat" && paintOn) setPaint(false); $("vFlat").setAttribute("aria-pressed", v === "flat"); $("vLay").setAttribute("aria-pressed", v === "lay"); $("vArm").setAttribute("aria-pressed", v === "arm"); $("zonesLabel").hidden = v !== "flat"; $("armBar").hidden = v !== "arm"; stage.classList.toggle("grab", v === "arm"); schedule(); }
$("vFlat").onclick = () => setView("flat"); $("vLay").onclick = () => setView("lay"); $("vArm").onclick = () => setView("arm");
function setTurn(deg) { deg = ((Math.round(deg) + 180) % 360 + 360) % 360 - 180; armTurn = deg; $("armTurn").value = deg; $("armTurnOut").textContent = deg + "°"; armFast = true; clearTimeout(armTimer); armTimer = setTimeout(() => { armFast = false; schedule(); }, 180); schedule(); }
$("armTurn").oninput = e => setTurn(+e.target.value);
$("aFront").onclick = () => setTurn(0); $("aLeft").onclick = () => setTurn(-90); $("aRight").onclick = () => setTurn(90);
$("armBack").onchange = e => { armRepeat = e.target.value === "repeat"; schedule(); };
let dragX = null;
stage.addEventListener("pointerdown", e => { if (view !== "arm") return; dragX = e.clientX; stage.setPointerCapture(e.pointerId); });
stage.addEventListener("pointermove", e => { if (dragX === null) return; setTurn(armTurn - (e.clientX - dragX) * .7); dragX = e.clientX; });
const endDrag = () => { dragX = null; }; stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
$("xArm").onclick = async () => { toast("Rendering on-arm views…"); await new Promise(r => setTimeout(r, 30)); const cv = document.createElement("canvas"), W2 = 1800, H2 = 2000, S = 3.5; cv.width = W2; cv.height = H2; const c = cv.getContext("2d"); studioGround(c, W2, H2);
  [[0, W2 * .3, -2], [70, W2 * .7, 3]].forEach(([deg, x, tilt]) => { const img = armImage(S, deg * Math.PI / 180, armRepeat, 6); placeArm(c, img, x, (H2 - img.height) / 2, tilt, S); }); save("sleeve-on-arm.png", await blobOf(cv)); };
$("zones").onchange = schedule;
$("undo").onclick = () => { if (!past.length) return; future.push(lastJson); restore(past.pop()); };
$("redo").onclick = () => { if (!future.length) return; past.push(lastJson); restore(future.pop()); };
addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.target.type !== "text") { e.preventDefault(); $(e.shiftKey ? "redo" : "undo").click(); } });
$("shuffleAll").onclick = () => { state.layers.forEach(l => l.seed = 1 + Math.floor(Math.random() * 9999)); commit(); schedule(); toast("Shuffled"); };
const logoField = (id, key, ev = "onchange") => { $(id)[ev] = () => { state.logo[key] = $(id).type === "checkbox" ? $(id).checked : $(id).value; schedule(); runChecks(); if (ev === "onchange") commit(); }; };
logoField("logoOn", "on"); logoField("logoFont", "font"); logoField("logoDir", "dir"); logoField("logoText", "text", "oninput"); $("logoText").onchange = commit;
$("logoFile").onchange = e => { const f = e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { logoImg = im; $("logoClear").hidden = false; schedule(); toast(`Using ${f.name}.`); }; im.onerror = () => toast("That file couldn't be read as an image."); im.src = fr.result; }; fr.readAsDataURL(f); };
$("logoClear").onclick = () => { logoImg = null; $("logoFile").value = ""; $("logoClear").hidden = true; schedule(); };
function setPaint(on) { paintOn = on; $("paintBtn").setAttribute("aria-pressed", on); $("paintBtn").innerHTML = ic(on ? "check" : "paintbrush") + (on ? "Done" : "Paint"); $("paintBar").hidden = !on; stage.classList.toggle("paint", on); if (on) { if (view !== "flat") setView("flat"); paintLayer(); if (tab) setTab(tab); toast("Draw on the sleeve"); } schedule(); }
function paintLayer() { let l = state.layers.find(x => x.id === selected && x.type === "paint") || [...state.layers].reverse().find(x => x.type === "paint"); if (!l) { l = makeLayer("paint", { strokes: [], color: brush.color }); state.layers.push(l); commit(); } if (selected !== l.id) { selected = l.id; buildPanels(); } if (l.hidden) { l.hidden = false; buildPanels(); } return l; }
$("paintBtn").onclick = () => setPaint(!paintOn);
const BR = { bInk: "ink", bMarker: "marker", bDry: "dry", bSpray: "spray" };
for (const id of [...Object.keys(BR), "bErase"]) $(id).onclick = () => { brush.erase = id === "bErase"; if (!brush.erase) brush.kind = BR[id]; for (const o of [...Object.keys(BR), "bErase"]) $(o).setAttribute("aria-pressed", o === id); };
$("bSize").oninput = e => { brush.size = +e.target.value; $("bSizeOut").textContent = brush.size.toFixed(1) + " mm"; };
$("bMirror").onchange = e => { brush.mirror = e.target.checked; };
const stageMM = e => { const r = stage.getBoundingClientRect(), s = stage.width / r.width; return [((e.clientX - r.left) * s - flatT.ox) / flatT.k, ((e.clientY - r.top) * s - flatT.oy) / flatT.k]; };
const r2 = v => Math.round(v * 100) / 100;
function addPoint(e) { const [x, y] = stageMM(e), pts = stroke.pts, last = pts[pts.length - 1]; if (last && Math.hypot(x - last[0], y - last[1]) < .35) return; pts.push([r2(x), r2(y), e.pointerType === "pen" ? r2(e.pressure || .05) : .55]); }
function eraseAt(e, l) { const [x, y] = stageMM(e), rad = Math.max(3, brush.size / 2), hit = st => st.pts.some(([a, b]) => Math.hypot(a - x, b - y) < rad + st.size / 2 || (st.mirror && Math.hypot(xl(b) + xr(b) - a - x, b - y) < rad + st.size / 2)), keep = l.strokes.filter(st => !hit(st)); if (keep.length !== l.strokes.length) { l.strokes = keep; l.rev = (l.rev || 0) + 1; schedule(); } }
let stroke = null, paintL = null, erasing = false, penSeen = false;
stage.addEventListener("pointerdown", e => { if (!paintOn) return; if (e.pointerType === "pen") penSeen = true; if (e.pointerType === "touch" && penSeen) return; e.preventDefault(); stage.setPointerCapture(e.pointerId); paintL = paintLayer();
  if (brush.erase) { erasing = true; eraseAt(e, paintL); return; } stroke = { kind: brush.kind, size: brush.size, color: brush.color, mirror: brush.mirror, seed: 1 + Math.floor(Math.random() * 99999), pts: [] }; paintL.strokes.push(stroke); addPoint(e); paintL.rev = (paintL.rev || 0) + 1; schedule(); });
stage.addEventListener("pointermove", e => { if (erasing) { eraseAt(e, paintL); return; } if (!stroke) return; e.preventDefault(); for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : []).concat(e)) addPoint(ev); strokeCache.delete(stroke); paintL.rev++; schedule(); });
const endStroke = () => { if (!stroke && !erasing) return; if (stroke) strokeCache.delete(stroke); stroke = null; erasing = false; commit(); buildPanels(); schedule(); };
stage.addEventListener("pointerup", endStroke); stage.addEventListener("pointercancel", endStroke);
$("xSvg").onclick = () => save("sleeve-print.svg", buildSvg());
$("xPng").onclick = async () => { toast("Rendering at 300 dpi…"); await new Promise(r => setTimeout(r, 30)); save("sleeve-print-300dpi.png", await blobOf(art(11.811))); };
$("xSmall").onclick = async () => save("sleeve-flat-4x.png", await blobOf(art(4)));
$("xLay").onclick = async () => { toast("Rendering flat-lay…"); await new Promise(r => setTimeout(r, 30)); const cv = document.createElement("canvas"); cv.width = 2400; cv.height = 1800; drawPair(cv.getContext("2d"), 2400, 1800); save("sleeve-flatlay.png", await blobOf(cv)); };
document.querySelectorAll("#rail button").forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
$("printPill").onclick = () => openTab("export");
new ResizeObserver(schedule).observe($("stageWrap"));
buildLibrary();
const wanted = new URLSearchParams(location.search).get("look"), wantedLook = LOOKS.find(l => l.name === wanted);
if (wantedLook) { applyLook(wantedLook); if (!wantedLook.set) { lib = "classic"; group = SETS.classic[0]; showGroup(); } history.replaceState(null, "", "studio.html"); toast(`${wantedLook.name} loaded`); }
buildPanels(); schedule();
$("surprise").onclick = () => { const pool = LOOKS.filter(l => (l.set || "classic") === lib), l = pool[Math.floor(Math.random() * pool.length)]; applyLook(l, true); fadeStage(); toast(`Here's ${l.name}`); };
const coach = $("coach"), seen = () => { try { return localStorage.getItem("sleeve-studio-welcomed"); } catch (e) { return "1"; } };
$("helpBtn").onclick = () => coach.showModal();
$("coachGo").onclick = () => { coach.close(); };
coach.addEventListener("close", () => { try { localStorage.setItem("sleeve-studio-welcomed", "1"); } catch (e) {} });
if (!seen() && !wantedLook) coach.showModal();
if (document.fonts) { Promise.all(["Anton", ...HAND_FONTS].map(f => document.fonts.load(`100px "${f}"`))).then(() => { primCache.clear(); thumbJobs.forEach(j => j()); schedule(); }).catch(() => {}); ["100px Anton", '100px "IBM Plex Mono"', "100px Archivo"].forEach(f => document.fonts.load(f).then(schedule).catch(() => {})); document.fonts.ready.then(schedule); }
