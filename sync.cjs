// Copies the live job-search automation into this repo, redacts private details, and blocks personal data.
//   node sync.cjs          copy the live files in, redact, then run the personal-data check
//   node sync.cjs --check  run the check only (CI does this on every push)
// The live files stay where Claude Code runs them; this repo is the versioned, shareable copy.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = __dirname, HOME = os.homedir();
// shortcut: the live work folder still sits under another project; update this path when it moves
const WORK = 'C:/Users/berk_/Desktop/FoodieProject/.claude/worktrees/cv-to-latex-7a5459/.playwright-mcp';

const sources = () => {
  const agents = path.join(HOME, '.claude/agents');
  const tasks = path.join(HOME, '.claude/scheduled-tasks');
  return [
    ...fs.readdirSync(agents).filter((f) => /^job-.*\.md$/.test(f)).map((f) => [path.join(agents, f), `agents/${f}`]),
    [path.join(HOME, '.claude/skills/job-search/SKILL.md'), 'skills/job-search/SKILL.md'],
    ...['job-scan-linkedin-hourly', 'us-outreach-sender', 'us-outreach-batch-builder']
      .map((t) => [path.join(tasks, t, 'SKILL.md'), `scheduled-tasks/${t}/SKILL.md`]),
    [path.join(WORK, 'build-us-outreach.cjs'), 'scripts/us-outreach/build-us-outreach.cjs'],
    [path.join(WORK, 'us-outreach-step.cjs'), 'scripts/us-outreach/us-outreach-step.cjs'],
  ];
};

// Salary bands are private: employers can read a public repo.
const REDACT = [[/Salary \(Berk[^)]*\):.*?(?=Abroad:|$)/gm, 'Salary: use the bands in the private answers file (not in this repo); leave "current/last salary" questions for Berk. ']];

// Real personal data never belongs here. Rules that merely mention a topic (for example "never enter a TC kimlik no") are fine.
const BLOCK = [
  ['Turkish mobile number', /(?:\+90|\b0)[\s-]?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/],
  ['personal e-mail address', /[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|icloud)\.[a-z.]+/i],
  ['salary figure', /\d{2}[.,]000\s*(?:-|–)\s*\d{2}[.,]000|net a month/i],
  ['11-digit ID number', /\b[1-9]\d{10}\b/],
];

function check() {
  const bad = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name), rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (['.git', 'node_modules'].includes(d.name) || rel === 'sync.cjs') return;
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
  for (const [from, to] of sources()) {
    if (!fs.existsSync(from)) { console.warn('missing, skipped: ' + from); continue; }
    let text = fs.readFileSync(from, 'utf8').replace(/\r\n/g, '\n');
    for (const [re, sub] of REDACT) text = text.replace(re, sub);
    fs.mkdirSync(path.dirname(path.join(ROOT, to)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, to), text);
  }
  console.log('copied ' + sources().length + ' files');
}
check();
