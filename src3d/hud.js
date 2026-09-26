// DOM overlay in Tekken 8's language: slim angled health bars meeting at the
// round-win dots, name ribbons under the bar ends, a win streak, diagonal-strip
// stage select with a RANDOM slot, and menu rows with the pink highlight.
// Typography is one family (Barlow / Barlow Condensed), solid fills only.
export const DIFFICULTIES = [
  { id: 'expert', label: 'EXPERT', handicap: 0.0 },
  { id: 'hard', label: 'HARD', handicap: 0.15 },
  { id: 'medium', label: 'MEDIUM', handicap: 0.35 },
  { id: 'easy', label: 'EASY', handicap: 0.55 },
  { id: 'beginner', label: 'BEGINNER', handicap: 0.75 },
];

const BAR_W = 820;

// One health bar, drawn for the left side and mirrored for the right: a slim
// frame, straight outer end, diagonal inner end, fill hot at the outer end.
function barSvg(side) {
  const id = (k) => `${k}-${side}`;
  const mirror = side === 'p2' ? `transform="translate(${BAR_W} 0) scale(-1 1)"` : '';
  // viewBox 820 x 40: thin heat line (0-3), health bar (7-25), name band (27-40)
  const channel = 'M0 7 H818 L800 25 H0 Z';
  return `
  <svg class="bar" viewBox="0 0 ${BAR_W} 40" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id('fill')}" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#ffe86a"/><stop offset="0.55" stop-color="#ffb126"/><stop offset="1" stop-color="#ff6a12"/>
      </linearGradient>
      <linearGradient id="${id('gloss')}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
      </linearGradient>
      <clipPath id="${id('clip')}"><path d="${channel}"/></clipPath>
      <clipPath id="${id('mclip')}"><rect x="0" y="0" width="818" height="3"/></clipPath>
      <filter id="${id('glow')}" x="-4%" y="-120%" width="108%" height="340%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <g ${mirror}>
      <rect x="0" y="0" width="818" height="3" fill="#0a0b10" fill-opacity="0.8"/>
      <g clip-path="url(#${id('mclip')})"><rect class="meter" x="0" y="0" width="818" height="3" fill="#3fd8ff"/></g>
      <rect class="glow" x="0" y="7" width="818" height="18" fill="#ff8a1f" opacity="0.35" filter="url(#${id('glow')})"/>
      <path d="${channel}" fill="#0a0b10" fill-opacity="0.82"/>
      <g clip-path="url(#${id('clip')})">
        <rect class="trail" x="0" y="7" width="818" height="18" fill="#f3f4f7" opacity="0.85"/>
        <rect class="fill" x="0" y="7" width="818" height="18" fill="url(#${id('fill')})"/>
        <rect x="0" y="7" width="818" height="18" fill="url(#${id('gloss')})"/>
      </g>
      <path d="${channel}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1"/>
      <path d="M0 27 H798 L786 40 H0 Z" fill="#000000" fill-opacity="0.55"/>
    </g>
  </svg>`;
}

function lightningPath(w, h, y0, seed) {
  let x = -20;
  let y = y0;
  const pts = [`M ${x} ${y}`];
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  while (x < w + 20) {
    x += 18 + rnd() * 46;
    y = y0 + (rnd() - 0.5) * h;
    pts.push(`L ${x} ${y}`);
  }
  return pts.join(' ');
}


