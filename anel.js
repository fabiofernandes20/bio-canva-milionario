// Anel de partículas 3D em volta da foto da Rosana.
// Adaptado do "elemento 3D" da biblioteca: cores da marca, fundo claro,
// entrada que revela a foto e reação ao toque/mouse. Sem efeito de rolagem.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';

const palco = document.getElementById('palco');
const canvas = document.getElementById('anel');
const revelar = () => palco.classList.add('pronto');
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 700px)').matches || navigator.maxTouchPoints > 0;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  palco.classList.add('sem-3d'); revelar();
  throw e;
}

const cfg = {
  pontos: mobile ? 2600 : 5200,
  fios: mobile ? 130 : 240,
  raio: 1.34, tubo: 0.06, tamanho: 0.3,
  raioMouse: 0.8, forcaMouse: 0.3, suaveMouse: 0.06, ruido: 0.026,
};

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.z = 6.4;
renderer.setClearColor(0x000000, 0);

function ajustar() {
  const w = palco.clientWidth || 300;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.setSize(w, w, false);
}
ajustar();
addEventListener('resize', ajustar);

// Paleta da marca (lavanda → magenta → coral → pêssego), usada nos shaders
const paleta = `
  vec3 paleta(float t) {
    vec3 lav = vec3(.70, .58, 1.0), mag = vec3(.90, .0, .49), cor = vec3(1.0, .36, .30), pes = vec3(1.0, .70, .42);
    vec3 c = mix(lav, mag, smoothstep(.0, .38, t));
    c = mix(c, cor, smoothstep(.38, .72, t));
    return mix(c, pes, smoothstep(.72, 1.0, t));
  }
`;

const uniforms = {
  uTime: { value: 0 }, uMouse: { value: new THREE.Vector3() }, uMousePower: { value: 0 },
  uRadius: { value: cfg.raioMouse }, uStrength: { value: cfg.forcaMouse },
  uNoise: { value: cfg.ruido }, uLoad: { value: 0 },
};

/* ---------- Pontos do anel ---------- */
const n = cfg.pontos;
const pos = new Float32Array(n * 3), tam = new Float32Array(n), sem = new Float32Array(n), cor = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const ang = Math.random() * Math.PI * 2;
  const faixa = Math.random() < 0.76 ? 0.74 + Math.random() * 0.26 : Math.random();
  const volta = Math.random() * Math.PI * 2;
  const corpo = 0.008 * Math.sin(ang * 4 + .7) + 0.004 * Math.sin(ang * 11 - .4);
  const onda = 1 + 0.055 * Math.sin(ang * 7 + volta * 2) + (Math.random() - .5) * .06;
  const t = cfg.tubo * faixa * onda, r = cfg.raio + corpo + t * Math.cos(volta), k = i * 3;
  pos[k] = r * Math.cos(ang); pos[k + 1] = r * Math.sin(ang);
  pos[k + 2] = t * Math.sin(volta) * 1.28 + (Math.random() - .5) * .025;
  tam[i] = cfg.tamanho * (.45 + Math.random() * .72);
  sem[i] = Math.random();
  cor[i] = THREE.MathUtils.clamp((Math.sin(ang + .8) + 1) * .5 + (Math.random() - .5) * .08, 0, 1);
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('aSize', new THREE.BufferAttribute(tam, 1));
geo.setAttribute('aSeed', new THREE.BufferAttribute(sem, 1));
geo.setAttribute('aColor', new THREE.BufferAttribute(cor, 1));

