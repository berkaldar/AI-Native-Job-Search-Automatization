// Claude Code only loads an agent or skill whose frontmatter has a name and a description.
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const front = (file) => {
  const m = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(m, file + ': no frontmatter');
  return Object.fromEntries(m[1].split(/\r?\n/).map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]));
};
const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter((f) => f.endsWith('.md'));
assert(agents.length >= 10, 'agents missing');
for (const f of agents) {
  const fm = front(path.join(ROOT, 'agents', f));
  assert.strictEqual(fm.name, f.replace(/\.md$/, ''), f + ': name must match the file name');
  assert(fm.description && fm.description.length > 30, f + ': description too short');
}
const skill = front(path.join(ROOT, 'skills/job-search/SKILL.md'));
assert(skill.name && skill.description, 'job-search skill frontmatter');
for (const t of fs.readdirSync(path.join(ROOT, 'scheduled-tasks'))) {
  assert(fs.readFileSync(path.join(ROOT, 'scheduled-tasks', t, 'SKILL.md'), 'utf8').trim().length > 200, t + ': empty task prompt');
}
console.log(`definitions ok (${agents.length} agents, 1 skill, scheduled tasks)`);