// TECCHEN boot logo: angular Tekken-style letterforms drawn as paths (chrome
// split gradient, dark bevel, red under-glow, a diagonal slash through the
// word), so no font download or outlined text is involved.
const LOGO_GLYPHS = {
  T: 'M0 0 H64 V20 H42 V90 L22 100 V20 H0 Z',
  E: 'M0 0 H64 L57 20 H20 V40 H54 L48 58 H20 V80 H64 V100 H0 Z',
  C: 'M0 0 H64 L56 20 H20 V80 H64 L58 100 H0 Z',
  H: 'M0 0 H20 V40 H44 V0 H64 V100 H44 V60 H20 V100 H0 Z',
  N: 'M0 0 H22 L44 50 V0 H64 V100 H42 L20 50 V100 H0 Z',
};
function logoSvg(word = 'TECCHEN', key = 'lg') {
  const W = 64, GAP = 12;
  const letters = [...word].map((ch, i) => `<path d="${LOGO_GLYPHS[ch]}" transform="translate(${i * (W + GAP)} 0)"/>`).join('');
  const width = word.length * (W + GAP) - GAP;
  return `
  <svg class="boot-logo" viewBox="-40 -30 ${width + 80} 160" aria-label="${word}">
    <defs>
      <linearGradient id="${key}-chrome" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.38" stop-color="#d9dde6"/><stop offset="0.5" stop-color="#6f7582"/>
        <stop offset="0.56" stop-color="#eef0f4"/><stop offset="0.82" stop-color="#b7bcc6"/><stop offset="1" stop-color="#5b606b"/>
      </linearGradient>
      <linearGradient id="${key}-red" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ff2a3c"/><stop offset="1" stop-color="#b3001b"/></linearGradient>
      <filter id="${key}-glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="${key}-soft" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
      <mask id="${key}-slash"><rect x="-60" y="-60" width="${width + 120}" height="220" fill="#fff"/>
        <path d="M-30 74 L${width + 30} 22 L${width + 30} 30 L-30 82 Z" fill="#000"/></mask>
    </defs>
    <g transform="skewX(-9)">
      <g fill="url(#${key}-red)" opacity="0.95" filter="url(#${key}-glow)">${letters}</g>
      <g fill="#07070a" transform="translate(0 7)" filter="url(#${key}-soft)">${letters}</g>
      <g mask="url(#${key}-slash)">
        <g fill="#0a0b10" stroke="#0a0b10" stroke-width="5" stroke-linejoin="miter">${letters}</g>
        <g fill="url(#${key}-chrome)">${letters}</g>
        <g fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2">${letters}</g>
      </g>
    </g>
  </svg>`;
}

// The supplied logo artwork sits on solid black; on the title screen it has
// to float over the arena, so the black is keyed to transparency once
// (alpha from the brightest channel, colours un-premultiplied to stay vivid).
function keyBlack(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const m = Math.max(p[i], p[i + 1], p[i + 2]);
    const a = Math.min(255, Math.round(m * 1.7));
    if (a > 0 && a < 255) {
      const f = 255 / a;
      p[i] = Math.min(255, p[i] * f); p[i + 1] = Math.min(255, p[i + 1] * f); p[i + 2] = Math.min(255, p[i + 2] * f);
    }
    p[i + 3] = a;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}

