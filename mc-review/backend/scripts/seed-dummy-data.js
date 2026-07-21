/**
 * Dummy-data seeder for local dev/demo.
 *
 * Drives the app through its own HTTP API (not raw SQL) so the seeded
 * data is guaranteed workflow-valid: a few draft/submitted Page-1 entries,
 * one sheet taken all the way through lock -> decide -> publish, and a
 * couple of generated order numbers.
 *
 * Usage (backend must already be running on PORT from .env, default 5094):
 *   node scripts/seed-dummy-data.js
 */
const axios = require('axios');

const BASE = process.env.SEED_API_BASE || 'http://localhost:5094/api';
const TODAY = new Date().toISOString().slice(0, 10);

function client(role, userId) {
  return axios.create({
    baseURL: BASE,
    headers: { 'x-user-role': role, 'x-user-id': userId },
  });
}

const user = client('user', 'dhruv');
const revMEP = client('revMEP', 'rverma');
const revCIV = client('revCIV', 'sanand');
const admin = client('admin', 'akhilesh');

async function main() {
  console.log(`Seeding against ${BASE} for review date ${TODAY} ...`);

  // --- Page 1: fetch a handful of NFAs as plain drafts (left untouched) ---
  const draftNfas = ['14355', '14352'];
  for (const nfa of draftNfas) {
    const res = await user.post('/entries/fetch', { nfa, index: 'MEP', wt: 'A', date: TODAY });
    console.log(`  draft: fetched ${nfa} ->`, res.data.created ? 'created' : Object.keys(res.data)[0]);
  }

  // --- A couple more, selected + submitted to Page 2 (MEP) ---
  const mepSubmit = ['14315', '14306', '14331'];
  const mepEntryIds = [];
  for (const nfa of mepSubmit) {
    const res = await user.post('/entries/fetch', { nfa, index: 'MEP', wt: 'A', date: TODAY });
    const id = res.data.entry.id;
    mepEntryIds.push({ nfa, id });
    await user.post(`/entries/${id}/select`, { selected: true });
    await user.post(`/entries/${id}/submit`, {});
    console.log(`  MEP: ${nfa} submitted to Page 2 (${TODAY})`);
  }

  // --- One CIVIL entry too, so the Civil reviewer has something to see ---
  const civRes = await user.post('/entries/fetch', { nfa: '14350', index: 'CIVIL', wt: 'A', date: TODAY });
  const civId = civRes.data.entry.id;
  await user.post(`/entries/${civId}/select`, { selected: true });
  await user.post(`/entries/${civId}/submit`, {});
  console.log(`  CIVIL: 14350 submitted to Page 2 (${TODAY})`);

  // --- Page 2 (MEP reviewer): mark all three "present to MC", then lock ---
  const sheetBefore = await revMEP.get(`/sheets/MEP/${TODAY}`);
  for (const e of sheetBefore.data.entries) {
    await revMEP.post(`/sheets/MEP/${TODAY}/entries/${e.id}/mc`, { mc: true });
  }
  const lockRes = await revMEP.post(`/sheets/MEP/${TODAY}/lock`);
  console.log(`  MEP sheet locked -> v${lockRes.data.version}`);

  // --- Page 3 (MEP): decide two approved, one held, then publish ---
  const meeting = await revMEP.get(`/meeting/MEP/${TODAY}`);
  const rows = meeting.data.rows;
  if (rows[0]) await revMEP.post(`/meeting/MEP/${TODAY}/rows/${rows[0].id}/decision`, { decision: 'approved' });
  if (rows[1]) await revMEP.post(`/meeting/MEP/${TODAY}/rows/${rows[1].id}/decision`, { decision: 'approved' });
  if (rows[2]) await revMEP.post(`/meeting/MEP/${TODAY}/rows/${rows[2].id}/decision`, { decision: 'hold' });
  if (rows[0]) await revMEP.post(`/meeting/MEP/${TODAY}/rows/${rows[0].id}/comment`, { comment: 'Approved as recommended by site team.' });

  const pubRes = await revMEP.post(`/meeting/MEP/${TODAY}/publish`, {});
  console.log(`  MEP published: ${pubRes.data.decidedCount} decided, ${pubRes.data.undecidedCount} expired`);

  // --- Page 4: generate order numbers for the approved NFAs ---
  const approvedNfas = mepSubmit.slice(0, 2); // 14315, 14306 were set to 'approved' above
  for (const nfa of approvedNfas) {
    const genRes = await admin.post('/orders/generate', { nfa, index: 'MEP', count: 1, orderType: 'PO' });
    console.log(`  order generated for ${nfa}:`, genRes.data.created?.[0]);
  }

  console.log('\nDone. Open http://localhost:94 and switch roles to explore:');
  console.log(`  - Page 1 (User): drafts for 14355 / 14352, approved/held rows for the rest`);
  console.log(`  - Page 2 (Reviewer-MEP): sheet for ${TODAY} — already locked/published`);
  console.log(`  - Page 2 (Reviewer-Civil): sheet for ${TODAY} — one NFA (14350), not yet locked`);
  console.log(`  - Page 3 (Reviewer-MEP): published decisions for ${TODAY}`);
  console.log(`  - Page 4 (Admin): order numbers generated for the approved NFAs`);
  console.log(`  - Page 1 > Published PDFs tab: MEP / ${TODAY} PDF ready to open`);
}

main().catch((e) => {
  console.error('Seed failed:', e.response?.data || e.message);
  process.exit(1);
});
