// Every image referenced by program.json exists, is a JPEG/PNG, and is under 150 KB.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(root, 'data/program.json'), 'utf8'));
const home = ['goblet_squat', 'pushup', 'db_row', 'db_ohp', 'db_rdl', 'band_pull_apart', 'glute_bridge'];
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }
for (const [id, ex] of Object.entries(P.exercises)) {
  for (const f of ['media_url', 'diagram_url']) {
    const u = ex[f];
    if (home.includes(id)) ok(!!u, id + ' missing ' + f);
    if (!u) continue;
    const p = path.join(root, u);
    ok(fs.existsSync(p), id + ' ' + u + ' missing file');
    if (!fs.existsSync(p)) continue;
    const b = fs.readFileSync(p);
    ok(b.length < 150 * 1024, u + ' too big ' + b.length);
    ok((b[0] === 0xff && b[1] === 0xd8) || b.slice(1, 4).toString() === 'PNG', u + ' not jpeg/png');
    ok(/^\d+\/\d+$/.test(ex[f.replace('_url', '_ratio')] || ''), id + ' bad ratio for ' + f);
  }
}
console.log(pass + '/' + (pass + fail) + ' image checks passed');
process.exit(fail ? 1 : 0);
