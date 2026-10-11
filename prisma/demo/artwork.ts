/**
 * Placeholder product artwork for the optional demo catalog, drawn as SVG and
 * rasterized with sharp. These are illustrations, clearly not photographs —
 * replace them with real product photos before launch.
 */

type Palette = { bg: string; bg2: string; surface: string; accent: string; ink: string };

const PALETTES: Record<string, Palette> = {
  limestone: { bg: "#e9e1d4", bg2: "#ddd2c1", surface: "#d3c6b2", accent: "#c08a2d", ink: "#2b2724" },
  sage: { bg: "#dfe3d6", bg2: "#cfd5c3", surface: "#bcc4ac", accent: "#3e4a2f", ink: "#2b2724" },
  blush: { bg: "#efe0db", bg2: "#e4cfc8", surface: "#d8bdb4", accent: "#8c2f39", ink: "#2b2724" },
  stone: { bg: "#e4e2dd", bg2: "#d4d1ca", surface: "#c2beb5", accent: "#5e554d", ink: "#2b2724" },
  sea: { bg: "#dbe6e6", bg2: "#c9d9d9", surface: "#b3c8c7", accent: "#2f5563", ink: "#2b2724" },
};

function frame(p: Palette, inner: string, seed = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient>
    <linearGradient id="table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.surface}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3c9" stop-opacity="0.9"/><stop offset="1" stop-color="#fff3c9" stop-opacity="0"/></radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>
    <linearGradient id="concrete" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a9a49b"/><stop offset="0.45" stop-color="#c6c1b8"/><stop offset="1" stop-color="#9d978d"/></linearGradient>
    <linearGradient id="plaster" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9e4da"/><stop offset="0.5" stop-color="#faf7f1"/><stop offset="1" stop-color="#ded8cc"/></linearGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#wall)"/>
  <rect y="1040" width="1200" height="460" fill="url(#table)"/>
  ${inner}
  <rect width="1200" height="1500" fill="#fff" filter="url(#grain)"/>
</svg>`;
}

function flame(cx: number, top: number, scale = 1) {
  const h = 110 * scale;
  return `<ellipse cx="${cx}" cy="${top + h * 0.45}" rx="${120 * scale}" ry="${150 * scale}" fill="url(#glow)"/>
  <path d="M${cx} ${top + h} c ${28 * scale} -${22 * scale} ${34 * scale} -${60 * scale} 0 -${h} c -${34 * scale} ${40 * scale} -${28 * scale} ${78 * scale} 0 ${h}z" fill="#d79a2e"/>
  <path d="M${cx} ${top + h} c ${12 * scale} -${10 * scale} ${14 * scale} -${28 * scale} 0 -${h * 0.5} c -${14 * scale} ${18 * scale} -${12 * scale} ${36 * scale} 0 ${h * 0.5}z" fill="#fbe7b0"/>`;
}

export function concreteJar(palette = "limestone", label?: string, seed = 1) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1245" rx="330" ry="46" fill="url(#shadow)"/>
     <path d="M330 760 h540 l-22 470 c-2 26 -22 44 -48 44 H400 c-26 0 -46 -18 -48 -44z" fill="url(#concrete)"/>
     <ellipse cx="600" cy="760" rx="270" ry="40" fill="#bdb7ad"/>
     <ellipse cx="600" cy="764" rx="242" ry="31" fill="#f1e6d0"/>
     <path d="M600 762 v-62" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/>
     ${flame(600, 580, 1)}
     ${label ? `<rect x="440" y="930" width="320" height="150" rx="10" fill="#efe4cf"/><text x="600" y="1022" text-anchor="middle" font-family="Georgia, serif" font-size="62" fill="${p.ink}">${label}</text>` : ""}
     <g fill="#8f897f" opacity=".5"><circle cx="420" cy="1100" r="5"/><circle cx="760" cy="980" r="4"/><circle cx="520" cy="1180" r="3"/><circle cx="700" cy="1150" r="4"/></g>`,
    seed,
  );
}

