"use strict";
// Home and Looks pages: draws looks with the same engine the Studio uses.
const LOOK_INFO = {
  "Aftershock": "Thin cracks along the seams and one quake line.",
  "Selvedge": "Fine lines hugging both sides, with one lime thread.",
  "Silt": "Grain settling against both seams.",
  "Bone Tally": "Hand-cut tally marks down one side.",
  "Coastline": "Contour rings on one side, tide lines on the other.",
  "Redline": "Red and white streaks over a halftone wrist.",
  "Surveyor": "A measuring scale down one seam.",
  "Split": "Two colours on one long diagonal.",
  "Ember": "Red flames climbing one side.",
  "Scrawl": "One loose, scribbled line.",
  "Worn": "Scratches like old paint.",
  "Prism": "Sharp facets fading in from one side.",
  "Netline": "Diamond mesh along both sides.",
  "On Repeat": "Your text, repeated down one seam.",
  "Dusk": "Red fading up from the wrist.",
  "Cuff": "Clean bands at the wrist.",
};
function drawLook(cv, look, px) {
  const s = px / 520, img = layImage(s, lookState(look)); cv.width = img.width; cv.height = img.height; cv.getContext("2d").drawImage(img, 0, 0);
}
const fontsReady = document.fonts ? Promise.all([document.fonts.load("100px Anton"), document.fonts.ready]).catch(() => {}) : Promise.resolve();
function lookCard(look) {
  const a = document.createElement("a"); a.className = "look"; a.href = "studio.html?look=" + encodeURIComponent(look.name); a.dataset.tone = lum(look.base) > .5 ? "Light" : "Dark";
  a.innerHTML = `<canvas role="img" aria-label="${look.name} sleeve"></canvas><b>${look.name}</b><span>${LOOK_INFO[look.name] || ""}</span><span class="use">Open in Studio ${ic("arrow-right", 15)}</span>`;
  return a;
}
function fillGrid(host, looks) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const c = e.target.querySelector("canvas"); drawLook(c, e.target.look, 760); }), { rootMargin: "300px" });
  looks.forEach(l => { const a = lookCard(l); a.look = l; host.append(a); io.observe(a); });
}
fontsReady.then(() => {
  const strip = document.getElementById("strip"); if (strip) fillGrid(strip, ["Selvedge", "Ember", "Coastline"].map(n => LOOKS.find(l => l.name === n)));
  const all = document.getElementById("allLooks");
  if (all) { fillGrid(all, LOOKS); document.querySelectorAll("#tone button").forEach(b => { b.onclick = () => { document.querySelectorAll("#tone button").forEach(o => o.setAttribute("aria-pressed", o === b)); all.querySelectorAll(".look").forEach(c => { c.hidden = b.textContent !== "All" && c.dataset.tone !== b.textContent; }); }; }); }
  const hero = document.getElementById("heroArt");
  if (hero) { const names = ["Aftershock", "Ember", "Selvedge", "Dusk", "Coastline", "Redline"], looks = names.map(n => LOOKS.find(l => l.name === n)), a = hero.querySelector("canvas:nth-of-type(1)"), b = hero.querySelector("canvas:nth-of-type(2)"), label = document.getElementById("heroName"), still = matchMedia("(prefers-reduced-motion: reduce)").matches; let i = 0, front = a, back = b;
    drawLook(front, looks[0], 1200); front.classList.add("on"); label.textContent = looks[0].name;
    if (!still) setInterval(() => { if (document.hidden) return; i = (i + 1) % looks.length; drawLook(back, looks[i], 1200); back.classList.add("on"); front.classList.remove("on"); [front, back] = [back, front]; label.textContent = looks[i].name; }, 4200); }
});
