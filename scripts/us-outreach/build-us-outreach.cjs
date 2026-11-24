// US outreach (Berk, 20 Nov): reads every Desktop\Berk CV\US_Outreach\batch<N>-emails.md and writes one Playwright
// run file per e-mail: us-send-<id>.js (sends) and us-dry-<id>.js (fills the form, never sends), plus the send queue.
// Ids: batch 1 keeps u<n>/h<n>; later batches are b<N>-u<n>/b<N>-h<n>. Rebuilding keeps every status, so nothing is resent.
// Pacing is in us-outreach-step.cjs, not here.
const fs = require('fs'), path = require('path'), assert = require('assert');
// env overrides let CI run the builder on test fixtures; defaults are the live folders
const OUT = process.env.US_OUTREACH_DIR || 'C:/Users/berk_/Desktop/Berk CV/US_Outreach';
const WORK = process.env.US_WORK_DIR || path.join(__dirname, '../../work');
const PDF = path.resolve(WORK, 'Berk_Kaldar_Resume_Student_Support.pdf').replace(/\\/g, '/');
const ROWS1 = ['us-ucf', 'us-fhsu', 'us-csuglobal', 'us-louisville', 'us-unf', 'us-psu', 'us-msu', 'us-missouri', 'us-arizona', 'us-uwex', 'us-gcu', 'us-oregonstate'];
const FORBIDDEN = /Türkiye|COMMON BLOCK|\{\{|SSN|social security|green card|US citizen|permanent resident|my friend/i;

const tpl = (e, send) => `async (page) => {
  const E = ${JSON.stringify(e)}, SEND = ${send}, PDF = ${JSON.stringify(PDF)};
  await page.goto('https://mail.yahoo.com/n/compose');
  await page.waitForTimeout(3000);
  if (/login\\.yahoo\\.com/.test(page.url())) return JSON.stringify({ id: E.id, mode: 'LOGIN-NEEDED' });
  const to = page.locator('#message-to-field');
  await to.waitFor({ timeout: 30000 });
  await to.click(); await to.fill(E.to); await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill(E.subject);
  const body = page.getByRole('textbox', { name: 'Message body', exact: true });
  await body.click();
  const lines = E.body.split('\\n');
  for (let i = 0; i < lines.length; i++) { if (lines[i]) await page.keyboard.insertText(lines[i]); if (i < lines.length - 1) await page.keyboard.press('Enter'); }
  await page.locator('input[type=file]').first().setInputFiles(PDF);
  await page.getByText('Berk_Kaldar_Resume_Student_Support', { exact: false }).first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const typed = (await body.innerText()).replace(/\\s+/g, ' ').trim();
  const want = E.body.replace(/\\s+/g, ' ').trim();
  const html = await page.content();
  const check = { toOk: html.toLowerCase().includes(E.to.toLowerCase()), bodyOk: typed === want, attachOk: html.includes('Berk_Kaldar_Resume_Student_Support') };
  if (!SEND) return JSON.stringify({ id: E.id, mode: 'dry', ...check, typedLen: typed.length, wantLen: want.length });
  if (!check.toOk || !check.bodyOk || !check.attachOk) return JSON.stringify({ id: E.id, mode: 'STOPPED-before-send', ...check });
  await page.getByRole('button', { name: 'Send this email' }).click();
  await page.waitForTimeout(8000);
  await page.goto('https://mail.yahoo.com/n/folders/2');
  await page.waitForTimeout(7000);
  const sent = await page.locator('body').innerText();
  const inSent = sent.includes(E.subject) && sent.toLowerCase().includes(E.to.toLowerCase().split('@')[0]);
  return JSON.stringify({ id: E.id, mode: 'send', to: E.to, subject: E.subject, inSent, at: new Date().toISOString() });
}
`;

function buildBatch(N) {
  const md = fs.readFileSync(`${OUT}/batch${N}-emails.md`, 'utf8');
  const pre = N === 1 ? '' : `b${N}-`;
  const common = md.split('**[COMMON BLOCK]** below.')[1].split('\n---')[0]
    .split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n').trim();
  assert(common.includes('Ankara, Turkey') && common.endsWith('linkedin.com/in/berkaldar'), `batch${N}: common block`);
  const unitPart = md.split('## HR e-mails')[0];
  const units = unitPart.split(/\n## (?=\d+\. )/).slice(1).map((s, i) => {
    const n = Number(s.match(/^(\d+)\./)[1]);
    const row = N === 1 ? ROWS1[i] : (s.match(/\*\*Row:\*\* (us-[a-z0-9-]+)/) || [])[1];
    assert(row, `batch${N} #${n}: missing **Row:** us-<slug>`);
    // batch 2+ puts the **Row:** line right after Subject; it is metadata, not e-mail text
    const intro = s.split(/\*\*Subject:\*\*.+\n/)[1].replace(/^\s*\*\*Row:\*\*.*\n/, '').split('[COMMON BLOCK]')[0].trim();
    return { id: pre + 'u' + n, n, row, to: s.match(/\*\*To:\*\* (\S+)/)[1], subject: s.match(/\*\*Subject:\*\* (.+)/)[1].trim(),
      body: intro + '\n\n' + common, check: (s.match(/\*Check(?: before sending)?:\* (https:\/\/\S+)/) || [])[1] };
  });
  assert(units.length >= 1, `batch${N}: no unit e-mails`);
  if (N === 1) assert.strictEqual(units.length, 12, 'batch1 has 12 unit e-mails');
  for (const e of units) {
    // casual US tone (Berk, 20 Nov): "Hi <first name>," then a personal opening line
    assert(/^Hi [^\n]+,\n\n[^\n]{40,}/.test(e.body) && !/^Dear /m.test(e.body), 'greeting ' + e.id);
    assert(!FORBIDDEN.test(e.body + e.subject), 'forbidden text ' + e.id);
    assert(/^[\w.+-]+@[\w.-]+\.edu$/i.test(e.to), 'address ' + e.id);
    assert(e.check, 'check link ' + e.id);
  }
  const hrPart = md.split('## HR e-mails')[1].split('## Before sending')[0];
  const hrSubjectTpl = hrPart.match(/\*\*Subject:\*\* (.+)/)[1].trim();
  const bullets = common.split('\n').filter((l) => l.startsWith('- ')).join('\n');
  assert.strictEqual(bullets.split('\n').length, 5, 'five bullets');
  const hrBodyTpl = hrPart.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n').trim()
    .replace('A quick bit about me: [the same five bullets as the COMMON BLOCK]', 'A quick bit about me:\n' + bullets);
  assert(!hrBodyTpl.includes('COMMON BLOCK') && hrBodyTpl.startsWith('Hi there,'), 'hr template');
  const hr = hrPart.split('\n').filter((l) => /^\| \d+ \|/.test(l)).map((l) => {
    const c = l.split('|').map((x) => x.trim());
    const to = (c[4].match(/[\w.+-]+@[\w.-]+\.edu/i) || [])[0];
    if (!to) return null;
    const n = Number(c[1]), uni = c[2], unit = units.find((u) => u.n === n);
    assert(unit, `batch${N} HR #${n} has no unit e-mail`);
    return { id: pre + 'h' + n, n, row: unit.row, to, check: 'https://' + c[5].split(',')[0].trim().replace(/^https?:\/\//, ''),
      subject: hrSubjectTpl.replace('{{university}}', uni),
      body: hrBodyTpl.split('{{university}}').join(/^University/.test(uni) ? 'the ' + uni : uni).split('{{unit}}').join(c[3]) };
  }).filter(Boolean);
  if (N === 1) assert.strictEqual(hr.length, 11, 'batch1 has 11 HR e-mails');
  for (const h of hr) assert(!FORBIDDEN.test(h.body + h.subject), 'hr text ' + h.id);
  return [...units.map((e) => ({ ...e, kind: 'unit' })), ...hr.map((h) => ({ ...h, kind: 'hr' }))].map((e) => ({ ...e, batch: N }));
}

const batches = fs.readdirSync(OUT).map((f) => (f.match(/^batch(\d+)-emails\.md$/) || [])[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
const all = batches.flatMap(buildBatch);
assert.strictEqual(new Set(all.map((e) => e.id)).size, all.length, 'duplicate ids');
const QF = path.join(WORK, 'us-outreach-queue.json');
const old = fs.existsSync(QF) ? Object.fromEntries(JSON.parse(fs.readFileSync(QF, 'utf8')).map((q) => [q.id, q])) : {};
// never e-mail the same address twice across batches
const seen = new Map();
for (const e of all) { assert(!seen.has(e.to.toLowerCase()) || seen.get(e.to.toLowerCase()) === e.id, `address ${e.to} in both ${seen.get(e.to.toLowerCase())} and ${e.id}`); seen.set(e.to.toLowerCase(), e.id); }
for (const e of all) {
  fs.writeFileSync(path.join(WORK, `us-dry-${e.id}.js`), tpl(e, false));
  fs.writeFileSync(path.join(WORK, `us-send-${e.id}.js`), tpl(e, true));
}
// unit e-mails of each batch first, then its HR e-mails; batches in order
const queue = batches.flatMap((N) => [...all.filter((e) => e.batch === N && e.kind === 'unit'), ...all.filter((e) => e.batch === N && e.kind === 'hr')])
  .map(({ id, batch, kind, row, to, subject, check }) => ({ id, batch, kind, row, to, subject, run: `us-send-${id}.js`, check,
    status: old[id]?.status || 'pending', sentAt: old[id]?.sentAt || null, sentTs: old[id]?.sentTs || null }));
fs.writeFileSync(QF, JSON.stringify(queue, null, 1));
console.log(JSON.stringify({ batches, total: queue.length, pending: queue.filter((q) => q.status === 'pending').length,
  newRows: [...new Set(queue.filter((q) => q.batch > 1).map((q) => q.row))] }));
