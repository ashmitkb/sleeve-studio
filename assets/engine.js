"use strict";
// Shared sleeve engine: template geometry, presets, looks and artwork drawing.
let logoImg = null;
// ---------------------------------------------------------------- template geometry (1 unit = 1 mm)
const W = 260, H = 520, ELBOW = [205, 285];
const SLEEVE = "M45 30 Q130 0 215 30 L185 490 Q130 498 75 490 Z";
const xl = y => 45 + 30 * (y - 30) / 460, xr = y => 215 - 30 * (y - 30) / 460, half = y => (xr(y) - xl(y)) / 2;
const seam = (s, u, y) => s === "L" ? [xl(y) + u, y] : [xr(y) - u, y];
const topY = ax => { const t = (ax - 45) / 170; return 30 * ((1 - t) ** 2 + t * t); };
const botY = ax => { const t = (185 - ax) / 110; return 490 + 16 * t * (1 - t); };
const COL = { ink: "#0C0C0C", charcoal: "#1F1F1E", navy: "#141A24", olive: "#3C4233", bone: "#E7E2D7", cotton: "#D3CCBD", white: "#F4F4F2", lime: "#C6F432", red: "#D7263D" };

function makeRng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const wave = (r, n, f0, f1) => { const p = []; for (let i = 0; i < n; i++) p.push([f0 + r() * (f1 - f0), r() * 6.3, .5 + r() * .5]); const tot = p.reduce((s, q) => s + q[2], 0); return t => p.reduce((s, [f, ph, a]) => s + a * Math.sin(f * t + ph), 0) / tot; };
function walk(r, start, ang, len, wig = .18) {
  const pts = [start]; let a = ang, [x, y] = start, d = 0;
  while (d < len) { const st = 2.5 + r() * 2.5; a += (r() + r() + r() - 1.5) * wig * 1.2; a = ang + (a - ang) * .75; x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]); d += st; }
  return pts;
}
function ribbon(pts, w0, w1) {
  const L = [], R = [], n = pts.length;
  pts.forEach(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)]; const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / Math.max(1, n - 1)) / 2; L.push([x - dy / l * w, y + dx / l * w]); R.push([x + dy / l * w, y - dx / l * w]); });
  return L.concat(R.reverse());
}
const line = (pts, w, o = 1) => ({ t: "line", pts, w, o });
const poly = (pts, w, o = 1) => ({ t: "poly", pts, w, o });
const dots = (arr, w, o = 1) => ({ t: "dots", arr, w, o });

// digits as strokes, so ruler numbers stay vector with no font needed
const SEG = { a: [[0, 0], [1, 0]], b: [[1, 0], [1, 1]], c: [[1, 1], [1, 2]], d: [[0, 2], [1, 2]], e: [[0, 1], [0, 2]], f: [[0, 0], [0, 1]], g: [[0, 1], [1, 1]] };
const DIG = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abfgcd"];
function strokeNumber(n, x, y, h, w) { // reads along the arm, wrist to shoulder
  const out = [], s = h / 2, str = String(n), adv = s * 1.6, total = adv * str.length - s * .6;
  [...str].forEach((ch, i) => { for (const k of DIG[+ch]) { const pts = SEG[k].map(([px, py]) => { const lx = i * adv + px * s - total / 2, ly = py * s - h / 2; return [x + ly, y - lx]; }); out.push(line(pts, w)); } });
  return out;
}

