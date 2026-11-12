"use strict";
// Hand-made presets. Instead of clean maths lines these go through a simulated hand:
// pressure changes, shake, ragged ink edges, overshoot, brushes running dry, paint that drips.
const HAND_FONTS = ["Permanent Marker", "Rock Salt", "Reenie Beanie", "Caveat Brush"];

function hnoise(r, step = 1) { const v = Array.from({ length: 256 }, () => r() * 2 - 1); return t => { const x = t / step, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = v[(i % 256 + 256) % 256], b = v[((i + 1) % 256 + 256) % 256]; return a + (b - a) * u; }; }
function spline(c, step = 1.2) { // Catmull-Rom through the control points
  if (c.length < 3) { const [a, b] = c, n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)), o = []; for (let i = 0; i <= n; i++) o.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); return o; }
  const out = [];
  for (let i = 0; i < c.length - 1; i++) { const p0 = c[Math.max(0, i - 1)], p1 = c[i], p2 = c[i + 1], p3 = c[Math.min(c.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, d, e) => .5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (3 * b - a - 3 * d + e) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
  out.push(c[c.length - 1]); return out;
}
// one drawn stroke: returns an outline with uneven width and a ragged edge on each side
function hand(r, ctrl, o = {}) {
  const size = o.size || 1.2, tremor = o.tremor ?? .35, rough = o.rough ?? .2, press = o.press ?? .4, tail = o.tail ?? 1, pts = o.raw ? ctrl : spline(ctrl), n = pts.length;
  const a = hnoise(r, 16), b = hnoise(r, 3.6), w = hnoise(r, 24), eL = hnoise(r, 1.1), eR = hnoise(r, 1.3), L = [], R = []; let s = 0, total = 0;
  for (let i = 1; i < n; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  for (let i = 0; i < n; i++) { const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const d = tremor * (a(s) + .35 * b(s)), x = pts[i][0] + nx * d, y = pts[i][1] + ny * d, inn = Math.min(1, (s + .4) / (size * 1.1 + 1.2)), out = Math.min(1, (total - s + .2) / (size * 2.6 * tail + 1.5)) ** .7, ww = Math.max(.1, size * (1 + press * w(s)) * inn * out) / 2;
    L.push([x + nx * ww * (1 + rough * eL(s)), y + ny * ww * (1 + rough * eL(s))]); R.push([x - nx * ww * (1 + rough * eR(s)), y - ny * ww * (1 + rough * eR(s))]); }
  return poly(L.concat(R.reverse()), Math.max(.7, size), o.o ?? 1);
}
// a loaded brush that runs dry: bristles lift off one by one
function dryBrush(r, ctrl, size, dryness, out) {
  const pts = spline(ctrl, 1.4), n = pts.length, bristles = Math.min(44, Math.max(6, Math.round(size * .9))), bw = Math.max(.7, size / bristles * 1.8), keep = hnoise(r, 40);
  for (let b = 0; b < bristles; b++) { const off = (b / (bristles - 1) - .5) * size * (.9 + r() * .2), load = 1 - Math.abs(b / (bristles - 1) - .5) * .7 + r() * .5, gap = hnoise(r, 9 + r() * 22), wob = hnoise(r, 30); let seg = [];
    const flush = () => { if (seg.length > 3) out.push(hand(r, seg, { raw: true, size: bw * (.6 + r() * .8), tremor: .12, rough: .35, press: .5 })); seg = []; };
    pts.forEach((q, i) => { const t = i / n, a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, on = gap(i * 1.4 + b * 37) + load * 1.15 - dryness * (.35 + 1.5 * t) + .15 * keep(i) > 0;
      if (on) seg.push([q[0] - dy / l * (off + wob(i) * .8), q[1] + dx / l * (off + wob(i) * .8)]); else flush(); }); flush(); }
}
function blob(r, x, y, rad, o = {}) { const n = 22, ang = o.ang || 0, st = o.stretch || 1, f = hnoise(r, 3), pts = []; for (let i = 0; i < n; i++) { const t = i / n * 6.283, k = rad * (1 + (o.rough ?? .28) * f(i)), px = Math.cos(t) * k * st, py = Math.sin(t) * k; pts.push([x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]); } return poly(pts, 2, o.o ?? 1); }
const gauss = r => (r() + r() + r() + r() - 2) / 1.15;
const sideDir = s => s === "L" ? 1 : -1;

// doodle shapes in a -1..1 box; each list is one pen stroke
const circle = (cx, cy, rad, over = .4) => { const o = []; for (let a = -1.6; a < 4.7 + over; a += .55) o.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); return o; };
const DOODLES = [
  [[[-.95, .3], [.95, .3], [-.6, 1], [0, -1], [.62, 1], [-.95, .3]]].map(s => s.flatMap(p => [p, p])),
  [[[-.9, -.9], [.9, .9]], [[.9, -.85], [-.85, .9]]],
  [[[0, .95], [-.95, -.1], [-.55, -.8], [0, -.3], [.55, -.85], [.95, -.1], [.05, .95]]],
  [circle(0, 0, .95), [[-.35, -.25], [-.32, -.15]], [[.35, -.25], [.34, -.15]], [[-.5, .3], [-.1, .6], [.35, .55], [.55, .25]]],
  [[[.3, -1], [.3, -1], [-.5, .15], [-.5, .15], [.2, .05], [.2, .05], [-.3, 1], [-.3, 1]]],
  [Array.from({ length: 26 }, (_, i) => { const a = i * .52, k = .06 + i * .037; return [Math.cos(a) * k, Math.sin(a) * k]; })],
  [[[-.95, .4], [.8, -.45]], [[.15, -.75], [.15, -.75], [.9, -.5], [.9, -.5], [.5, .2]]],
  [[[-1, .2], [-1, .2], [-.6, -.5], [-.6, -.5], [-.2, .4], [-.2, .4], [.2, -.5], [.2, -.5], [.6, .4], [.6, .4], [1, -.3]]],
  [[[-1, 0], [-.4, -.55], [.4, -.55], [1, 0], [.4, .5], [-.4, .5], [-1, .02]], circle(0, 0, .28, .2)],
  [[[0, -1], [0, 1]], [[-.75, -.35], [.75, -.3]]],
];

const G = (k, label, def, options) => ({ k, label, def, options });
Object.assign(PRESETS, {
  inkline: { name: "Ink line", set: "hand", group: "Ink", params: [S("lines", "Lines", 1, 6, 1, 1), S("inset", "From seam", 3, 60, 1, 12, "mm"), S("wander", "Wander", 0, 14, .5, 3, "mm"), S("weight", "Pen size", .7, 5, .1, 1.5, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.lines; i++) { let y = -8; const u0 = p.inset + i * (5 + r() * 6);
        while (y < 525) { const len = 90 + r() * 180, c = []; for (let t = 0; t <= len; t += 34 + r() * 26) c.push(seam(s, u0 + (r() - .5) * 2 * p.wander, y + t)); if (c.length > 1) out.push(hand(r, c, { size: p.weight * (.8 + r() * .4), tremor: .5, press: .55 })); y += len - 4 - r() * 12; } }
      return out; } },
  slash: { name: "Brush slash", set: "hand", group: "Ink", params: [S("strokes", "Strokes", 1, 6, 1, 1), S("size", "Brush size", 8, 60, 1, 22, "mm"), S("at", "Starts at", 80, 500, 5, 430, "mm"), S("length", "Length", 80, 460, 5, 240, "mm"), S("reach", "Reach", 0, 90, 1, 34, "mm"), S("dry", "Dryness", .1, 1, .05, .55)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.strokes; i++) { const y0 = p.at - i * (40 + r() * 50), L = p.length * (.65 + r() * .35), u = p.reach * (.6 + r() * .6); dryBrush(r, [seam(s, 2 + r() * 8, y0), seam(s, u * .9, y0 - L * .4), seam(s, u * 1.05, y0 - L * .75), seam(s, u * .7, y0 - L)], p.size * (.75 + r() * .35), p.dry, out); }
      return out; } },
  lino: { name: "Lino cut", set: "hand", group: "Ink", params: [S("count", "Cuts", 30, 500, 10, 90), S("length", "Length", 5, 50, 1, 20, "mm"), S("reach", "Reach", 10, 85, 1, 26, "mm"), S("flow", "Swirl", 0, 1.6, .05, .7), S("weight", "Gouge size", .7, 4, .1, 1.6, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const f = hnoise(r, 70), d = sideDir(s); for (let i = 0; i < p.count; i++) { const y = r() * 530 - 5, u = r() ** 1.7 * p.reach, a = -Math.PI / 2 + d * (.2 + p.flow * f(y + u)), L = p.length * (.4 + r() * .8), [x] = seam(s, u, y), m = a + (r() - .5) * .3; out.push(hand(r, [[x, y], [x + Math.cos(m) * L * .5, y + Math.sin(m) * L * .5], [x + Math.cos(a) * L, y + Math.sin(a) * L]], { size: p.weight * (.6 + r() * .8), tremor: .08, rough: .12, press: .25, tail: 1.8 })); } }
      return out; } },
  drips: { name: "Paint drips", set: "hand", group: "Paint", noSide: true, params: [S("at", "Paint line", 20, 420, 5, 50, "mm"), S("count", "Drips", 2, 30, 1, 6), S("length", "Run length", 20, 360, 5, 120, "mm"), S("width", "Drip size", 2, 18, .5, 7, "mm")],
    gen(p, r) { const out = [], e = hnoise(r, 34), e2 = hnoise(r, 8), ey = x => p.at + 15 * e(x) + 4 * e2(x), top = [[-5, -8], [265, -8]]; for (let x = 265; x >= -5; x -= 3) top.push([x, ey(x)]); out.push(poly(top, 9));
      for (let i = 0; i < p.count; i++) { const x = 40 + r() * 180, y = ey(x) - 3, L = 14 + p.length * r() ** 1.8, w = p.width * (.55 + r() * .7), wob = hnoise(r, 40), c = []; for (let t = 0; t <= L; t += 2) c.push([x + wob(t) * 1.6, y + t]); const ws = c.map((_, k) => { const t = k / (c.length - 1); return w * (1.6 * Math.exp(-t * 14) + .52 + .1 * Math.sin(t * 9)); }); out.push(poly(vribbon(c, ws), 2)); const end = c[c.length - 1]; out.push(blob(r, end[0], end[1] + w * .2, w * .62, { stretch: .85, ang: Math.PI / 2, rough: .1 })); }
      return out; } },
  splatter: { name: "Splatter", set: "hand", group: "Paint", params: [S("splats", "Splats", 1, 12, 1, 2), S("size", "Size", 3, 26, .5, 6, "mm"), S("spray", "Droplets", 5, 120, 1, 22), S("reach", "Reach", 0, 80, 1, 22, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.splats; i++) { const y = 30 + (i + r()) / p.splats * 450, [x] = seam(s, r() * p.reach, y), th = r() * 6.283, arr = []; out.push(blob(r, x, y, p.size * (.45 + r() * .6), { rough: .34 }));
        for (let k = 0; k < p.spray; k++) { const a = th + gauss(r) * 1.3, d = p.size * (.9 + r() ** 2.4 * 7), rad = Math.max(.25, p.size * .22 * r() ** 2.6 * (1.3 - d / (p.size * 8))), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (rad > .9) out.push(blob(r, px, py, rad, { ang: a, stretch: 1 + d / (p.size * 4), rough: .2 })); else arr.push([px, py, rad]); } out.push(dots(arr, 1)); }
      return out; } },
  spray: { name: "Spray can", set: "hand", group: "Paint", params: [S("inset", "From seam", 4, 70, 1, 18, "mm"), S("wander", "Wander", 0, 22, 1, 9, "mm"), S("size", "Nozzle", 2, 16, .5, 5, "mm"), S("density", "Paint", 4, 50, 1, 16), S("drips", "Drips", 0, 12, 1, 1)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const w = hnoise(r, 90), c = spline([0, 1, 2, 3, 4, 5].map(i => { const y = -5 + i * 106; return seam(s, p.inset + w(y) * p.wander, y); }), 2), arr = [];
        c.forEach(q => { for (let k = 0; k < p.density; k++) { const d = gauss(r) * p.size * .7, a = r() * 6.283; arr.push([q[0] + Math.cos(a) * d, q[1] + Math.sin(a) * d, .28 + r() * .6 * (1 - Math.min(1, Math.abs(d) / p.size))]); } }); out.push(dots(arr, 1));
        for (let i = 0; i < p.drips; i++) { const q = c[Math.floor(r() * c.length)], L = 14 + r() ** 1.5 * 70, t = []; for (let k = 0; k <= L; k += 3) t.push([q[0] + Math.sin(k * .05) * .7, q[1] + k]); out.push(hand(r, t, { raw: true, size: 1, tremor: .1, rough: .1, tail: .5 })); } }
      return out; } },
  roller: { name: "Dry roller", set: "hand", group: "Paint", params: [S("width", "Roller width", 10, 70, 1, 22, "mm"), S("inset", "From seam", 0, 60, 1, 12, "mm"), S("at", "Starts at", 100, 510, 5, 480, "mm"), S("length", "Length", 60, 470, 5, 200, "mm"), S("dry", "Dryness", .2, 1, .05, .7)],
    gen(p, r, sides) { const out = []; for (const s of sides) dryBrush(r, [seam(s, p.inset + p.width * .4, p.at), seam(s, p.inset + p.width * .45, p.at - p.length * .5), seam(s, p.inset + p.width * .4, p.at - p.length)], p.width, p.dry, out); return out; } },
  doodles: { name: "Doodles", set: "hand", group: "Drawn", params: [S("count", "Doodles", 2, 26, 1, 5), S("size", "Size", 5, 30, .5, 9, "mm"), S("reach", "Reach", 8, 75, 1, 28, "mm"), S("weight", "Pen size", .8, 3.5, .1, 1.5, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y = 30 + (i + .15 + r() * .7) / p.count * 450, [x] = seam(s, p.size + 4 + r() * p.reach, y), k = p.size * (.75 + r() * .5), a = (r() - .5) * .9, d = DOODLES[Math.floor(r() * DOODLES.length)];
        for (const st of d) out.push(hand(r, st.map(([px, py]) => [x + (px * Math.cos(a) - py * Math.sin(a)) * k, y + (px * Math.sin(a) + py * Math.cos(a)) * k]), { size: p.weight, tremor: .25, press: .4 })); }
      return out; } },
  wire: { name: "Barbed wire", set: "hand", group: "Drawn", params: [G("mode", "Runs", 0, [[0, "Around the arm"], [1, "Down the seam"]]), S("at", "Position", 50, 470, 5, 150, "mm"), S("slant", "Slant", -60, 60, 1, -16, "mm"), S("barbs", "Barb gap", 14, 60, 1, 26, "mm"), S("weight", "Wire size", .8, 4, .1, 1.7, "mm")],
    gen(p, r, sides) { const out = [], paths = p.mode ? sides.map(s => y => seam(s, 16 + (p.at - 150) * .1, y)) : [null], len = p.mode ? 540 : 290;
      for (const path of paths) { const P = t => path ? path(t - 10) : [t - 15, p.at + p.slant * (t / 290 - .5)], N = path ? [1, 0] : [0, 1];
        for (const ph of [0, 3.14]) { const c = []; for (let t = 0; t <= len; t += 4) { const q = P(t), o = Math.sin(t * .2 + ph) * (2.2 + p.weight * 1.3); c.push([q[0] + N[0] * o, q[1] + N[1] * o]); } out.push(hand(r, c, { raw: true, size: p.weight, tremor: .3, tail: .2 })); }
        for (let t = 10 + r() * 10; t < len; t += p.barbs * (.85 + r() * .3)) { const q = P(t); for (const a of [.75, -.75, 2.2]) { const L = 6 + p.weight * 2 + r() * 4, m = a + (r() - .5) * .5; out.push(hand(r, [[q[0] - Math.cos(m) * L, q[1] - Math.sin(m) * L], [q[0] + Math.cos(m) * L, q[1] + Math.sin(m) * L]], { size: p.weight * .8, tremor: .15 })); } } }
      return out; } },
  stitch: { name: "Hand stitch", set: "hand", group: "Drawn", params: [G("kind", "Stitch", 0, [[0, "Running"], [1, "Crosses"]]), S("inset", "From seam", 3, 60, 1, 9, "mm"), S("length", "Stitch size", 3, 14, .5, 6.5, "mm"), S("gap", "Gap", 2, 16, .5, 4.5, "mm"), S("rows", "Rows", 1, 4, 1, 1), S("weight", "Thread", .8, 2.4, .1, 1.3, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let row = 0; row < p.rows; row++) { const w = hnoise(r, 60); for (let y = -5; y < 525;) { const L = p.length * (.75 + r() * .5), u = p.inset + row * 9 + w(y) * 1.8, a = seam(s, u + (r() - .5), y), b = seam(s, u + (r() - .5) * 1.6, y + L); if (p.kind) { const m = seam(s, u + L * .7, y), n2 = seam(s, u + L * .7, y + L); out.push(hand(r, [a, n2], { size: p.weight, tremor: .1, tail: .4 }), hand(r, [m, b], { size: p.weight, tremor: .1, tail: .4 })); } else out.push(hand(r, [a, b], { size: p.weight, tremor: .12, rough: .12, tail: .35 })); y += L + p.gap * (.8 + r() * .5); } }
      return out; } },
  scrawl: { name: "Handwriting", set: "hand", group: "Drawn", text: true, params: [G("font", "Hand", 0, [[0, "Marker"], [1, "Scratchy"], [2, "Thin pen"], [3, "Brush"]]), S("size", "Size", 5, 60, .5, 14, "mm"), S("inset", "From seam", 6, 70, 1, 22, "mm"), S("gap", "Gap", 6, 120, 1, 140, "mm"), S("mess", "Messiness", 0, 1, .05, 0.25)],
    gen(p, r, sides, l) { const out = [], text = l.text || "AREABOYS", font = HAND_FONTS[p.font]; measure.font = `100px "${font}"`;
      for (const s of sides) { const w = hnoise(r, 55); let y = 505; while (y > -20) { for (const ch of text) { const adv = measure.measureText(ch).width * p.size / 100, [x] = seam(s, p.inset + w(y) * 5 * p.mess + (r() - .5) * p.size * .14 * p.mess, y); out.push({ t: "text", s: ch, x, y, size: p.size * (1 + (r() - .5) * .22 * p.mess), rot: -Math.PI / 2 + (r() - .5) * .3 * p.mess, font, w: 9, o: 1 }); y -= adv * (.96 + r() * .1 * p.mess); } y -= p.gap * (.8 + r() * .5); } }
      return out; } },
  tape: { name: "Torn tape", set: "hand", group: "Drawn", params: [S("count", "Strips", 1, 12, 1, 2), S("width", "Tape width", 8, 40, 1, 14, "mm"), S("length", "Length", 25, 240, 5, 70, "mm"), S("reach", "Reach", 0, 70, 1, 16, "mm"), S("skew", "Skew", 0, 70, 1, 24, "°")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y = 40 + (i + r()) / p.count * 430, [x] = seam(s, -6 + r() * p.reach, y), a = -Math.PI / 2 + sideDir(s) * (r() - .25) * p.skew * Math.PI / 90, L = p.length * (.6 + r() * .6), hw = p.width / 2, c = Math.cos(a), sn = Math.sin(a), T = (u, v) => [x + u * c - v * sn, y + u * sn + v * c], pts = [];
        for (let u = 0; u <= L; u += 8) pts.push(T(u, -hw + (r() - .5) * .7)); for (let v = -hw; v <= hw; v += 1.6) pts.push(T(L + (r() - .5) * 5, v)); for (let u = L; u >= 0; u -= 8) pts.push(T(u, hw + (r() - .5) * .7)); for (let v = hw; v >= -hw; v -= 1.6) pts.push(T((r() - .5) * 5, v)); out.push(poly(pts, 9, .96)); }
      return out; } },
  worn: { name: "Worn print", set: "hand", group: "Wear", noSide: true, knock: true, params: [S("specks", "Specks", 0, 9000, 100, 900), S("patches", "Rubbed spots", 0, 14, 1, 1), S("scratches", "Scratches", 0, 60, 1, 4)],
    gen(p, r) { const out = [], arr = [], wear = hnoise(r, 45), wear2 = hnoise(r, 19);
      for (let i = 0; i < p.specks; i++) { const x = 35 + r() * 190, y = r() * 520; if (wear(x + y * .7) + wear2(y - x) < -.1 && r() < .8) continue; arr.push([x, y, .2 + r() ** 3 * .9]); }
      for (let i = 0; i < p.patches; i++) { const cx = 50 + r() * 160, cy = 20 + r() * 480, rad = 9 + r() * 22; for (let k = 0; k < 170; k++) { const a = r() * 6.283, d = rad * r() ** .6; arr.push([cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d, .25 + r() * .75]); } }
      out.push(dots(arr, 1));
      for (let i = 0; i < p.scratches; i++) { const x = 45 + r() * 170, y = r() * 520, a = r() * 6.283, L = 8 + r() * 42; out.push(hand(r, [[x, y], [x + Math.cos(a) * L * .5 + (r() - .5) * 3, y + Math.sin(a) * L * .5], [x + Math.cos(a) * L, y + Math.sin(a) * L]], { size: .7 + r() * .7, tremor: .12, o: .95 })); }
      return out; } },
  toner: { name: "Photocopy", set: "hand", group: "Wear", params: [S("dust", "Toner dust", 200, 12000, 100, 1200), S("reach", "Reach", 8, 90, 1, 20, "mm"), S("streaks", "Roller streaks", 0, 14, 1, 1), S("blots", "Blots", 0, 20, 1, 2)],
    gen(p, r, sides) { const out = [], arr = [];
      for (const s of sides) { const f = hnoise(r, 60);
        for (let i = 0; i < p.dust; i++) { const y = r() * 530 - 5; if (f(y) < -.2 && r() < .75) continue; const u = -Math.log(1 - r()) * p.reach * .42, [x] = seam(s, u, y); arr.push([x, y, .2 + r() ** 3 * .75]); }
        for (let i = 0; i < p.streaks; i++) { const u = r() * p.reach * 1.1, y0 = r() * 400, L = 40 + r() * 280, c = []; for (let y = y0; y < y0 + L; y += 7) c.push(seam(s, u, y)); out.push(hand(r, c, { raw: false, size: .7 + r() * 1, tremor: .06, rough: .5, press: .7, o: .75 })); }
        for (let i = 0; i < p.blots; i++) { const [x, y] = seam(s, r() ** 2 * p.reach, r() * 520); out.push(blob(r, x, y, 1 + r() ** 2 * 5, { rough: .45 })); } }
      out.push(dots(arr, 1)); return out; } },
});