const pontos = new THREE.Points(geo, new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false,
  vertexShader: `
    uniform float uTime, uMousePower, uRadius, uStrength, uNoise, uLoad; uniform vec3 uMouse;
    attribute float aSize, aSeed, aColor; varying float vColor, vAlpha;
    void main() {
      vec3 p = position;
      float org = sin(p.x * 7.0 + uTime * .32 + aSeed * 12.0) * cos(p.y * 6.0 - uTime * .23 + aSeed * 9.0);
      p += normalize(vec3(p.xy, p.z * 1.5)) * org * uNoise;
      float dm = distance(p.xy, uMouse.xy);
      float inf = pow(smoothstep(uRadius, 0.0, dm) * uMousePower, .68);
      vec3 rad = normalize(vec3(p.xy, 0.0));
      vec3 tan = vec3(-rad.y, rad.x, 0.0);
      p += rad * inf * uStrength * (.26 + aSeed * .24);
      p += tan * inf * sin(aSeed * 18.0 + uTime) * uStrength * .06;
      p += normalize(p) * sin(dm * 19.0 - uTime * 1.4 + aSeed * 9.0) * .035 * inf;
      p += normalize(p) * sin(uTime * .26 + aSeed * 8.0) * .009;
      // Entrada: começa preenchendo o círculo e migra para a borda
      float ld = smoothstep(0.0, 1.0, uLoad);
      float ia = fract(sin(aSeed * 91.73) * 43758.54) * 6.2831853;
      float ir = sqrt(fract(sin((aSeed + .37) * 143.17) * 24634.63)) * 1.2;
      vec3 ip = vec3(cos(ia) * ir, sin(ia) * ir, sin(aSeed * 32.0 + uTime * .7) * .2);
      p = mix(ip, p, ld);
      vec4 v = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * v;
      vColor = mix(clamp((ip.y + 1.2) / 2.4, 0.0, 1.0), aColor, ld);
      vAlpha = .5 + inf * .5 + aSeed * .12;
      gl_PointSize = aSize * (125.0 / -v.z) * (${(Math.min(devicePixelRatio, mobile ? 1.75 : 2)).toFixed(2)});
    }`,
  fragmentShader: paleta + `
    varying float vColor, vAlpha;
    void main() {
      float d = length(gl_PointCoord - .5);
      float a = smoothstep(.5, .1, d) * vAlpha * .8;
      if (a < .015) discard;
      gl_FragColor = vec4(paleta(vColor), a);
    }`,
}));
cena.add(pontos);

/* ---------- Fios (a "membrana" que vibra) ---------- */
const seg = 64, fN = cfg.fios * seg * 2;
const lp = new Float32Array(fN * 3), ls = new Float32Array(fN), lc = new Float32Array(fN), la = new Float32Array(fN);
let li = 0;
for (let f = 0; f < cfg.fios; f++) {
  const off = (Math.random() - .5) * .10, s = Math.random() * 30, esc = .95 + Math.random() * .10;
  for (let g = 0; g < seg; g++) {
    const a1 = g / seg * Math.PI * 2, a2 = (g + 1) / seg * Math.PI * 2;
    const r = a => cfg.raio + 0.008 * Math.sin(a * 4 + .7) + 0.004 * Math.sin(a * 11 - .4) + off
      + Math.sin(a * 7 + s) * .012 + Math.sin(a * 15 - s * 1.7) * .006;
    const ps = [[r(a1) * Math.cos(a1) * esc, r(a1) * Math.sin(a1) * esc, Math.sin(a1 * 3 + s) * .018],
                [r(a2) * Math.cos(a2) * esc, r(a2) * Math.sin(a2) * esc, Math.sin(a2 * 3 + s) * .018]];
    [a1, a2].forEach((a, v) => {
      lp.set(ps[v], li * 3); ls[li] = s; lc[li] = (Math.sin(a + .8) + 1) * .5; la[li] = a; li++;
    });
  }
}
const lgeo = new THREE.BufferGeometry();
lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
lgeo.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
lgeo.setAttribute('aColor', new THREE.BufferAttribute(lc, 1));
lgeo.setAttribute('aAngle', new THREE.BufferAttribute(la, 1));

const fios = new THREE.LineSegments(lgeo, new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false,
  vertexShader: `
    uniform float uTime, uMousePower, uRadius, uStrength, uLoad; uniform vec3 uMouse;
    attribute float aSeed, aColor, aAngle; varying float vColor, vAlpha, vFlow;
    void main() {
      vec3 p = position; float a = atan(p.y, p.x);
      vec3 rad = normalize(vec3(p.xy, 0.0));
      float w = sin(a * 11.0 - uTime * 2.45 + aSeed * 1.8) * .015 + sin(a * 23.0 + uTime * 3.15 + aSeed * .7) * .007;
      float pulse = pow(.5 + .5 * sin(a * 6.0 - uTime * 2.8 + aSeed * .25), 8.0);
      p += rad * (w + pulse * .010);
      float ld = smoothstep(0.0, 1.0, uLoad);
      float x = sin(aSeed * 12.9898) * .96;
      float hh = sqrt(max(0.0, 1.0 - x * x)) * 1.2;
      float iy = (aAngle / 6.2831853 * 2.0 - 1.0) * hh;
      vec3 ip = vec3(x * 1.2 + sin(iy * 7.0 - uTime * 1.8 + aSeed) * .03, iy, .0);
      p = mix(ip, p, ld);
      float inf = pow(smoothstep(uRadius, 0.0, distance(p.xy, uMouse.xy)) * uMousePower, .68);
      vec3 tan = vec3(-rad.y, rad.x, 0.0);
      p += rad * inf * uStrength * (.38 + .32 * (.5 + .5 * sin(aSeed * 4.7 + uTime * 1.35)));
      p += tan * inf * sin(aSeed * 7.3 + a * 5.0 + uTime * .75) * uStrength * .095;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      vColor = mix(clamp((iy + 1.2) / 2.4, 0.0, 1.0), aColor, ld);
      vAlpha = .32 + inf * .6;
      vFlow = .5 + .42 * sin(aAngle * 9.0 - uTime * 4.2 + aSeed * 2.5) + .18 * sin(aAngle * 21.0 + uTime * 6.0 + aSeed);
    }`,
  fragmentShader: paleta + `
    varying float vColor, vAlpha, vFlow;
    void main() {
      float sh = .45 + clamp(vFlow, 0.0, 1.0) * .7;
      gl_FragColor = vec4(paleta(vColor), vAlpha * (.16 + sh * .2));
    }`,
}));
cena.add(fios);