export function taperPair(palette = "sage", seed = 2) {
  const p = PALETTES[palette];
  const candle = (x: number, h: number) => `
    <rect x="${x - 34}" y="${1150 - h}" width="68" height="${h}" rx="18" fill="${p.accent}" opacity=".85"/>
    <rect x="${x - 34}" y="${1150 - h}" width="22" height="${h}" rx="11" fill="#fff" opacity=".18"/>
    <path d="M${x} ${1150 - h} v-40" stroke="${p.ink}" stroke-width="6" stroke-linecap="round"/>
    ${flame(x, 1150 - h - 150, 0.75)}
    <ellipse cx="${x}" cy="1162" rx="90" ry="22" fill="#b9b2a7"/><rect x="${x - 62}" y="1130" width="124" height="34" rx="12" fill="#cfc8bd"/>`;
  return frame(p, `<ellipse cx="600" cy="1220" rx="360" ry="40" fill="url(#shadow)"/>${candle(470, 620)}${candle(730, 520)}`, seed);
}

export function plasterCross(palette = "stone", name?: string, seed = 3) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1255" rx="250" ry="34" fill="url(#shadow)"/>
     <path d="M545 330 h110 v240 h190 v110 h-190 v560 h-110 v-560 h-190 v-110 h190z" fill="url(#plaster)" stroke="#d6cfc1" stroke-width="4"/>
     <path d="M520 1090 c60 -70 120 -150 230 -260" stroke="${PALETTES.sage.accent}" stroke-width="10" fill="none" stroke-linecap="round"/>
     <path d="M590 1010 c-50 -6 -76 -36 -80 -74 46 2 76 30 80 74z M650 940 c-14 -48 4 -84 40 -104 16 42 2 80 -40 104z M662 928 c46 -18 84 -10 104 22 -40 22 -80 14 -104 -22z M598 1004 c34 -34 72 -40 104 -20 -28 32 -68 40 -104 20z" fill="${PALETTES.sage.accent}"/>
     ${name ? `<text x="600" y="720" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="${p.ink}" opacity=".75">${name}</text>` : ""}`,
    seed,
  );
}

export function resinTray(palette = "sea", seed = 4) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1150" rx="460" ry="120" fill="url(#shadow)"/>
     <ellipse cx="600" cy="1080" rx="440" ry="170" fill="#e8f0ef" opacity=".7"/>
     <ellipse cx="600" cy="1070" rx="420" ry="155" fill="${p.accent}" opacity=".35"/>
     <ellipse cx="600" cy="1062" rx="380" ry="130" fill="#ffffff" opacity=".35"/>
     <g fill="${PALETTES.limestone.accent}"><path d="M420 1040 l30 -8 -12 22z"/><path d="M700 1000 l26 6 -20 14z"/><path d="M560 1110 l18 -14 6 20z"/><path d="M780 1090 l22 -4 -8 18z"/><circle cx="480" cy="1100" r="5"/><circle cx="650" cy="1040" r="4"/><circle cx="720" cy="1120" r="6"/></g>
     <rect x="520" y="900" width="160" height="110" rx="20" fill="url(#concrete)"/><ellipse cx="600" cy="900" rx="80" ry="14" fill="#f1e6d0"/><path d="M600 898 v-28" stroke="${p.ink}" stroke-width="5"/>${flame(600, 760, 0.6)}`,
    seed,
  );
}

export function favorJars(palette = "blush", seed = 5) {
  const p = PALETTES[palette];
  const jar = (x: number, y: number) => `
    <ellipse cx="${x}" cy="${y + 150}" rx="95" ry="18" fill="url(#shadow)"/>
    <rect x="${x - 80}" y="${y}" width="160" height="150" rx="16" fill="url(#concrete)"/>
    <ellipse cx="${x}" cy="${y}" rx="80" ry="14" fill="#f1e6d0"/>
    <path d="M${x - 80} ${y + 70} h160" stroke="${p.accent}" stroke-width="10"/>
    <path d="M${x - 10} ${y + 70} l-30 34 M${x + 10} ${y + 70} l30 34" stroke="${p.accent}" stroke-width="8" stroke-linecap="round"/>`;
  return frame(p, `${jar(420, 880)}${jar(640, 880)}${jar(860, 880)}${jar(530, 1030)}${jar(750, 1030)}`, seed);
}

