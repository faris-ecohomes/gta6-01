// Palma Bay: Heat Wave — the hand-in program (Node 22, standard library
// only). The game itself is the static site in game/ (open game/index.html
// in a desktop browser, no build step, no network); this program copies
// game/ and screenshots/ into the output directory and writes the dossier
// the judge reads, using the kit's own vendored library so the bytes match
// what the scorer rebuilds.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   node serve.ts   (plays the game at http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (see the kit's RULES.txt, "The gate"): at
// most 4 screenshots of 256 KiB, at most 993 entries and 48 MiB in game/,
// no path under game/ longer than 1000 bytes, dossier text capped at
// 160 KiB. buildDossier refuses anything the scorer would refuse.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
