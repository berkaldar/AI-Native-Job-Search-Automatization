// US outreach send step (Berk, 20 Nov): the rules live here, so a scheduled run cannot get them wrong.
//   node --use-system-ca us-outreach-step.cjs next [--now <ISO>] [--anytime]   -> JSON: {action:"send",item} | {action:"skip",reason} | {action:"done"}
//   node us-outreach-step.cjs mark <id> '<run-file result JSON>'   -> updates queue + log, prints the dashboard patch
//   node us-outreach-step.cjs stop "<reason>"                       -> blocks sending for the rest of the day
//   node us-outreach-step.cjs selftest
// Pacing: Mon-Fri 16:00-21:00 Ankara, max 10 a day, 25+ minutes apart, one e-mail per university per day,
// HR e-mail only on a later day than that university's student support e-mail.
const fs = require('fs'), path = require('path'), assert = require('assert');
const DIR = __dirname;
const QF = path.join(DIR, 'us-outreach-queue.json'), LOG = path.join(DIR, 'us-outreach-log.txt');
const CAP = 10, GAP_MIN = 25, START_H = 16, END_H = 21;

const ankara = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, wd: p.weekday };
};
const readQ = () => JSON.parse(fs.readFileSync(QF, 'utf8'));
const writeQ = (q) => fs.writeFileSync(QF, JSON.stringify(q, null, 1));
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '');
const log = (line) => fs.appendFileSync(LOG, new Date().toISOString() + ' ' + line + '\n');

function gate(q, logText, now, anytime = false) {
  const a = ankara(now);
  if (['Sat', 'Sun'].includes(a.wd)) return { action: 'skip', reason: 'weekend' };
  // --anytime: Berk's manual early send (20 Nov); every other rule still applies
  if (!anytime && (a.hour < START_H || a.hour >= END_H)) return { action: 'skip', reason: `outside ${START_H}:00-${END_H}:00 Ankara (now ${a.hour}h)` };
  if (logText.split('\n').some((l) => l.includes(' STOP ') && ankara(new Date(l.slice(0, 24))).date === a.date)) return { action: 'skip', reason: 'STOP logged today: needs Berk or a fix' };
  const sentToday = q.filter((x) => x.sentAt === a.date);
  if (sentToday.length >= CAP) return { action: 'skip', reason: `daily cap ${CAP} reached` };
  const last = Math.max(0, ...q.filter((x) => x.sentTs).map((x) => Date.parse(x.sentTs)));
  if (last && now - last < GAP_MIN * 60000) return { action: 'skip', reason: `last send ${Math.round((now - last) / 60000)} min ago (< ${GAP_MIN})` };
  const rowsToday = new Set(sentToday.map((x) => x.row));
  const item = q.find((x) => {
    if (x.status !== 'pending' || rowsToday.has(x.row)) return false;
    if (x.kind !== 'hr') return true;
    const unit = q.find((u) => u.kind === 'unit' && u.row === x.row && u.batch === x.batch);
    return unit && unit.status === 'sent' && unit.sentAt < a.date;
  });
  if (!item) return q.some((x) => x.status === 'pending') ? { action: 'skip', reason: 'nothing eligible today (HR e-mails wait a day)' } : { action: 'done' };
  return { action: 'send', item };
}

