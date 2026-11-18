require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

async function makeRequest({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING PHASE E SERVER & SECURITY TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';

    // -------------------------------------------------------------
    // Item 31: CORS Verification
    // -------------------------------------------------------------
    console.log('--- Testing Item 31: CORS Configuration ---');
    // Allowed origin
    const corsAllowed = await makeRequest({
      method: 'OPTIONS',
      path: '/api/health',
      headers: { 'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'GET' }
    });
    assert(corsAllowed.headers['access-control-allow-origin'] === 'http://localhost:3000', 'CORS allows http://localhost:3000');

    // Untrusted origin
    const corsBlocked = await makeRequest({
      method: 'GET',
      path: '/api/health',
      headers: { 'Origin': 'http://malicious-external-site.evil' }
    });
    assert(corsBlocked.status === 403, `CORS rejected untrusted origin (Status ${corsBlocked.status})`);

    // -------------------------------------------------------------
    // Item 32: Authentication
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 32: Authentication Enforcement ---');
    // Request without token to protected route
    const noTokenRes = await makeRequest({
      method: 'GET',
      path: '/api/billing/invoices'
    });
    assert(noTokenRes.status === 401, `Protected route rejected request without token (Status ${noTokenRes.status})`);

    // Request with invalid token
    const invalidTokenRes = await makeRequest({
      method: 'GET',
      path: '/api/billing/invoices',
      headers: { 'Authorization': 'Bearer completely-invalid-jwt-token' }
    });
    assert(invalidTokenRes.status === 403, `Protected route rejected invalid token (Status ${invalidTokenRes.status})`);

    // Request with expired token
    const expiredToken = jwt.sign({ id: 'dummy', role: 'STAFF' }, secret, { expiresIn: -10 });
    const expiredRes = await makeRequest({
      method: 'GET',
      path: '/api/billing/invoices',
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    assert(expiredRes.status === 401, `Protected route caught expired token (Status ${expiredRes.status})`);

    // -------------------------------------------------------------
    // Item 33: Authorization (RBAC)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 33: Authorization (RBAC) ---');
    const staffToken = jwt.sign({ id: 'staff-user', role: 'STAFF' }, secret, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: 'admin-user', role: 'ADMIN' }, secret, { expiresIn: '1h' });

    // STAFF trying to access ADMIN-only backup route
    const rbacStaffRes = await makeRequest({
      method: 'GET',
      path: '/api/backup/summary',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert(rbacStaffRes.status === 403, `RBAC blocked non-admin from /api/backup/summary (Status ${rbacStaffRes.status})`);

    // ADMIN accessing ADMIN-only backup route
    const rbacAdminRes = await makeRequest({
      method: 'GET',
      path: '/api/backup/summary',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(rbacAdminRes.status === 200, `RBAC allowed ADMIN access to /api/backup/summary (Status ${rbacAdminRes.status})`);

    // -------------------------------------------------------------
    // Item 34: Backup Route Protection
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 34: Backup Route Protection ---');
    const backupUnauth = await makeRequest({
      method: 'GET',
      path: '/api/backup/summary'
    });
    assert(backupUnauth.status === 401, `Unauthenticated call to /api/backup/summary rejected with 401 (Status ${backupUnauth.status})`);

    // -------------------------------------------------------------
    // Item 35: Print Route Protection
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 35: Print Route Protection ---');
    const printUnauth = await makeRequest({
      method: 'GET',
      path: '/api/print/status'
    });
    assert(printUnauth.status === 401, `Unauthenticated call to /api/print/status rejected with 401 (Status ${printUnauth.status})`);

    const printAuth = await makeRequest({
      method: 'GET',
      path: '/api/print/status',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(printAuth.status === 200, `Authenticated print route access succeeds (Status ${printAuth.status})`);

    // -------------------------------------------------------------
    // Item 37: Centralized Error Handling
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 37: Error Handling (Malformed JSON) ---');
    // Send malformed JSON body
    const malformedJsonRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json: true '
    });
    assert(malformedJsonRes.status === 400, `Global error handler caught malformed JSON payload (Status ${malformedJsonRes.status})`);

    console.log(`\n=== PHASE E TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTests();