export function createHud(root, { roster, stages }) {
  const chars = Object.values(roster);
  const stripStyle = (s) => (s.hdri ? `style="background-image:url(assets/stage_wide_${s.hdri}.jpg)"` : 'class="ss-img neon"');
  const thumbStyle = (s) => (s.hdri ? `style="background-image:url(assets/stages_${s.hdri}.png)"` : 'class="ss-thumb-img neon"');
  const prompt = (glyph, label) => `<span class="pr"><i>${glyph}</i>${label}</span>`;

  root.innerHTML = `
    <div class="boot"><div class="boot-flash"></div><img class="boot-logo" src="assets/logo/tecchen.webp" alt="TECCHEN"></div>
    <div class="fight-hud hidden">
      <div class="fh-port p1"><div class="in"><img alt=""></div></div>
      <div class="fh-port p2"><div class="in"><img alt=""></div></div>
      <div class="fh-bars">
        <div class="fh-side p1">${barSvg('p1')}</div>
        <div class="fh-center">
          <div class="row"><div class="fh-pips p1"><i></i><i></i></div><div class="fh-pips p2"><i></i><i></i></div></div>
          <div class="fh-timer">∞</div>
        </div>
        <div class="fh-side p2">${barSvg('p2')}</div>
      </div>
      <div class="fh-name p1"><b></b><span></span></div>
      <div class="fh-name p2"><b></b><span></span></div>
      <div class="fh-round">ROUND 1</div>
      <div class="fh-combo p1"><i class="nm"></i><div><b>0</b> HITS <em>0 DMG</em></div></div>
      <div class="fh-combo p2"><i class="nm"></i><div><b>0</b> HITS <em>0 DMG</em></div></div>
      <div class="fh-call p1"><b></b><span></span></div>
      <div class="fh-call p2"><b></b><span></span></div>
      <div class="fh-moves"><div class="mv-inner"></div><div class="mv-foot">C · CLOSE</div></div>
      <div class="fh-streak">WINS <b>0</b></div>
    </div>

    <div class="splash">
      <svg class="sp-bolts" preserveAspectRatio="none" viewBox="0 0 1000 400">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path class="bolt a" d=""/><path class="bolt b" d=""/><path class="bolt c" d=""/>
      </svg>
      <div class="sp-beam"></div>
      <div class="sp-sparks"></div>
      <div class="sp-text"></div>
      <div class="sp-sub"></div>
    </div>

    <div class="title">
      <div class="t-bg"></div>
      <div class="t-logo"><img class="t-logo-img" src="assets/logo/tecchen.webp" alt="TECCHEN"></div>
      <div class="t-press">PRESS ENTER</div>
    </div>

    <div class="select">
      <div class="sel-bg"></div>
      <div class="sel-head"><div class="sel-kicker">CHARACTER SELECT</div><div class="sel-name"></div><div class="sel-co"></div></div>
      <div class="sel-menu">
        <div class="menu-title">Fight Settings</div>
        <div class="menu-row on"><span>Difficulty</span><b><i>‹</i><u></u><i>›</i></b></div>
        <div class="menu-row"><span>Rounds</span><b>Best of 3</b></div>
        <div class="menu-row"><span>Time Limit</span><b>∞</b></div>
      </div>
      <div class="sel-tiles">
        ${chars.map((c, i) => `<div class="tile" data-i="${i}"><img src="${c.portraitHud || c.portrait}" onerror="this.onerror=null;this.src='${c.portrait}'" alt=""><b>${c.name}</b></div>`).join('')}
        ${Array.from({ length: 6 }, () => `<div class="tile locked"><b>LOCKED</b></div>`).join('')}
      </div>
      <div class="prompts">${prompt('←→', 'Fighter')}${prompt('↑↓', 'Difficulty')}${prompt('↵', 'Confirm')}${prompt('⎋', 'Back')}</div>
    </div>

    <div class="stagesel">
      <div class="ss-strips">
        <div class="ss-strip random"><div class="ss-img q">?</div></div>
        ${stages.map((s, i) => `<div class="ss-strip" data-i="${i}"><div ${s.hdri ? 'class="ss-img"' : ''} ${stripStyle(s)}></div></div>`).join('')}
      </div>
      <div class="ss-head"><div class="ss-kicker">STAGE SELECT</div><div class="ss-name">RANDOM</div><div class="ss-tag"></div></div>
      <div class="ss-thumbs">
        <div class="ss-thumb random"><div class="ss-thumb-img q">?</div></div>
        ${stages.map((s, i) => `<div class="ss-thumb" data-i="${i}"><div ${s.hdri ? 'class="ss-thumb-img"' : ''} ${thumbStyle(s)}></div></div>`).join('')}
      </div>
      <div class="prompts">${prompt('←→', 'Stage')}${prompt('↵', 'Confirm')}${prompt('⎋', 'Back')}</div>
    </div>

    <div class="loading"><div class="l-bar"><i></i></div><div class="l-text"></div></div>
    <pre class="debug"></pre>
  `;

  const q = (s) => root.querySelector(s);
  {
    const logo = root.querySelector('.t-logo-img');
    const src = new Image();
    src.onload = () => { try { logo.src = keyBlack(src); } catch (e) { console.warn('logo keying failed', e); } };
    src.src = logo.getAttribute('src');
  }
  const qa = (s) => [...root.querySelectorAll(s)];
  const el = {
    fight: q('.fight-hud'),
    port: [q('.fh-port.p1 img'), q('.fh-port.p2 img')],
    nameB: [q('.fh-name.p1 b'), q('.fh-name.p2 b')],
    nameTag: [q('.fh-name.p1 span'), q('.fh-name.p2 span')],
    fill: [q('.fh-side.p1 .fill'), q('.fh-side.p2 .fill')],
    glow: [q('.fh-side.p1 .glow'), q('.fh-side.p2 .glow')],
    trail: [q('.fh-side.p1 .trail'), q('.fh-side.p2 .trail')],
    meter: [q('.fh-side.p1 .meter'), q('.fh-side.p2 .meter')],
    bar: [q('.fh-side.p1 .bar'), q('.fh-side.p2 .bar')],
    pips: [q('.fh-pips.p1'), q('.fh-pips.p2')],
    combo: [q('.fh-combo.p1'), q('.fh-combo.p2')],
    comboN: [q('.fh-combo.p1 b'), q('.fh-combo.p2 b')],
    comboD: [q('.fh-combo.p1 em'), q('.fh-combo.p2 em')],
    comboName: [q('.fh-combo.p1 .nm'), q('.fh-combo.p2 .nm')],
    call: [q('.fh-call.p1'), q('.fh-call.p2')],
    moves: q('.fh-moves'), movesInner: q('.fh-moves .mv-inner'),
    round: q('.fh-round'), streak: q('.fh-streak b'),
    splash: q('.splash'), spText: q('.sp-text'), spSub: q('.sp-sub'), sparks: q('.sp-sparks'), bolts: qa('.sp-bolts .bolt'),
    boot: q('.boot'), title: q('.title'), select: q('.select'), stagesel: q('.stagesel'),
    selName: q('.sel-name'), selCo: q('.sel-co'), diffVal: q('.menu-row.on u'),
    tiles: qa('.sel-tiles .tile:not(.locked)'),
    strips: qa('.ss-strip'), thumbs: qa('.ss-thumb'), ssName: q('.ss-name'), ssTag: q('.ss-tag'),
    loading: q('.loading'), loadingText: q('.l-text'), debug: q('.debug'),
  };
  const trail = [1, 1];
  const lastHealth = [1, 1];
  const lastCombo = [0, 0];
  let splashT = 0;
  let seed = 7;
  const scaleX = (node, f) => node.setAttribute('transform', `scale(${Math.max(0.0001, f)} 1)`);

  return {
    setFighters(c1, c2, tags) {
      [c1, c2].forEach((c, i) => {
        el.fight.style.setProperty(`--acc${i + 1}`, c.accent);
        el.port[i].onerror = () => { el.port[i].onerror = null; el.port[i].src = c.portrait; };
        el.port[i].src = c.portraitHud || c.portrait;
        el.nameB[i].textContent = c.name;
        el.nameTag[i].textContent = tags[i];
      });
    },
    setHealth(i, frac) {
      frac = Math.max(0, Math.min(1, frac));
      scaleX(el.fill[i], frac);
      scaleX(el.glow[i], frac);
      if (frac < lastHealth[i] - 0.001) { el.bar[i].classList.remove('hit'); void el.bar[i].getBoundingClientRect(); el.bar[i].classList.add('hit'); }
      el.bar[i].classList.toggle('low', frac <= 0.25);
      lastHealth[i] = frac;
    },
    setMeter(i, frac) {
      scaleX(el.meter[i], Math.max(0, Math.min(1, frac)));
      el.bar[i].classList.toggle('full', frac >= 0.999);
    },
    setRounds(i, wins) {
      const pips = el.pips[i].children;
      for (let k = 0; k < pips.length; k++) pips[k].classList.toggle('on', k < wins);
    },
    setRound(n) { el.round.textContent = `ROUND ${n}`; },
    setStreak(n) { el.streak.textContent = String(n); el.streak.parentElement.classList.toggle('hidden', n <= 0); },
    setCombo(i, hits, t, damage, name = null) {
      const c = el.combo[i];
      if (hits < 2 || t <= 0) { c.style.opacity = 0; lastCombo[i] = 0; return; }
      if (lastCombo[i] !== hits) {
        el.comboN[i].textContent = String(hits);
        el.comboD[i].textContent = `${Math.round(damage)} DMG`;
        el.comboName[i].textContent = name || '';
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        lastCombo[i] = hits;
      }
      c.style.opacity = Math.min(1, t * 2.5);
    },

    // short side callout: COUNTER HIT, BOUND, RAGE ART + move name
    callout(i, text, sub = '') {
      const c = el.call[i];
      c.querySelector('b').textContent = text;
      c.querySelector('span').textContent = sub;
      c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    },

    // move list overlay; lists = [{ name, accent, rows: [[name, input, heights, note]] }] or null
    showMoves(lists) {
      el.moves.classList.toggle('show', !!lists);
      if (!lists) return;
      const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
      el.movesInner.innerHTML = lists.map((l) => `
        <section style="--acc:${esc(l.accent)}">
          <h3>${esc(l.name)} <small>COMMAND LIST</small></h3>
          <div class="mv-row mv-head"><span>MOVE</span><span>INPUT</span><span>HITS</span><span>NOTES</span></div>
          ${l.rows.map((r) => `<div class="mv-row"><span>${esc(r[0])}</span><span class="in">${esc(r[1])}</span><span>${esc(r[2])}</span><span>${esc(r[3])}</span></div>`).join('')}
        </section>`).join('');
    },

    // style: 'round' | 'fight' | 'ko' | 'win' | 'info'
    splash(text, sub = '', seconds = 1.2, style = 'info') {
      el.spText.textContent = text;
      el.spSub.textContent = sub;
      el.splash.className = `splash show ${style}`;
      el.bolts.forEach((b, k) => { seed = (seed * 7 + 13) % 1000 + 1; b.setAttribute('d', lightningPath(1000, 60 + k * 30, 200 + (k - 1) * 12, seed)); });
      const n = style === 'info' ? 0 : (style === 'ko' ? 70 : 46);
      let html = '';
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = 120 + Math.random() * 520;
        html += `<i style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d * 0.55}px;--dl:${Math.random() * 0.12}s;--sz:${2 + Math.random() * 4}px"></i>`;
      }
      el.sparks.innerHTML = html;
      void el.splash.offsetWidth;
      el.splash.classList.add('pop');
      splashT = seconds;
    },
    hideSplash() { el.splash.classList.remove('show'); splashT = 0; },

    show(screen) {
      el.boot.classList.toggle('show', screen === 'boot');
      el.title.classList.toggle('show', screen === 'title');
      el.select.classList.toggle('show', screen === 'select');
      el.stagesel.classList.toggle('show', screen === 'stage');
      el.fight.classList.toggle('hidden', screen !== 'fight');
    },
    setSelectChar(idx) {
      const c = chars[idx];
      el.tiles.forEach((t, k) => t.classList.toggle('on', k === idx));
      el.selName.textContent = c.name;
      el.selCo.textContent = c.company;
    },
    setDifficulty(idx) { el.diffVal.textContent = DIFFICULTIES[idx].label; },
    // idx: -1 = random, otherwise a stage index
    setStageSel(idx) {
      el.strips.forEach((s, k) => s.classList.toggle('on', k - 1 === idx));
      el.thumbs.forEach((s, k) => s.classList.toggle('on', k - 1 === idx));
      el.stagesel.classList.toggle('random', idx < 0);
      el.ssName.textContent = idx < 0 ? 'RANDOM' : stages[idx].name;
      el.ssTag.textContent = idx < 0 ? 'A STAGE IS CHOSEN FOR YOU' : stages[idx].tagline;
    },
    setLoading(text) {
      el.loading.classList.toggle('show', !!text);
      if (text) el.loadingText.textContent = text;
    },
    setDebug(text) {
      el.debug.style.display = text ? 'block' : 'none';
      if (text) el.debug.textContent = text;
    },
    get chars() { return chars; },

    update(dt, fracs) {
      for (let i = 0; i < 2; i++) {
        const f = Math.max(0, Math.min(1, fracs[i]));
        if (f < trail[i]) trail[i] = Math.max(f, trail[i] - dt * 0.4);
        else trail[i] = f;
        scaleX(el.trail[i], trail[i]);
      }
      if (splashT > 0) {
        splashT -= dt;
        if (splashT <= 0) el.splash.classList.remove('show');
      }
    },
  };
}