/* ---------- Brilhos ao redor ---------- */
const bN = mobile ? 36 : 60;
const bp = new Float32Array(bN * 3), bs = new Float32Array(bN);
for (let i = 0; i < bN; i++) {
  const a = Math.random() * Math.PI * 2, r = 1.0 + Math.random() * .75;
  bp.set([Math.cos(a) * r, Math.sin(a) * r, -.4 - Math.random()], i * 3); bs[i] = Math.random();
}
const bgeo = new THREE.BufferGeometry();
bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
bgeo.setAttribute('aSeed', new THREE.BufferAttribute(bs, 1));
cena.add(new THREE.Points(bgeo, new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false,
  vertexShader: `
    uniform float uTime, uLoad; attribute float aSeed; varying float vT, vS;
    void main() {
      vec3 p = position; p.y += sin(uTime * .3 + aSeed * 18.0) * .04;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      vT = (.5 + .5 * sin(uTime * (.8 + aSeed) + aSeed * 34.0)) * uLoad; vS = aSeed;
      gl_PointSize = (3.0 + aSeed * 5.0) * (.7 + vT * .6) * ${(Math.min(devicePixelRatio, 2)).toFixed(2)};
    }`,
  fragmentShader: paleta + `
    varying float vT, vS;
    void main() {
      vec2 q = gl_PointCoord - .5;
      float star = max(smoothstep(.06, .0, abs(q.x)) * smoothstep(.5, .0, abs(q.y)), smoothstep(.06, .0, abs(q.y)) * smoothstep(.5, .0, abs(q.x)));
      float a = max(star, smoothstep(.22, .0, length(q))) * vT * .75;
      if (a < .02) discard;
      gl_FragColor = vec4(mix(paleta(vS), vec3(1.0), .25), a);
    }`,
})));

/* ---------- Toque / mouse ---------- */
const alvo = new THREE.Vector3(), suave = new THREE.Vector3(), ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let dentro = false;
function apontar(e) {
  const r = canvas.getBoundingClientRect();
  const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(v, camera); ray.ray.intersectPlane(plano, alvo); dentro = true;
}
palco.addEventListener('pointermove', apontar, { passive: true });
palco.addEventListener('pointerdown', apontar, { passive: true });
palco.addEventListener('pointerleave', () => { dentro = false; }, { passive: true });
palco.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(() => { dentro = false; }, 500); }, { passive: true });

/* ---------- Animação ---------- */
const relogio = new THREE.Clock();
let visivel = true, revelado = false, rodando = false;

function quadro() {
  const t = relogio.getElapsedTime();
  uniforms.uTime.value = t;
  const l = THREE.MathUtils.clamp((t - .25) / 2.3, 0, 1);
  uniforms.uLoad.value = l * l * (3 - 2 * l);
  if (!revelado && l > .45) { revelado = true; revelar(); }
  suave.lerp(alvo, cfg.suaveMouse); uniforms.uMouse.value.copy(suave);
  uniforms.uMousePower.value += ((dentro ? 1 : 0) - uniforms.uMousePower.value) * .05;
  cena.rotation.z = Math.sin(t * .055) * .02;
  renderer.render(cena, camera);
}
function loop() {
  if (!visivel) { rodando = false; return; }
  quadro(); requestAnimationFrame(loop);
}

if (calmo) {
  uniforms.uLoad.value = 1; uniforms.uTime.value = 4; renderer.render(cena, camera); revelar();
} else {
  new IntersectionObserver(([en]) => {
    visivel = en.isIntersecting;
    if (visivel && !rodando) { rodando = true; loop(); }
  }).observe(palco);
  rodando = true; loop();
}
// Garantia: a foto aparece mesmo se algo travar
setTimeout(revelar, 2500);