export function starOrnament(palette = "limestone", seed = 6) {
  const p = PALETTES[palette];
  const star = (cx: number, cy: number, r: number) => {
    const points: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
    }
    return `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy - r}" stroke="${p.accent}" stroke-width="4"/><polygon points="${points.join(" ")}" fill="url(#plaster)" stroke="#d6cfc1" stroke-width="3"/>`;
  };
  return frame(p, `${star(380, 620, 150)}${star(640, 840, 190)}${star(900, 560, 130)}`, seed);
}

export function trinketDish(palette = "stone", seed = 7) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1170" rx="320" ry="60" fill="url(#shadow)"/>
     <path d="M300 1060 c0 80 600 80 600 0 l-40 70 c-20 40 -500 40 -520 0z" fill="url(#concrete)"/>
     <ellipse cx="600" cy="1060" rx="300" ry="70" fill="#c9c4bb"/>
     <ellipse cx="600" cy="1066" rx="260" ry="52" fill="#b4aea4"/>
     <circle cx="560" cy="1060" r="26" fill="none" stroke="${p.accent === "#5e554d" ? "#c08a2d" : p.accent}" stroke-width="8"/>
     <circle cx="650" cy="1072" r="18" fill="none" stroke="#c08a2d" stroke-width="6"/>`,
    seed,
  );
}

export function keepsakeTag(palette = "limestone", text = "Maya", seed = 8) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1150" rx="380" ry="50" fill="url(#shadow)"/>
     <path d="M330 760 L420 680 H870 V1100 H420 L330 1020 Z" fill="#d9bf94"/>
     <circle cx="400" cy="890" r="26" fill="${p.bg2}"/>
     <path d="M400 890 C 300 700, 200 600, 120 560" stroke="${p.ink}" stroke-width="5" fill="none"/>
     <text x="645" y="925" text-anchor="middle" font-family="Georgia, serif" font-size="120" fill="${p.ink}">${text}</text>`,
    seed,
  );
}

export function incenseHolder(palette = "sage", seed = 9) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1170" rx="300" ry="48" fill="url(#shadow)"/>
     <path d="M360 1120 q240 -110 480 0 q-240 60 -480 0z" fill="url(#plaster)" stroke="#d6cfc1" stroke-width="3"/>
     <path d="M600 1090 L760 520" stroke="#6b4a2b" stroke-width="7" stroke-linecap="round"/>
     <path d="M760 520 c-30 -60 40 -100 10 -170 c-20 -50 30 -90 0 -150" stroke="#9c958b" stroke-width="5" fill="none" opacity=".6"/>`,
    seed,
  );
}

export function giftBox(palette = "blush", seed = 10) {
  const p = PALETTES[palette];
  return frame(
    p,
    `<ellipse cx="600" cy="1230" rx="420" ry="50" fill="url(#shadow)"/>
     <rect x="250" y="800" width="700" height="420" rx="14" fill="#f2ebe0"/>
     <rect x="250" y="800" width="700" height="60" fill="#e6dccc"/>
     <rect x="570" y="800" width="60" height="420" fill="${p.accent}" opacity=".8"/>
     <rect x="330" y="640" width="200" height="200" rx="18" fill="url(#concrete)"/><ellipse cx="430" cy="640" rx="100" ry="16" fill="#f1e6d0"/><path d="M430 638 v-34" stroke="${p.ink}" stroke-width="6"/>${flame(430, 470, 0.7)}
     <path d="M700 840 C 700 700, 720 640, 760 600" stroke="${PALETTES.sage.accent}" stroke-width="8" fill="none"/>
     <path d="M740 660 c-40 -6 -60 -30 -62 -60 36 2 58 24 62 60z M772 620 c-10 -38 4 -66 32 -82 12 34 0 64 -32 82z" fill="${PALETTES.sage.accent}"/>`,
    seed,
  );
}