async function addressOnPage(item) {
  try {
    const r = await fetch(item.check, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    const html = (await r.text()).toLowerCase();
    return html.includes(item.to.toLowerCase()) ? 'found' : r.ok ? 'missing' : 'fetch-failed';
  } catch (e) { return 'fetch-failed'; }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'next') {
    const i = args.indexOf('--now');
    const now = i >= 0 ? new Date(args[i + 1]) : new Date();
    const g = gate(readQ(), readLog(), now.getTime(), args.includes('--anytime'));
    if (g.action === 'send') {
      g.addressCheck = await addressOnPage(g.item);
      if (g.addressCheck === 'missing') {
        const q = readQ(); q.find((x) => x.id === g.item.id).status = 'skipped-address-gone'; writeQ(q);
        log(`SKIP ${g.item.id} ${g.item.to} address no longer on ${g.item.check}`);
        return console.log(JSON.stringify({ action: 'skip', reason: 'address gone from source page; item skipped', id: g.item.id }));
      }
      g.runFile = path.join(DIR, g.item.run);
    }
    return console.log(JSON.stringify(g));
  }
  if (cmd === 'mark') {
    const [id, raw] = args;
    const r = JSON.parse(raw);
    const q = readQ(); const it = q.find((x) => x.id === id);
    assert(it, 'unknown id ' + id);
    assert.strictEqual(it.status, 'pending', `${id} is ${it.status}, not pending`);
    const now = new Date(), d = ankara(now).date;
    let patch = null;
    if (r.mode === 'send' && r.inSent) {
      Object.assign(it, { status: 'sent', sentAt: d, sentTs: now.toISOString() });
      patch = it.kind === 'unit'
        ? { applied: true, appliedAt: d, unitSentAt: d, outcome: 'waiting', pipe: { __delete__: true }, noteAdd: `Student support e-mail sent ${d} to ${it.to}.` }
        : { hrSentAt: d, noteAdd: `HR e-mail sent ${d} to ${it.to}.` };
      log(`SENT ${id} ${it.to} | ${it.subject}`);
    } else if (r.mode === 'send') {
      it.status = 'check-sent-folder';
      log(`STOP ${id} send clicked but not found in Sent: Berk must check the Sent folder; never resend`);
    } else {
      log(`STOP ${id} ${r.mode || 'error'} ${JSON.stringify(r)}: compose checks failed, nothing sent; needs a fix`);
    }
    writeQ(q);
    const sentToday = q.filter((x) => x.sentAt === d).length;
    const totals = { unitSent: q.filter((x) => x.kind === 'unit' && x.status === 'sent').length, unitAll: q.filter((x) => x.kind === 'unit').length,
      hrSent: q.filter((x) => x.kind === 'hr' && x.status === 'sent').length, hrAll: q.filter((x) => x.kind === 'hr').length, pending: q.filter((x) => x.status === 'pending').length };
    return console.log(JSON.stringify({ id, row: it.row, kind: it.kind, status: it.status, patch, sentToday, cap: CAP, totals }));
  }
  if (cmd === 'stop') { log('STOP ' + args.join(' ')); return console.log('stopped for today'); }
  if (cmd === 'selftest') return selftest();
  console.log('usage: next | mark <id> <json> | stop <reason> | selftest');
}

function selftest() {
  const q = [
    { id: 'u1', batch: 1, kind: 'unit', row: 'a', status: 'sent', sentAt: '2026-11-20', sentTs: '2026-11-20T13:00:00Z' },
    { id: 'u2', batch: 1, kind: 'unit', row: 'b', status: 'pending' },
    { id: 'h1', batch: 1, kind: 'hr', row: 'a', status: 'pending' },
    { id: 'h2', batch: 1, kind: 'hr', row: 'b', status: 'pending' },
  ];
  const t = (iso, ql = q, lg = '') => gate(ql, lg, Date.parse(iso));
  assert.strictEqual(t('2026-11-21T14:00:00Z').reason, 'weekend');
  assert.match(t('2026-11-20T12:00:00Z').reason, /outside/); // 15:00 Ankara
  assert.strictEqual(gate(q, '', Date.parse('2026-11-23T08:00:00Z'), true).item.id, 'u2'); // Monday 11:00 Ankara: --anytime skips only the hour window
  assert.match(t('2026-11-20T13:10:00Z').reason, /min ago/); // 16:10, 10 min after u1
  assert.strictEqual(t('2026-11-20T13:40:00Z').item.id, 'u2'); // h1 waits: same day as u1
  assert.strictEqual(t('2026-11-23T13:40:00Z').item.id, 'u2'); // Monday: unit first
  const q2 = q.map((x) => (x.id === 'u2' ? { ...x, status: 'sent', sentAt: '2026-11-23', sentTs: '2026-11-23T13:00:00Z' } : x));
  assert.strictEqual(t('2026-11-23T13:40:00Z', q2).item.id, 'h1'); // a's unit went Friday
  assert.match(t('2026-11-20T13:40:00Z', q, '2026-11-20T13:30:00.000Z STOP x\n').reason, /STOP/);
  const full = Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, kind: 'unit', row: 'r' + i, status: 'sent', sentAt: '2026-11-20', sentTs: '2026-11-20T10:00:00Z' }));
  assert.match(t('2026-11-20T17:00:00Z', [...full, ...q]).reason, /cap/);
  assert.strictEqual(t('2026-11-20T17:00:00Z', [q[0]]).action, 'done');
  console.log('selftest ok');
}
main();
