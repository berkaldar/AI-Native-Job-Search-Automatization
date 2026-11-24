// Keeps personal data out of this repo.
//   node sync.cjs          copy the 3 scheduled-task prompts in (they must live in ~/.claude), then run the check
//   node sync.cjs --check  run the check only (CI does this on every push)
// Agents, skill and scripts live in this repo (.claude/, scripts/). Private runtime data lives in work/ (Git-ignored).
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = __dirname;

const TASKS = ['job-scan-linkedin-hourly', 'us-outreach-sender', 'us-outreach-batch-builder'];

// Real personal data never belongs here. Rules that merely mention a topic (for example "never enter a TC kimlik no") are fine.
const BLOCK = [
  ['Turkish mobile number', /(?:\+90|\b0)[\s-]?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/],
  ['personal e-mail address', /[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|icloud)\.[a-z.]+/i],
  ['salary figure', /\d{2}[.,]000\s*(?:-|–)\s*\d{2}[.,]000|net a month/i],
  ['11-digit ID number', /\b[1-9]\d{10}\b/],
];

function check() {
  const bad = [];
  // nothing under work/ may be tracked, even if someone force-adds it
  try {
    const tracked = execSync('git ls-files work', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (tracked) bad.push('files under work/ are tracked:\n  ' + tracked.split('\n').slice(0, 10).join('\n  '));
  } catch { /* not a git checkout: nothing to check */ }
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name), rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (['.git', 'node_modules'].includes(d.name) || rel === 'work' || rel === 'sync.cjs') return;
    if (d.isDirectory()) return walk(p);
    if (!/\.(md|cjs|js|json|ya?ml|html|txt)$|^\.git(ignore|attributes)$/.test(d.name)) return bad.push(`${rel}: only text files belong in this repo`);
    const text = fs.readFileSync(p, 'utf8');
    for (const [what, re] of BLOCK) if (re.test(text)) bad.push(`${rel}: ${what} (${text.match(re)[0].slice(0, 3)}…)`);
  });
  walk(ROOT);
  if (bad.length) { console.error('Personal-data check FAILED:\n- ' + bad.join('\n- ')); process.exit(1); }
  console.log('personal-data check ok');
}

if (!process.argv.includes('--check')) {
  for (const t of TASKS) {
    const from = path.join(os.homedir(), '.claude/scheduled-tasks', t, 'SKILL.md'), to = path.join(ROOT, 'scheduled-tasks', t, 'SKILL.md');
    if (!fs.existsSync(from)) { console.warn('missing, skipped: ' + from); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, fs.readFileSync(from, 'utf8').replace(/\r\n/g, '\n'));
  }
  console.log('copied the scheduled-task prompts');
}
check();