// ---------------------------------------------------------------- presets
const S = (k, label, min, max, step, def, unit = "") => ({ k, label, min, max, step, def, unit });
const PRESETS = {
  fracture: { name: "Fracture", params: [S("cracks", "Cracks", 1, 7, 1, 4), S("reach", "Reach", 30, 170, 1, 120, "mm"), S("branch", "Branching", 0, 1, .05, .55), S("weight", "Weight", .6, 2.4, .1, 1.3, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.cracks; i++) {
        const y = 45 + (i + .2 + r() * .6) / p.cracks * 425, dir = r() < .5 ? -1 : 1, tilt = .17 + r() * .27;
        const a0 = dir * (Math.PI / 2 - tilt), ang = s === "L" ? a0 : Math.PI - a0;
        const pts = walk(r, seam(s, -3, y), ang, p.reach * (.6 + r() * .4));
        out.push(poly(ribbon(pts, p.weight, .12), p.weight));
        if (r() < p.branch) { const j = Math.floor(pts.length * (.25 + r() * .3)), b = walk(r, pts[j], ang + (r() < .5 ? -1 : 1) * (.3 + r() * .4), 14 + r() * 24, .22); const bw = Math.max(.6, p.weight * .65); out.push(poly(ribbon(b, bw, .08), bw, .85)); }
      } return out; } },
  hairline: { name: "Hairline", params: [S("lines", "Lines", 1, 26, 1, 12), S("gap", "Spacing", .8, 6, .1, 1.6, "mm"), S("stagger", "Stagger", 0, 1, .05, .55), S("weight", "Weight", .6, 2, .05, .8, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { let u = 3, g = p.gap;
        for (let i = 0; i < p.lines; i++) { const f = i / Math.max(1, p.lines - 1), trim = p.stagger * 300 * f ** 1.3 + r() * 8 * p.stagger; const y0 = -5 + trim * .45, y1 = 525 - trim * .55, pts = [];
          for (let y = y0; y <= y1; y += 8) pts.push(seam(s, u * half(y) / 85, y));
          if (pts.length > 1) out.push(line(pts, Math.max(.6, p.weight * (1 - .25 * f)))); u += g; g *= 1.09; }
      } return out; } },
  sediment: { name: "Sediment", params: [S("density", "Density", 500, 14000, 100, 6000), S("reach", "Reach", 3, 40, 1, 12, "mm"), S("grain", "Grain", .35, 1.4, .05, .6, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const b = wave(r, 3, .012, .04), arr = [];
        for (let i = 0; i < p.density; i++) { const y = r() * 530 - 5; if (r() > .68 + .32 * b(y)) continue; const u = -Math.log(1 - r()) * p.reach * .55, [x] = seam(s, u, y); arr.push([x, y, p.grain * (.45 + r() * .55)]); }
        out.push(dots(arr, p.grain)); } return out; } },
  tideline: { name: "Tideline", params: [S("lines", "Lines", 2, 20, 1, 8), S("gap", "Spacing", 2, 10, .5, 4.5, "mm"), S("swell", "Swell", 0, 12, .5, 4, "mm"), S("weight", "Weight", .6, 1.8, .05, .8, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const w1 = wave(r, 3, .008, .03);
        for (let i = 0; i < p.lines; i++) { const f = i / Math.max(1, p.lines - 1), base = 4 + i * p.gap, w2 = wave(r, 2, .02, .05); let seg = [], on = true, next = 30 + r() * 80;
          for (let y = -5; y <= 525; y += 5) { if (f > .5 && y > next) { on = !on; next = y + (on ? 25 + r() * 70 : 8 + f * 26 * r()); if (seg.length > 1) out.push(line(seg, p.weight)); seg = []; }
            if (on) seg.push(seam(s, base + p.swell * (w1(y) * (.4 + f) + .2 * w2(y)) + p.swell, y)); }
          if (seg.length > 1) out.push(line(seg, p.weight)); }
      } return out; } },
  seismo: { name: "Seismograph", params: [S("inset", "From seam", 6, 60, 1, 22, "mm"), S("at", "Quake at", 60, 470, 5, 340, "mm"), S("amp", "Strength", 2, 30, 1, 13, "mm"), S("spread", "Spread", 8, 90, 1, 26, "mm"), S("weight", "Weight", .6, 2, .05, .8, "mm")],
    gen(p, r, sides) { return sides.map(s => { const pts = []; for (let y = -5; y < 526; y += 2) { const b = Math.exp(-(((y - p.at) / p.spread) ** 2)), amp = .5 + p.amp * b; pts.push(seam(s, p.inset + (r() * 2 - 1) * amp * (b > .05 ? 1 : .5), y)); } return line(pts, p.weight); }); } },
  ruler: { name: "Ruler", params: [S("tick", "Tick length", 3, 12, .5, 5, "mm"), S("major", "Long tick", 6, 24, .5, 11, "mm"), S("num", "Number size", 0, 9, .5, 5, "mm"), S("inset", "From seam", 0, 40, 1, 3, "mm"), S("weight", "Weight", .6, 1.6, .05, .8, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0, y = 40; y <= 484; y += 10, i++) { const big = i % 5 === 0, L = big ? p.major : p.tick;
        out.push(line([seam(s, p.inset, y), seam(s, p.inset + L, y)], p.weight));
        if (big && i && p.num > 0) { const [x] = seam(s, p.inset + p.major + 3 + p.num * .4, y); out.push(...strokeNumber(i, x, y, p.num, p.weight)); } }
      return out; } },
  halftone: { name: "Edge halftone", params: [S("reach", "Reach", 10, 80, 1, 30, "mm"), S("dot", "Dot size", .6, 3, .05, 1.7, "mm"), S("pitch", "Spacing", 3, 9, .1, 4.2, "mm")],
    gen(p, r, sides) { const arr = []; let row = 0;
      for (let y = -5; y < 526; y += p.pitch * .87, row++) for (let x = 30 + (row % 2 ? p.pitch / 2 : 0); x < 232; x += p.pitch) {
        const u = Math.min(...sides.map(s => s === "L" ? x - xl(y) : xr(y) - x)); if (u < -4) continue;
        const rad = p.dot * Math.max(0, 1 - Math.max(0, u) / p.reach) ** 1.6; if (rad > .2) arr.push([x, y, rad]); }
      return [dots(arr, 1)]; } },
  fade: { name: "Halftone fade", noSide: true, params: [S("from", "Starts at", 0, 520, 5, 500, "mm"), S("length", "Length", 40, 400, 5, 180, "mm"), S("dot", "Dot size", .8, 4, .05, 2.6, "mm"), S("pitch", "Spacing", 3, 10, .1, 5.4, "mm"), { k: "up", label: "Toward", def: 1, options: [[1, "Shoulder"], [0, "Wrist"]] }],
    gen(p) { const arr = []; let row = 0, dir = p.up ? -1 : 1;
      for (let y = -5; y < 526; y += p.pitch * .87, row++) { const t = (y - p.from) * dir / p.length; if (t < 0 || t > 1) continue;
        const rad = p.dot * (1 - t) ** 1.4; if (rad < .22) continue; for (let x = 30 + (row % 2 ? p.pitch / 2 : 0); x < 232; x += p.pitch) arr.push([x, y, rad]); }
      return [dots(arr, 1)]; } },
  block: { name: "Colourblock", noSide: true, params: [S("left", "Left edge", 0, 520, 5, 70, "mm"), S("right", "Right edge", 0, 520, 5, 470, "mm"), S("gap", "Hairline gap", 0, 12, .5, 3.5, "mm")],
    gen(p) { const a = p.left, b = p.right, out = [poly([[-5, a], [265, b], [265, 530], [-5, 530]], 9)]; if (p.gap) out.push(line([[-5, a - p.gap], [265, b - p.gap]], .8)); return out; } },
  topo: { name: "Topo", params: [S("rings", "Rings", 3, 20, 1, 11), S("gap", "Spacing", 4, 18, .5, 9, "mm"), S("at", "Centre", 60, 470, 5, 300, "mm"), S("weight", "Weight", .6, 1.6, .05, .8, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const [cx] = seam(s, -18, p.at), hs = [0, 1, 2].map(() => [.04 + r() * .08, 2 + Math.floor(r() * 4), r() * 6]);
        for (let k = 1; k <= p.rings; k++) { const pts = []; for (let i = 0; i <= 360; i += 4) { const t = i * Math.PI / 180, rad = p.gap * k * (1 + hs.reduce((q, [a, n, ph]) => q + a * Math.sin(n * t + ph + k * .25), 0)); pts.push([cx + rad * Math.cos(t), p.at + rad * 1.45 * Math.sin(t)]); } out.push(line(pts, p.weight, Math.max(.45, 1 - k * .04))); }
      } return out; } },
  streak: { name: "Speed streak", params: [S("count", "Streaks", 1, 24, 1, 9), S("at", "Starts at", 60, 500, 5, 400, "mm"), S("spread", "Spread", 10, 300, 5, 130, "mm"), S("length", "Length", 40, 340, 5, 210, "mm"), S("angle", "Angle", 4, 50, 1, 16, "°"), S("weight", "Base width", 1.5, 22, .5, 8, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y = p.at - r() * p.spread, a = p.angle * Math.PI / 180 * (.75 + r() * .5), L = p.length * (.5 + r() * .5), w = p.weight * (.35 + r() * .65), [x] = seam(s, -3, y), d = s === "L" ? 1 : -1;
        out.push(poly([[x - d * 3, y - w / 2], [x - d * 3, y + w / 2], [x + d * Math.sin(a) * L, y - Math.cos(a) * L]], 1)); }
      return out; } },
  tally: { name: "Count", params: [S("groups", "Groups", 1, 16, 1, 10), S("inset", "From seam", 6, 50, 1, 12, "mm"), S("length", "Stroke", 6, 18, .5, 10.5, "mm"), S("weight", "Weight", .7, 2, .05, 1.15, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { let y = 452, g = 0; const d = s === "L" ? 1 : -1;
        while (g < p.groups && y > 50) { if (y < ELBOW[1] + 4 && y > ELBOW[0]) { y = ELBOW[0] - 6; continue; } const ys = [];
          for (let k = 0; k < 4; k++) { const yy = y - k * 4.3 + (r() - .5) * .8, [x] = seam(s, p.inset + (r() - .5), yy), l = p.length + (r() - .5) * 1.6, a = (r() - .5) * .14; out.push(line([[x, yy], [x + d * l * Math.cos(a), yy + l * Math.sin(a)]], p.weight)); ys.push(yy); }
          const [x0] = seam(s, p.inset - 1.5, ys[0] + 2.2); out.push(line([[x0, ys[0] + 2.2], [x0 + d * (p.length + 2.5), ys[3] - 2.4]], p.weight)); y -= 26.7; g++; }
      } return out; } },
};
const measure = document.createElement("canvas").getContext("2d");
Object.assign(PRESETS, {
  flame: { name: "Flame edge", group: "Shapes", params: [S("tongues", "Tongues", 2, 30, 1, 12), S("at", "Starts at", 60, 510, 5, 300, "mm"), S("spread", "Spread", 20, 300, 5, 170, "mm"), S("height", "Height", 30, 240, 5, 120, "mm"), S("reach", "Reach", 8, 70, 1, 30, "mm"), S("width", "Width", 3, 26, .5, 11, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.tongues; i++) { const y = p.at - r() * p.spread, L = p.height * (.5 + r() * .5), reach = p.reach * (.4 + r() * .6), w0 = p.width * (.6 + r() * .6), ph = r() * 6, pts = [], ws = [];
        for (let t = 0; t <= 1.001; t += .05) { pts.push(seam(s, -4 + reach * t ** 1.4 + Math.sin(t * 5 + ph) * p.width * .35 * t, y - t * L)); ws.push(Math.max(.15, w0 * (1 - t) ** .8 * (.7 + .5 * Math.sin(t * 3.14)))); }
        out.push(poly(vribbon(pts, ws), 2)); }
      return out; } },
  scribble: { name: "Scribble", group: "Lines", params: [S("loops", "Loops", 4, 60, 1, 22), S("amp", "Size", 6, 60, 1, 20, "mm"), S("inset", "From seam", 2, 50, 1, 8, "mm"), S("weight", "Weight", .6, 3, .05, 1, "mm")],
    gen(p, r, sides) { return sides.map(s => { const pts = [], n = p.loops * 12, w = wave(r, 3, .01, .04); for (let i = 0; i <= n; i++) { const t = i / n, a = t * p.loops * 6.283, y = 10 + 500 * t + p.amp * .55 * Math.sin(a); pts.push(seam(s, p.inset + p.amp * (.5 + .5 * Math.cos(a)) * (.75 + .35 * w(y)), y)); } return line(chaikin(pts), p.weight); }); } },
  scratch: { name: "Scratched", group: "Texture", params: [S("count", "Scratches", 10, 260, 5, 90), S("length", "Length", 8, 120, 1, 42, "mm"), S("reach", "Reach", 8, 80, 1, 34, "mm"), S("angle", "Angle", 0, 60, 1, 18, "°"), S("weight", "Weight", .6, 2.5, .05, 1, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const d = s === "L" ? 1 : -1, cs = [0, 1, 2].map(() => 50 + r() * 420);
        for (let i = 0; i < p.count; i++) { const y = cs[i % 3] + (r() + r() + r() - 1.5) * 90, u = r() * r() * p.reach, a = -Math.PI / 2 + d * (p.angle * Math.PI / 180) * (.7 + r() * .6), pts = walk(r, seam(s, u, y), a, p.length * (.35 + r()), .05); out.push(poly(ribbon(pts, p.weight, .12), p.weight, .55 + r() * .45)); } }
      return out; } },
  angular: { name: "Angular lines", group: "Lines", params: [S("count", "Lines", 1, 20, 1, 6), S("at", "Starts at", 60, 500, 5, 400, "mm"), S("gap", "Spacing", 3, 40, 1, 12, "mm"), S("reach", "Reach", 10, 80, 1, 42, "mm"), S("angle", "Angle", 15, 75, 1, 45, "°"), S("run", "Run", 10, 260, 5, 120, "mm"), S("weight", "Weight", .6, 3, .05, 1, "mm")],
    gen(p, r, sides) { const out = [], k = Math.tan(p.angle * Math.PI / 180);
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y = p.at - i * p.gap, y1 = y - (p.reach + 4) * k; out.push(line([seam(s, -4, y), seam(s, p.reach, y1), seam(s, p.reach * .75, y1 - p.run)], p.weight)); }
      return out; } },
  facet: { name: "Facets", group: "Shapes", params: [S("cell", "Facet size", 8, 50, 1, 22, "mm"), S("reach", "Reach", 15, 85, 1, 48, "mm"), S("contrast", "Contrast", .1, .9, .05, .55)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const g = [], rows = Math.ceil(540 / p.cell) + 1, cols = Math.ceil((p.reach + 8) / p.cell) + 1;
        for (let j = 0; j < rows; j++) { g.push([]); for (let i = 0; i < cols; i++) g[j].push(seam(s, -8 + i * p.cell + (r() - .5) * p.cell * .7, -10 + j * p.cell + (r() - .5) * p.cell * .7)); }
        for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const fade = 1 - i / (cols - 1), o = () => (.06 + r() * p.contrast) * fade; out.push(poly([g[j][i], g[j][i + 1], g[j + 1][i]], 9, o()), poly([g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]], 9, o())); } }
      return out; } },
  mesh: { name: "Mesh", group: "Texture", params: [S("pitch", "Spacing", 4, 24, .5, 9, "mm"), S("reach", "Reach", 8, 85, 1, 32, "mm"), S("angle", "Angle", 20, 70, 1, 45, "°"), S("weight", "Weight", .6, 1.6, .05, .7, "mm")],
    gen(p, r, sides) { const out = [], k = Math.tan(p.angle * Math.PI / 180), w = wave(r, 3, .01, .03);
      for (const s of sides) for (const d of [1, -1]) for (let c = -220; c < 760; c += p.pitch) { const reach = p.reach * (.72 + .28 * w(c)), a = seam(s, -3, c - 3 * d * k), b = seam(s, reach, c + reach * d * k); out.push(line([a, b], p.weight)); }
      return out; } },
  type: { name: "Repeat type", group: "Marks", text: true, params: [S("size", "Size", 4, 40, .5, 9, "mm"), S("rows", "Rows", 1, 6, 1, 1), S("inset", "From seam", 4, 60, 1, 13, "mm"), S("gap", "Gap", 2, 60, 1, 8, "mm")],
    gen(p, r, sides, l) { const out = [], text = l.text || "AREABOYS"; measure.font = `100px Anton`; const tw = measure.measureText(text).width * p.size / 100 + p.gap, tilt = Math.atan(30 / 460);
      for (const s of sides) for (let row = 0; row < p.rows; row++) { const off = row % 2 ? tw / 2 : 0; for (let y = 505 - off; y > -10; y -= tw) { const [x] = seam(s, p.inset + row * p.size * 1.5, y); out.push({ t: "text", s: text, x, y, size: p.size, rot: -Math.PI / 2 + (s === "L" ? -tilt : tilt), w: 9, o: Math.max(.35, 1 - row * .22) }); } }
      return out; } },
  gradient: { name: "Gradient", group: "Texture", params: [{ k: "axis", label: "Fades", def: 0, options: [[0, "Along the arm"], [1, "In from the sides"]] }, S("from", "Starts at", 0, 520, 5, 490, "mm"), S("length", "Length", 20, 500, 5, 260, "mm"), { k: "up", label: "Toward", def: 1, options: [[1, "Shoulder"], [0, "Wrist"]] }, S("strength", "Strength", .1, 1, .05, 1)],
    gen(p, r, sides) { const box = [-5, -5, 270, 530];
      if (!p.axis) return [{ t: "grad", a: [130, p.from], b: [130, p.from + (p.up ? -1 : 1) * p.length], box, w: 9, o: p.strength }];
      return sides.map(s => { const d = s === "L" ? 1 : -1, l = Math.hypot(460, 30), a = seam(s, 0, 260), n = [d * 460 / l, (s === "L" ? -30 : -30) / l]; return { t: "grad", a, b: [a[0] + n[0] * p.length * .3, a[1] + n[1] * p.length * .3], box, w: 9, o: p.strength }; }); } },
  chevron: { name: "Chevron", group: "Shapes", noSide: true, params: [S("count", "Chevrons", 1, 16, 1, 3), S("at", "Starts at", 20, 500, 5, 400, "mm"), S("depth", "Depth", 0, 90, 1, 34, "mm"), S("width", "Width", 1, 40, .5, 7, "mm"), S("gap", "Gap", 1, 40, .5, 6, "mm")],
    gen(p) { const out = []; for (let i = 0; i < p.count; i++) { const y = p.at + i * (p.width + p.gap), d = p.depth, w = p.width; out.push(poly([[-5, y + d], [130, y], [265, y + d], [265, y + d + w], [130, y + w], [-5, y + d + w]], 9)); } return out; } },
  bands: { name: "Bands", group: "Shapes", noSide: true, params: [S("count", "Bands", 1, 12, 1, 3), S("at", "Starts at", 10, 500, 5, 440, "mm"), S("width", "Width", .8, 40, .2, 4, "mm"), S("gap", "Gap", 1, 40, .5, 5, "mm")],
    gen(p) { const out = []; for (let i = 0; i < p.count; i++) { const y = p.at + i * (p.width + p.gap); out.push(poly([[-5, y], [265, y], [265, y + p.width], [-5, y + p.width]], p.width)); } return out; } },
});
const GROUP = { hairline: "Lines", tideline: "Lines", seismo: "Lines", topo: "Lines", sediment: "Texture", halftone: "Texture", fade: "Texture", block: "Shapes", streak: "Shapes", fracture: "Marks", ruler: "Marks", tally: "Marks" };
for (const [k, g] of Object.entries(GROUP)) PRESETS[k].group = g;
PRESETS.paint = { name: "Paint", paint: true, noSide: true, params: [], gen(p, r, s, l) { return (l.strokes || []).flatMap(strokePrims); } };
// brush strokes are stored in mm, so they export as vector at any size
const strokeCache = new WeakMap();
function chaikin(pts) { if (pts.length < 3) return pts; const out = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], m = (t) => a.map((v, k) => v + (b[k] - v) * t); out.push(m(.25), m(.75)); } out.push(pts[pts.length - 1]); return out; }
function vribbon(pts, ws) { const L = [], R = [], n = pts.length; pts.forEach(([x, y], i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], q = Math.hypot(dx, dy) || 1, w = ws[i] / 2; L.push([x - dy / q * w, y + dx / q * w]); R.push([x + dy / q * w, y - dx / q * w]); }); return L.concat(R.reverse()); }
function brushPrims(st, raw) {
  const pts = chaikin(chaikin(raw)), n = pts.length, sz = st.size, r = makeRng(st.seed), out = [];
  if (n < 2) return [dots([[pts[0][0], pts[0][1], sz * (.2 + .3 * pts[0][2])]], sz)];
  if (st.kind === "marker") return [line(pts.map(q => [q[0], q[1]]), sz, .96)];
  if (st.kind === "ink") { const ws = pts.map((q, i) => Math.max(.3, sz * (.22 + .78 * q[2] ** .7) * Math.min(1, (i + 1) / 6, (n - i) / 6))); return [poly(vribbon(pts, ws), Math.max(.6, sz * .5))]; }
  if (st.kind === "dry") { const bristles = Math.max(4, Math.round(sz * 1.3)), bw = Math.max(.6, sz / bristles * 1.25);
    for (let b = 0; b < bristles; b++) { const off = (b / (bristles - 1) - .5) * sz, keep = .55 + r() * .45; let seg = [];
      const flush = () => { if (seg.length > 2) out.push(poly(ribbon(seg, bw, bw * .4), bw)); seg = []; };
      pts.forEach((q, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, gone = i / n > keep || r() < .04 * (1 - q[2]); if (gone) flush(); else seg.push([q[0] - dy / l * off * (.5 + .5 * q[2]), q[1] + dx / l * off * (.5 + .5 * q[2])]); }); flush(); }
    return out; }
  const arr = []; pts.forEach(q => { const m = 2 + Math.round(sz * .9 * q[2]); for (let i = 0; i < m; i++) { const a = r() * 6.283, d = sz * .75 * Math.sqrt(-2 * Math.log(1 - r() * .98)) * .5; arr.push([q[0] + Math.cos(a) * d, q[1] + Math.sin(a) * d, .3 + r() * .4]); } }); return [dots(arr, 1)];
}
function strokePrims(st) { let p = strokeCache.get(st); if (p) return p; p = brushPrims(st, st.pts); if (st.mirror) p = p.concat(brushPrims(st, st.pts.map(([x, y, q]) => [xl(y) + xr(y) - x, y, q]))); p.forEach(q => q.c = st.color); strokeCache.set(st, p); return p; }
const defaults = t => Object.fromEntries(PRESETS[t].params.map(q => [q.k, q.def]));
let uid = 1;
function makeLayer(type, o = {}) { return { id: uid++, type, side: "both", color: COL.bone, seed: 1 + Math.floor(Math.random() * 9999), from: 0, to: 46, avoid: false, hidden: false, ...o, p: { ...defaults(type), ...(o.p || {}) } }; }