// bigger tattoo-style drawings; a doubled point makes a sharp corner
const sharp = pts => pts.flatMap(p => [p, p]);
const FLASH = [
  [sharp([[0, -1.25], [.16, -.5], [.11, .28], [0, .46], [-.11, .28], [-.16, -.5], [0, -1.25]]), sharp([[-.46, .34], [.46, .34]]), [[-.46, .34], [-.5, .43], [-.42, .47]], [[0, .47], [.03, 1.05]], circle(.03, 1.14, .1, .2), [[.05, -.9], [.05, .1]]],
  [[[0, 1], [-1, -.1], [-.6, -.82], [0, -.36], [.6, -.86], [1, -.1], [.05, 1]], sharp([[-1.25, .55], [1.2, -.65]]), sharp([[1.2, -.65], [.92, -.68], [1.08, -.42], [1.2, -.65]]), [[.28, -.42], [.55, -.45], [.62, -.15]]],
  [sharp([[0, -1], [.28, -.32], [1, -.3], [.44, .14], [.62, .85], [0, .46], [-.62, .85], [-.44, .14], [-1, -.3], [-.28, -.32], [0, -1]]), sharp([[0, -.5], [.14, -.14], [.48, -.12], [.2, .08], [.3, .42], [0, .22], [-.3, .42], [-.2, .08], [-.48, -.12], [-.14, -.14], [0, -.5]])],
  [Array.from({ length: 30 }, (_, k) => { const a = k * .62, q = .08 + k * .03; return [Math.cos(a) * q, Math.sin(a) * q * .9]; }), [[-.9, -.1], [-.7, -.9], [.1, -1.05], [.85, -.6], [.98, .2], [.5, .9], [-.4, .95], [-.9, .4], [-.9, -.1]], [[-.3, .95], [-.2, 1.3], [-.55, 1.5]], [[.15, 1], [.4, 1.2], [.2, 1.5]]],
  [[[-1.1, 0], [-.45, -.62], [.45, -.62], [1.1, 0], [.45, .6], [-.45, .6], [-1.1, .02]], circle(0, 0, .34, .2), ...[[-.8, -.72, -1.05, -1.05], [-.2, -.85, -.26, -1.3], [.4, -.85, .52, -1.3], [.85, -.68, 1.12, -1.02]].map(([a, b, c, d]) => [[a, b], [c, d]])],
  [circle(0, -.85, .2, .2), [[0, -.66], [0, 1]], sharp([[-.48, -.32], [.48, -.32]]), [[-.95, .3], [-.8, .8], [-.3, 1.02], [0, 1], [.3, 1.02], [.8, .8], [.95, .3]], sharp([[-1.1, .55], [-.95, .3], [-.68, .52]]), sharp([[1.1, .55], [.95, .3], [.68, .52]])],
  [[[.35, -1], [-.6, -.7], [-.86, 0], [-.55, .72], [.35, 1], [-.12, .55], [-.3, 0], [-.12, -.55], [.35, -1]], sharp([[.62, -.32], [.7, -.1], [.92, -.08], [.74, .05], [.8, .28], [.62, .14], [.44, .28], [.5, .05], [.32, -.08], [.54, -.1], [.62, -.32]])],
];
const SHAPES = [
  [[0, -1], [.29, -.31], [1, -.31], [.43, .12], [.62, .81], [0, .4], [-.62, .81], [-.43, .12], [-1, -.31], [-.29, -.31]],
  [[.3, -1], [-.5, .16], [-.02, .16], [-.3, 1], [.52, -.2], [.04, -.2]],
  [[-.3, -1], [.3, -1], [.3, -.3], [1, -.3], [1, .3], [.3, .3], [.3, 1], [-.3, 1], [-.3, .3], [-1, .3], [-1, -.3], [-.3, -.3]],
  [[0, -1], [1, 0], [.42, 0], [.42, 1], [-.42, 1], [-.42, 0], [-1, 0]],
  Array.from({ length: 24 }, (_, k) => [Math.cos(k * .2618), Math.sin(k * .2618)]),
];
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [a, b] = P[i], [e, f] = P[j]; if ((b > y) !== (f > y) && x < (e - a) * (y - b) / (f - b) + a) c = !c; } return c; };
Object.assign(PRESETS, {
  hatch: { name: "Crosshatch", set: "hand", group: "Ink", params: [S("gap", "Spacing", 2, 12, .5, 5, "mm"), S("reach", "Reach", 10, 85, 1, 22, "mm"), S("cross", "Second pass", 0, 1, .05, 0.2), S("angle", "Slant", 10, 70, 1, 38, "°"), S("weight", "Pen size", .7, 2.4, .1, 1, "mm")],
    gen(p, r, sides) { const out = [], k = Math.tan(p.angle * Math.PI / 180);
      for (const s of sides) { const f = hnoise(r, 75); for (let pass = 0; pass < 2; pass++) for (let y = -30; y < 560; y += p.gap * (.75 + r() * .5)) { const L = p.reach * (.5 + .45 * f(y)) * (pass ? p.cross : 1) * (.8 + r() * .4); if (L < 4) continue; const d = pass ? 1 : -1; out.push(hand(r, [seam(s, -3, y), seam(s, L, y + d * L * k)], { size: p.weight, tremor: .16, press: .3, tail: 1.5 })); } }
      return out; } },
  wash: { name: "Ink wash", set: "hand", group: "Ink", params: [S("patches", "Pools", 1, 9, 1, 2), S("size", "Size", 14, 80, 1, 26, "mm"), S("reach", "Reach", 0, 80, 1, 22, "mm"), S("depth", "Strength", .1, .7, .05, 0.2)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.patches; i++) { const y = 30 + (i + r()) / p.patches * 460, [x] = seam(s, r() * p.reach, y), z = p.size * (.6 + r() * .7), a = Math.PI / 2 + (r() - .5) * .6; for (let k = 0; k < 5; k++) out.push(blob(r, x + (r() - .5) * z * .3, y + (r() - .5) * z * .4, z * (1 - k * .15), { ang: a, stretch: 1.5, rough: .42, o: p.depth * (.35 + k * .1) })); const arr = []; for (let k = 0; k < 70; k++) { const t = r() * 6.283, d = z * (1 + r() * .5); arr.push([x + Math.sin(t) * d * .95, y + Math.cos(t) * d * 1.45, .25 + r() ** 2 * 1]); } out.push(dots(arr, 1, Math.min(1, p.depth * 1.6))); }
      return out; } },
  fill: { name: "Painted over", set: "hand", group: "Paint", noSide: true, params: [S("from", "From", 0, 500, 5, 190, "mm"), S("to", "To", 20, 520, 5, 300, "mm"), S("size", "Brush size", 12, 60, 1, 34, "mm"), S("dry", "Dryness", .05, .9, .05, .3)],
    gen(p, r) { const out = []; let d = 1; for (let y = p.from; y < p.to; y += p.size * .62) { const t = (r() - .5) * 18; dryBrush(r, d > 0 ? [[10, y + t], [90, y - 7 + r() * 8], [170, y + 5 - r() * 8], [255, y - t]] : [[255, y + t], [170, y - 5 + r() * 8], [90, y + 7 - r() * 8], [10, y - t]], p.size, p.dry, out); d = -d; } return out; } },
  bleach: { name: "Bleach", set: "hand", group: "Paint", params: [S("patches", "Patches", 1, 12, 1, 2), S("size", "Size", 10, 70, 1, 22, "mm"), S("reach", "Reach", 0, 85, 1, 30, "mm"), S("runs", "Runs", 0, 12, 1, 1)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.patches; i++) { const y = 20 + (i + r()) / p.patches * 480, [x] = seam(s, r() * p.reach, y), z = p.size * (.55 + r() * .8), arr = []; for (let k = 0; k < 7; k++) out.push(blob(r, x + (r() - .5) * z * .5, y + (r() - .5) * z * .7, z * (1.15 - k * .13), { ang: Math.PI / 2, stretch: 1.35, rough: .5, o: .13 + k * .035 }));
        for (let k = 0; k < 260; k++) { const a = r() * 6.283, q = z * (.7 + r() ** 1.6 * 1.1); arr.push([x + Math.cos(a) * q * .9, y + Math.sin(a) * q * 1.3, .22 + r() ** 3 * 1.1]); } out.push(dots(arr, 1, .75)); }
      for (const s of sides) for (let i = 0; i < p.runs; i++) { const [x, y] = seam(s, r() * p.reach, r() * 420), L = 40 + r() * 100, c = []; for (let t = 0; t <= L; t += 3) c.push([x + Math.sin(t * .05) * 1, y + t]); out.push(hand(r, c, { raw: true, size: 1 + r() * 1.6, tremor: .12, o: .6, tail: .6 })); }
      return out; } },
  stencil: { name: "Stencil", set: "hand", group: "Paint", params: [G("shape", "Shape", 0, [[0, "Star"], [1, "Bolt"], [2, "Cross"], [3, "Arrow"], [4, "Circle"]]), S("count", "Prints", 1, 10, 1, 2), S("size", "Size", 8, 44, .5, 14, "mm"), S("reach", "Reach", 0, 70, 1, 26, "mm"), S("fog", "Overspray", 0, 1, .05, 0.25)],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y = 40 + (i + .2 + r() * .6) / p.count * 440, [x] = seam(s, p.size + r() * p.reach, y), z = p.size * (.85 + r() * .3), a = (r() - .5) * .5, P = SHAPES[p.shape].map(([u, v]) => [x + (u * Math.cos(a) - v * Math.sin(a)) * z, y + (u * Math.sin(a) + v * Math.cos(a)) * z]), arr = [], n = z * z * 26;
        for (let k = 0; k < n; k++) { const px = x + (r() * 2 - 1) * z * 1.5, py = y + (r() * 2 - 1) * z * 1.5, inside = inPoly(px, py, P); if (inside ? r() > .09 : r() < p.fog * .1 * r()) arr.push([px, py, inside ? .3 + r() * .4 : .2 + r() * .2]); } out.push(dots(arr, 1)); }
      return out; } },
  tag: { name: "Graffiti tag", set: "hand", group: "Drawn", params: [S("count", "Tags", 1, 5, 1, 1), S("size", "Size", 12, 60, 1, 22, "mm"), S("letters", "Letters", 3, 9, 1, 5), S("inset", "From seam", 14, 80, 1, 34, "mm"), S("weight", "Pen size", 1, 7, .1, 2.2, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) for (let i = 0; i < p.count; i++) { const y0 = 480 - (i + r() * .4) / p.count * 400, M = (u, v) => { const y = y0 - u, [x] = seam(s, p.inset + v, y); return [x, y]; }, c = [M(-4, p.size * .55)], step = p.size * .72; let u = 0;
        for (let k = 0; k < p.letters; k++) { const tall = .7 + r() * .8, loop = r() < .4; c.push(M(u + step * .15, -p.size * tall * .5), M(u + step * (.34 + r() * .25), p.size * .42)); if (loop) c.push(M(u + step * .85, -p.size * .2), M(u + step * .35, p.size * .05)); u += step; }
        c.push(M(u + step * .4, -p.size * .55), M(u + step * .95, -p.size * .2)); out.push(hand(r, c, { size: p.weight, tremor: .3, press: .5, tail: 2.5 }));
        out.push(hand(r, [M(u + step * .9, p.size * .86), M(u * .55, p.size * .72), M(-step * .3, p.size * .96)], { size: p.weight * .8, tremor: .4, tail: 3 }));
        for (let k = 0; k < 3; k++) out.push(blob(r, ...M(u + step * (1.1 + k * .34), p.size * .25 + (r() - .5) * 6), p.weight * .55, { rough: .3 }));
        for (let k = 0; k < 2; k++) { const q = c[1 + Math.floor(r() * (c.length - 2))], L = 8 + r() * 26, t = []; for (let d = 0; d <= L; d += 3) t.push([q[0], q[1] + d]); out.push(hand(r, t, { raw: true, size: p.weight * .4, tremor: .08, tail: .4 })); } }
      return out; } },
  vines: { name: "Thorn vine", set: "hand", group: "Drawn", params: [S("inset", "From seam", 6, 70, 1, 22, "mm"), S("wander", "Wander", 2, 34, 1, 10, "mm"), S("thorns", "Thorn gap", 8, 50, 1, 30, "mm"), S("leaves", "Leaves", 0, 1, .05, 0.2), S("weight", "Stem size", .9, 5, .1, 1.6, "mm")],
    gen(p, r, sides) { const out = [];
      for (const s of sides) { const w = hnoise(r, 62), c = []; for (let y = 530; y > -14; y -= 16) c.push(seam(s, p.inset + w(y) * p.wander, y)); const pts = spline(c, 2); out.push(hand(r, pts, { raw: true, size: p.weight, tremor: .3, press: .45, tail: .5 }));
        let side = 1; for (let i = 6, step = p.thorns / 2; i < pts.length - 6; i += Math.round(step * (.8 + r() * .5))) { const a = pts[i - 2], b = pts[i + 2], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * side, ny = dx / l * side, q = pts[i], L = 4 + r() * 5;
          if (r() < p.leaves) { const tip = [q[0] + nx * 11 + dx / l * 9, q[1] + ny * 11 + dy / l * 9], m = [(q[0] + tip[0]) / 2, (q[1] + tip[1]) / 2], o = 3.4; out.push(poly(spline([q, [m[0] - dy / l * o, m[1] + dx / l * o], tip], 1).concat(spline([tip, [m[0] + dy / l * o, m[1] - dx / l * o], q], 1)), 2)); }
          else out.push(poly([[q[0] - dx / l * 1.6, q[1] - dy / l * 1.6], [q[0] + dx / l * 1.6, q[1] + dy / l * 1.6], [q[0] + nx * L + dx / l * 2.6, q[1] + ny * L + dy / l * 2.6]], 2)); side = -side; } }
      return out; } },
  flash: { name: "Tattoo flash", set: "hand", group: "Drawn", params: [S("count", "Tattoos", 1, 9, 1, 2), S("size", "Size", 10, 40, .5, 17, "mm"), S("reach", "Reach", 0, 60, 1, 16, "mm"), S("weight", "Needle size", .8, 3, .1, 1.5, "mm"), S("filler", "Filler marks", 0, 40, 1, 4)],
    gen(p, r, sides) { const out = [], first = Math.floor(r() * FLASH.length);
      sides.forEach((s, si) => { for (let i = 0; i < p.count; i++) { const y = 45 + (i + .2 + r() * .6) / p.count * 430, [x] = seam(s, p.size * 1.25 + 4 + r() * p.reach, y), z = p.size * (.85 + r() * .35), a = (r() - .5) * .6, d = FLASH[(first + i * 2 + si * 3) % FLASH.length]; for (const st of d) out.push(hand(r, st.map(([u, v]) => [x + (u * Math.cos(a) - v * Math.sin(a)) * z, y + (u * Math.sin(a) + v * Math.cos(a)) * z]), { size: p.weight, tremor: .15, press: .3 })); for (let k = 0; k < 5; k++) { const t = -.9 + k * .32, q = [x + (.75 + r() * .15) * z * Math.cos(a) + t * z * -Math.sin(a), y + (.75 + r() * .15) * z * Math.sin(a) + t * z * Math.cos(a)]; out.push(hand(r, [q, [q[0] - z * .22, q[1] + z * .05]], { size: p.weight * .75, tremor: .08, tail: 1.6 })); } }
        for (let k = 0; k < p.filler; k++) { const [x, y] = seam(s, 6 + r() * (p.reach + p.size * 2.4), r() * 500 + 10); if (r() < .5) out.push(blob(r, x, y, .7 + r() * .7, { rough: .1 })); else { const q = 1.6 + r() * 1.8; out.push(hand(r, [[x - q, y], [x + q, y]], { size: .9, tremor: .05 }), hand(r, [[x, y - q], [x, y + q]], { size: .9, tremor: .05 })); } } });
      return out; } },
  hotrod: { name: "Hot rod flames", set: "hand", group: "Paint", noSide: true, params: [S("tongues", "Tongues", 3, 10, 1, 4), S("at", "Reach up to", 40, 470, 5, 330, "mm"), S("base", "Solid to", 300, 530, 5, 470, "mm"), S("curl", "Curl", 0, 40, 1, 20, "mm")],
    gen(p, r) { const c = [[-6, 530], [-6, p.base]], n = p.tongues; for (let i = 0; i < n; i++) { const x0 = -6 + i / n * 272, x1 = -6 + (i + 1) / n * 272, w = x1 - x0, tip = p.at + r() * (p.base - p.at) * .5, cu = (r() < .5 ? -1 : 1) * p.curl, v = p.base - r() * 22;
        c.push(...spline([[x0, i ? v + 8 : p.base], [x0 + w * .34, (v + tip) * .5 + 14], [x0 + w * .3 + cu, tip + (p.base - tip) * .22], [x0 + w * .55 + cu * 1.1, tip], [x0 + w * .78 + cu * .4, tip + (p.base - tip) * .36], [x0 + w * .66, (v + tip) * .5 + 40], [x1, v + 8]], 2)); }
      c.push([266, p.base], [266, 530]); const f = hnoise(r, 26); return [poly(c.map(([x, y], i) => [x + f(i) * .5, y + f(i + 40) * .5]), 9)]; } },
  ransom: { name: "Ransom letters", set: "hand", group: "Drawn", text: true, params: [S("size", "Size", 8, 34, .5, 13, "mm"), S("inset", "From seam", 8, 70, 1, 24, "mm"), S("gap", "Word gap", 8, 120, 1, 170, "mm"), S("mess", "Messiness", 0, 1, .05, 0.4)],
    gen(p, r, sides, l) { const out = [], text = (l.text || "AREABOYS").toUpperCase(), fonts = ["Anton", "Permanent Marker", "Caveat Brush", "Archivo"], ink = lum(l.color) > .5 ? "#111111" : "#F0EDE6";
      for (const s of sides) { let y = 500; while (y > -10) { for (const ch of text) { if (ch === " ") { y -= p.size * .8; continue; } const z = p.size * (.86 + r() * .32), w = z * (.78 + r() * .32), [x] = seam(s, p.inset + (r() - .5) * p.size * .55 * p.mess, y), a = -Math.PI / 2 + (r() - .5) * .5 * p.mess, cx = Math.cos(a), sx = Math.sin(a), T = (u, v) => [x + u * cx - v * sx, y + u * sx + v * cx], e = () => (r() - .5) * 1.6;
            out.push(poly([T(-w / 2 + e(), -z * .6 + e()), T(w / 2 + e(), -z * .6 + e()), T(w / 2 + e(), z * .6 + e()), T(-w / 2 + e(), z * .6 + e())], 9, .97)); const f = fonts[Math.floor(r() * fonts.length)]; measure.font = `100px "${f}"`; const tw = measure.measureText(ch).width * z * .8 / 100; out.push({ t: "text", s: ch, x: x - cx * tw / 2, y: y - sx * tw / 2, size: z * .8, rot: a, font: f, w: 9, o: 1, c: ink }); y -= w * .98; } y -= p.gap * (.8 + r() * .5); } }
      return out; } },
  crackle: { name: "Cracked ink", set: "hand", group: "Wear", noSide: true, knock: true, params: [S("cracks", "Cracks", 4, 90, 1, 12), S("length", "Length", 20, 180, 5, 70, "mm"), S("weight", "Width", .5, 2.5, .05, .9, "mm")],
    gen(p, r) { const out = []; for (let i = 0; i < p.cracks; i++) { const x = 45 + r() * 170, y = r() * 520, a = r() * 6.283, pts = walk(r, [x, y], a, p.length * (.4 + r() * .8), .32); out.push(poly(ribbon(pts, p.weight, .12), 1)); for (let k = 0; k < 3; k++) { const q = pts[Math.floor(r() * pts.length)], b = walk(r, q, a + (r() < .5 ? 1.2 : -1.2) + (r() - .5), 8 + r() * 26, .35); out.push(poly(ribbon(b, p.weight * .7, .1), 1)); } } return out; } },
  fray: { name: "Edge wear", set: "hand", group: "Wear", knock: true, params: [S("amount", "Amount", 40, 900, 10, 120), S("reach", "Reach", 3, 40, 1, 13, "mm"), S("ends", "Cuff wear", 0, 1, .05, .6)],
    gen(p, r, sides) { const out = [], arr = [];
      for (const s of sides) for (let i = 0; i < p.amount; i++) { const y = r() * 530 - 5, u = -Math.log(1 - r()) * p.reach * .45 - 1, [x] = seam(s, u, y); if (r() < .35) out.push(hand(r, [[x, y], [x + sideDir(s) * (2 + r() * 8), y + (r() - .5) * 4]], { size: .7 + r() * 1.2, tremor: .05, rough: .4 })); else arr.push([x, y, .25 + r() ** 2 * 1.1]); }
      for (let i = 0; i < p.amount * p.ends; i++) { const top = r() < .5, x = 45 + r() * 170, y = top ? topY(Math.min(215, Math.max(45, x))) + r() ** 2 * p.reach * 1.2 : 492 - r() ** 2 * p.reach * 1.2; arr.push([x, y, .25 + r() ** 2 * 1]); }
      out.push(dots(arr, 1)); return out; } },
});

