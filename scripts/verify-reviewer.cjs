// Live release diagnostic: authenticate the existing reviewer and verify access.
// Never logs credentials/tokens and never changes the reviewer password/profile.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const provisioning = fs.readFileSync(path.join(root, 'functions/create-review-account.js'), 'utf8');
const environment = fs.readFileSync(path.join(root, 'src/environments/environment.prod.ts'), 'utf8');
const email = provisioning.match(/const EMAIL = '([^']+)'/)[1];
const password = provisioning.match(/const PASSWORD = '([^']+)'/)[1];
const apiKey = environment.match(/apiKey:\s*["']([^"']+)["']/)[1];

(async () => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!response.headers.get('content-type')?.includes('json')) throw new Error(`Reviewer login endpoint returned HTTP ${response.status}, not JSON.`);
  const login = await response.json();
  if (!response.ok || !login.idToken) throw new Error('Existing reviewer login failed; credentials need owner verification.');
  const verified = await fetch('https://us-central1-regen28-2fe51.cloudfunctions.net/updateUserSubscriptionStatus', {
    method: 'POST', headers: { Authorization: `Bearer ${login.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} })
  });
  if (!verified.headers.get('content-type')?.includes('json')) throw new Error(`Billing callable returned HTTP ${verified.status}, not JSON.`);
  const result = await verified.json();
  if (!verified.ok || result.result?.active !== true) throw new Error('Reviewer server access verification failed.');
  console.log('Existing reviewer login and deployed billing access: PASS');
  // Guard-only requests: no AI generation and no account deletion are performed.
  for (const [name, data, expected] of [
    ['deleteUserAccount', { confirm: false }, 'INVALID_ARGUMENT'],
    ['getDailyJournalPrompt', {}, 'FAILED_PRECONDITION']
  ]) {
    const guarded = await fetch(`https://us-central1-regen28-2fe51.cloudfunctions.net/${name}`, {
      method: 'POST', headers: { Authorization: `Bearer ${login.idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    if (!guarded.headers.get('content-type')?.includes('json')) throw new Error(`${name} did not reach the authenticated handler.`);
    const body = await guarded.json();
    if (body.error?.status !== expected) throw new Error(`${name} guard returned an unexpected result.`);
    console.log(`${name} authenticated safety guard: PASS`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