const LOOKS = [
  { name: "Aftershock", base: COL.ink, logo: COL.bone, layers: [["fracture", { seed: 14 }], ["seismo", { side: "L", color: COL.lime, seed: 5 }]] },
  { name: "Selvedge", base: COL.ink, logo: COL.bone, layers: [["hairline", { seed: 11, p: { weight: 1 } }], ["hairline", { side: "R", color: COL.lime, seed: 3, p: { lines: 1, stagger: 0, weight: .9 } }]] },
  { name: "Silt", base: COL.charcoal, logo: COL.cotton, layers: [["sediment", { color: COL.cotton, seed: 23 }]] },
  { name: "Bone Tally", base: COL.bone, logo: COL.ink, layers: [["tally", { side: "R", color: COL.ink, seed: 5 }]] },
  { name: "Coastline", base: COL.navy, logo: COL.bone, layers: [["topo", { side: "R", color: "#C3CAD6", seed: 4 }], ["tideline", { side: "L", color: "#C3CAD6", seed: 8, p: { lines: 5 } }]] },
  { name: "Redline", base: COL.ink, logo: COL.bone, layers: [["fade", { color: COL.white, seed: 2, p: { length: 150 } }], ["streak", { side: "R", color: COL.red, seed: 21 }], ["streak", { side: "R", color: COL.white, seed: 6, p: { count: 4, weight: 4 } }]] },
  { name: "Surveyor", base: COL.charcoal, logo: COL.bone, layers: [["ruler", { side: "L", seed: 1 }]] },
  { name: "Split", base: "#151515", logo: "#151515", layers: [["block", { color: COL.bone, seed: 1 }]] },
  { name: "Ember", base: COL.ink, logo: COL.bone, layers: [["flame", { side: "R", color: COL.red, seed: 12, p: { tongues: 18, at: 480, spread: 330, height: 170, reach: 46, width: 16 } }]] },
  { name: "Scrawl", base: COL.bone, logo: COL.ink, layers: [["scribble", { side: "L", color: COL.ink, seed: 9, p: { loops: 13, amp: 30, weight: 1.2 } }]] },
  { name: "Worn", base: COL.charcoal, logo: COL.bone, layers: [["scratch", { seed: 31 }]] },
  { name: "Prism", base: COL.navy, logo: COL.bone, layers: [["facet", { side: "R", color: "#9FB0C8", seed: 17 }]] },
  { name: "Netline", base: COL.ink, logo: COL.bone, layers: [["mesh", { seed: 6 }]] },
  { name: "On Repeat", base: COL.ink, logo: COL.ink, layers: [["type", { side: "L", seed: 1 }]] },
  { name: "Dusk", base: COL.navy, logo: COL.bone, layers: [["gradient", { color: COL.red, seed: 1 }]] },
  { name: "Cuff", base: COL.bone, logo: COL.ink, layers: [["bands", { color: COL.ink, seed: 1 }]] },
];
function lookState(l) { const h = l.set === "hand"; return { base: l.base, layers: l.layers.map(([t, o]) => makeLayer(t, o)), logo: { on: l.logo !== l.base, text: "AREABOYS", font: h ? "Permanent Marker" : "Anton", dir: "along", size: h ? 13 : 11, y: 440, across: 50, color: l.logo, track: h ? 0 : 8 } }; }

