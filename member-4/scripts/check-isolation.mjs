// Run only with two disposable, confirmed test accounts in your development project.
// Secrets stay in a local ignored .env.test; this script never prints credentials/tokens.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
process.loadEnvFile('.env.test');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials = ['A', 'B'].map(label => ({ email: process.env[`TEST_USER_${label}_EMAIL`], password: process.env[`TEST_USER_${label}_PASSWORD`] }));
assert(credentials.every(value => value.email && value.password), 'Set both test accounts in .env.test');
const clients = credentials.map(() => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
let created;
try {
  const users = [];
  const jars = [];
  for (let index = 0; index < 2; index++) {
    const { data, error } = await clients[index].auth.signInWithPassword(credentials[index]);
    assert(!error && data.user, `Test user ${index + 1} must be confirmed and able to sign in`);
    users.push(data.user.id);
    const response = await fetch(`${base}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signin', ...credentials[index] }) });
    assert.equal(response.status, 200, 'API sign-in failed');
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert(cookie, 'Expected session cookies');
    jars.push(cookie);
  }
  assert.notEqual(users[0], users[1], 'Use two different accounts');
  const headers = { 'Content-Type': 'application/json', Cookie: jars[0] };
  for (const body of [{ name: ' ', type: 'Home', city: 'Amman' }, { name: 'Test', type: 'Home', city: 'Amman', user_id: users[1] }]) {
    const invalid = await fetch(`${base}/api/business`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(invalid.status, 400, 'Invalid or client-owned identity must be rejected');
  }
  const response = await fetch(`${base}/api/business`, { method: 'POST', headers, body: JSON.stringify({ name: `Isolation test ${Date.now()}`, type: 'Test', city: 'Amman' }) });
  assert.equal(response.status, 201, 'Owner insert failed; check migration');
  created = (await response.json()).data.id;
  const own = await clients[0].from('businesses').select('id,user_id').eq('id', created).single();
  assert(!own.error && own.data.user_id === users[0], 'Stored owner must equal authenticated user');
  const ownList = await fetch(`${base}/api/business`, { headers: { Cookie: jars[0] } });
  assert.equal(ownList.status, 200);
  assert((await ownList.json()).data.some(row => row.id === created), 'Owner API read failed');
  const otherList = await fetch(`${base}/api/business`, { headers: { Cookie: jars[1] } });
  assert.equal(otherList.status, 200);
  assert(!(await otherList.json()).data.some(row => row.id === created), 'Other user must not see owner row through API');
  const hidden = await clients[1].from('businesses').select('id').eq('id', created);
  assert(!hidden.error && hidden.data.length === 0, 'RLS must hide row even without Next.js');
  const spoof = await clients[1].from('businesses').insert({ name: 'Spoof test', type: 'Test', city: 'Amman', user_id: users[0] }).select('id');
  if (!spoof.error && spoof.data?.length) {
    await clients[0].from('businesses').delete().eq('id', spoof.data[0].id);
    throw new Error('RLS allowed forged ownership');
  }
  assert(spoof.error, 'RLS must reject forged ownership');
  const update = await clients[1].from('businesses').update({ name: 'Unauthorized' }).eq('id', created).select('id');
  assert(update.error || update.data.length === 0, 'Cross-user update must be blocked');
  const remove = await clients[1].from('businesses').delete().eq('id', created).select('id');
  assert(remove.error || remove.data.length === 0, 'Cross-user delete must be blocked');
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  const anonRead = await anonymous.from('businesses').select('id').eq('id', created);
  assert(anonRead.error || anonRead.data.length === 0, 'Anonymous direct reads must be blocked');
  const anonInsert = await anonymous.from('businesses').insert({ name: 'Anon', type: 'Test', city: 'Amman', user_id: users[0] });
  assert(anonInsert.error, 'Anonymous direct insert must be blocked');
  console.log('PASS: owner creation/read, server validation, and direct cross-user/anonymous RLS isolation');
} finally {
  if (created) {
    const { error } = await clients[0].from('businesses').delete().eq('id', created);
    if (error) console.error('Test-row cleanup failed; remove the isolation test row in Supabase.');
  }
  await Promise.all(clients.map(client => client.auth.signOut({ scope: 'local' })));
}
