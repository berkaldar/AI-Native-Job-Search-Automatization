// The builder is the only gate between a written batch and the scheduled sender, so its checks are tested here.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const BUILDER = path.join(__dirname, '../scripts/us-outreach/build-us-outreach.cjs');
const GOOD = fs.readFileSync(path.join(__dirname, 'fixtures/batch2-emails.md'), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-'));

function build(md, dirs = { out: tmp(), work: tmp() }) {
  fs.writeFileSync(path.join(dirs.out, 'batch2-emails.md'), md);
  const r = spawnSync(process.execPath, [BUILDER], { encoding: 'utf8', env: { ...process.env, US_OUTREACH_DIR: dirs.out, US_WORK_DIR: dirs.work } });
  return { ...r, ...dirs };
}
const queue = (work) => JSON.parse(fs.readFileSync(path.join(work, 'us-outreach-queue.json'), 'utf8'));

// A valid batch: unit e-mails first, then HR; one send file and one dry-run file each.
const ok = build(GOOD);
assert.strictEqual(ok.status, 0, ok.stderr);
const q = queue(ok.work);
assert.deepStrictEqual(q.map((x) => x.id), ['b2-u1', 'b2-u2', 'b2-h1']);
assert.deepStrictEqual(q.map((x) => x.row), ['us-example', 'us-sample', 'us-example']);
assert(q.every((x) => x.status === 'pending'));
const send = fs.readFileSync(path.join(ok.work, 'us-send-b2-u1.js'), 'utf8');
assert(send.includes('SEND = true') && fs.readFileSync(path.join(ok.work, 'us-dry-b2-u1.js'), 'utf8').includes('SEND = false'));
assert(send.includes('"body":"Hi Jane,\\n\\nI read'), 'the Row line must not leak into the e-mail');
const hr = fs.readFileSync(path.join(ok.work, 'us-send-b2-h1.js'), 'utf8');
assert(hr.includes('does the University of Example work with') && hr.includes('support Online Student Success remotely'));
assert(hr.includes('A quick bit about me:\\n- 2 years'), 'HR e-mail gets the five bullets');

// Rebuilding never resets a status, so nothing is sent twice.
q[0].status = 'sent';
fs.writeFileSync(path.join(ok.work, 'us-outreach-queue.json'), JSON.stringify(q));
const again = build(GOOD, { out: ok.out, work: ok.work });
assert.strictEqual(again.status, 0, again.stderr);
assert.strictEqual(queue(ok.work)[0].status, 'sent');

// Each broken batch must be refused.
const bad = {
  'formal greeting': GOOD.replace('Hi Jane,', 'Dear Jane,'),
  'Türkiye spelling': GOOD.replace('from Turkey (Example Online)', 'from Türkiye (Example Online)'),
  'non-.edu address': GOOD.replace('jane.doe@example.edu', 'jane.doe@example.com'),
  'same address twice': GOOD.replace('iso@sample.edu', 'jane.doe@example.edu'),
  'missing Row line': GOOD.replace('**Row:** us-sample\n', ''),
  'missing Check link': GOOD.replace('*Check:* https://www.sample.edu/iso/contact', ''),
  'claims US residency': GOOD.replace('I\'d love to pitch in.', 'I\'m a permanent resident and I\'d love to pitch in.'),
};
for (const [name, md] of Object.entries(bad)) assert.notStrictEqual(build(md).status, 0, 'should refuse: ' + name);

console.log('us-outreach builder tests ok (' + (Object.keys(bad).length + 3) + ' cases)');