// ---------------------------------------------------------------- drawing the artwork
const primCache = new Map();
function primsOf(l) { const sig = JSON.stringify([l.type, l.side, l.seed, l.p, l.text, l.rev || 0, l.strokes ? l.strokes.length : 0]), c = primCache.get(l.id); if (c && c.sig === sig) return c.prims; const sides = l.side === "both" ? ["L", "R"] : [l.side], prims = PRESETS[l.type].gen(l.p, makeRng(l.seed), sides, l); primCache.set(l.id, { sig, prims }); return prims; }
function bandsOf(l) { // visible stretches of the arm for this layer
  const a = l.from <= 0 ? -10 : 30 + l.from * 10, b = l.to >= 46 ? 530 : 30 + l.to * 10; if (!l.avoid) return [[a, b]];
  const out = []; if (a < ELBOW[0]) out.push([a, Math.min(b, ELBOW[0])]); if (b > ELBOW[1]) out.push([Math.max(a, ELBOW[1]), b]); return out;
}
function drawLayer(c, l) {
  c.save(); c.beginPath(); for (const [a, b] of bandsOf(l)) c.rect(-20, a, 300, b - a); c.clip();
  c.lineCap = c.lineJoin = "round";
  for (const q of primsOf(l)) { c.fillStyle = c.strokeStyle = q.c || l.color; c.globalAlpha = q.o; c.beginPath();
    if (q.t === "line") { q.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = q.w; c.stroke(); }
    else if (q.t === "poly") { q.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
    else if (q.t === "grad") { const g = c.createLinearGradient(q.a[0], q.a[1], q.b[0], q.b[1]), col = q.c || l.color; g.addColorStop(0, col); g.addColorStop(1, col + "00"); c.fillStyle = g; c.fillRect(...q.box); }
    else if (q.t === "text") { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(q.size / 100, q.size / 100); c.font = `100px "${q.font || "Anton"}"`; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(q.s, 0, 0); c.restore(); }
    else { for (const [x, y, r] of q.arr) { c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.2832); } c.fill(); } }
  c.restore();
}
function logoPos(g) { return [xl(g.y) + (xr(g.y) - xl(g.y)) * g.across / 100, g.y]; }
function paintLogo(c, g) { // centred on the current origin
  c.save();
  if (logoImg) { const h = g.size, w = h * logoImg.width / logoImg.height; c.drawImage(logoImg, -w / 2, -h / 2, w, h); }
  else { const px = 100, k = g.size / px; c.scale(k, k); c.font = `${px}px "${g.font}"`; if ("letterSpacing" in c) c.letterSpacing = `${g.track}px`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = g.color; c.fillText(g.text, 0, 0); }
  c.restore();
}
function drawLogo(c, g) {
  if (!g.on) return; const [x, y] = logoPos(g); c.save(); c.translate(x, y); if (g.dir === "along") c.rotate(-Math.PI / 2); paintLogo(c, g); c.restore();
}
const sleevePath = new Path2D(SLEEVE);
function art(s, st = state, withLogo = true) {
  const cv = document.createElement("canvas"); cv.width = Math.ceil(W * s); cv.height = Math.ceil(H * s); const c = cv.getContext("2d");
  c.scale(s, s); c.save(); c.clip(sleevePath); c.fillStyle = st.base; c.fillRect(0, 0, W, H);
  for (const l of st.layers) if (!l.hidden) drawLayer(c, l);
  if (withLogo) drawLogo(c, st.logo); c.restore(); return cv;
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// flat-lay: rotated so the wrist is on the left, with folded edges, hems, stitching and soft wrinkles
function layImage(s, st = state, withLogo = true, detail = true) {
  const a = art(s, st, withLogo), w = a.height, h = a.width, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d", { willReadFrequently: true }); c.setTransform(0, 1, -1, 0, w, 0); c.drawImage(a, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
  const im = c.getImageData(0, 0, w, h), d = im.data, R = 5, dark = lum(st.base) < .3;
  for (let Y = 0; Y < h; Y++) { const ax = Y / s; for (let X = 0; X < w; X++) { const i = (Y * w + X) * 4; if (!d[i + 3]) continue;
    const ay = (w - X) / s, dS = Math.min(ax - xl(ay), xr(ay) - ax), dE = Math.min(ay - topY(ax), botY(ax) - ay);
    let dist = Math.min(dS, dE); if (dS < R && dE < R) dist = R - Math.hypot(R - dS, R - dE); if (dist <= 0) { d[i + 3] = 0; continue; }
    const fold = ss(0, 13, dS), wr = .03 * Math.sin(ay * .036 + 1.6 * Math.sin(ax * .05)) + .02 * Math.sin((ay * .6 + ax) * .08 + 1.2);
    let sh = (.78 + .22 * fold) * (1 + wr); if (dE < 7) sh *= .93;
    if (detail && Math.abs(dE - 6) < .22 && Math.sin(dS * 1.6) > -.2) sh *= dark ? 1.9 : .74;
    const add = (dark ? 16 : 0) * (1 - fold) + (dark ? 90 : 0) * Math.max(0, wr) + (dark && Math.abs(dE - 6) < .22 ? 10 : 0), n = 1 + (((X * 73856093 ^ Y * 19349663) >>> 0) % 997 / 997 - .5) * .05;
    d[i] = d[i] * sh * n + add; d[i + 1] = d[i + 1] * sh * n + add; d[i + 2] = d[i + 2] * sh * n + add; d[i + 3] = Math.min(255, dist * s * 255);
  } }
  c.putImageData(im, 0, 0); return cv;
}
function lum(h) { const n = parseInt(h.slice(1), 16); return (.2126 * (n >> 16 & 255) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255; }
function drawPair(c, w, h, detail = true) {
  c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, w, h);
  const s = Math.min(w * .9 / 480, h / (170 * 2 + 70)), img = layImage(s), bw = 480 * s, bh = 172 * s, gap = Math.min(52 * s, (h - 2 * bh) / 3), x = (w - bw) / 2 - 26 * s, y0 = (h - 2 * bh - gap) / 2 - 44 * s;
  [[x, y0], [x + 5 * s, y0 + bh + gap]].forEach(([px, py]) => { c.save(); c.shadowColor = "rgba(20,20,20,.3)"; c.shadowBlur = 11 * s; c.shadowOffsetY = 3 * s; c.shadowOffsetX = s; c.drawImage(img, px, py); c.restore(); });
}