// Each look is one idea, with at most one quiet accent.
const worn = (color, seed, p) => ["worn", { color, seed, ...(p ? { p } : {}) }];
const HAND_LOOKS = [
  { name: "First Coat", base: COL.ink, logo: COL.bone, layers: [["slash", { side: "R", seed: 41 }], worn(COL.ink, 3)] },
  { name: "Run Off", base: COL.ink, logo: COL.bone, layers: [["drips", { seed: 8 }]] },
  { name: "Thrown", base: COL.bone, logo: COL.ink, layers: [["splatter", { side: "R", color: COL.ink, seed: 19, p: { splats: 3, size: 9, spray: 34 } }]] },
  { name: "Bad Handwriting", base: COL.charcoal, logo: COL.charcoal, layers: [["scrawl", { side: "L", seed: 4 }]] },
  { name: "Wired", base: COL.ink, logo: COL.bone, layers: [["wire", { seed: 2 }]] },
  { name: "Sharpie", base: COL.bone, logo: COL.ink, layers: [["doodles", { side: "R", color: COL.ink, seed: 13, p: { count: 6, size: 12, weight: 1.7 } }]] },
  { name: "Mended", base: COL.olive, logo: COL.bone, layers: [["stitch", { seed: 5 }]] },
  { name: "Block Print", base: COL.bone, logo: COL.ink, layers: [["lino", { side: "R", color: COL.ink, seed: 22 }], worn(COL.bone, 12)] },
  { name: "Gaffer", base: COL.ink, logo: COL.bone, layers: [["tape", { side: "R", color: COL.cotton, seed: 28 }]] },
  { name: "Back Alley", base: COL.charcoal, logo: COL.bone, layers: [["spray", { side: "L", color: COL.lime, seed: 16 }]] },
  { name: "Copy Shop", base: COL.white, logo: COL.ink, layers: [["toner", { color: COL.ink, seed: 18 }]] },
  { name: "Roller", base: COL.navy, logo: COL.bone, layers: [["roller", { side: "R", color: COL.cotton, seed: 26 }], worn(COL.navy, 4)] },
  { name: "Thorn", base: COL.ink, logo: COL.bone, layers: [["vines", { side: "R", seed: 6 }]] },
  { name: "Flash Sheet", base: COL.bone, logo: COL.ink, layers: [["flash", { side: "R", color: COL.ink, seed: 3, p: { count: 3, size: 22, weight: 1.7 } }]] },
  { name: "Hot Rod", base: COL.ink, logo: COL.bone, layers: [["hotrod", { color: COL.red, seed: 12, p: { at: 240 } }], worn(COL.ink, 2)] },
  { name: "Ransom", base: COL.charcoal, logo: COL.charcoal, layers: [["ransom", { side: "R", seed: 8 }]] },
  { name: "Bleached", base: COL.navy, logo: COL.bone, layers: [["bleach", { side: "R", color: COL.cotton, seed: 13 }]] },
  { name: "Repainted", base: COL.bone, logo: COL.ink, layers: [["fill", { color: COL.ink, seed: 18 }], worn(COL.bone, 4)] },
  { name: "Stencilled", base: COL.olive, logo: COL.bone, layers: [["stencil", { side: "R", color: COL.bone, seed: 8 }]] },
  { name: "Tagged", base: COL.ink, logo: COL.bone, layers: [["tag", { side: "R", seed: 11 }]] },
].map(l => ({ ...l, set: "hand" }));
LOOKS.unshift(...HAND_LOOKS);
