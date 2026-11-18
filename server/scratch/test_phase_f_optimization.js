require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');
const jwt = require('jsonwebtoken');

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
  console.log('=== STARTING PHASE F OPTIMIZATION & AGGREGATE TESTS ===\n');

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
    const secret = process.env.JWT_SECRET || 'carepulse_hms_jwt_secret_key_2026';
    const adminToken = jwt.sign({ id: 'admin-opt', role: 'ADMIN', name: 'Admin Optimizer' }, secret, { expiresIn: '1h' });

    // -------------------------------------------------------------
    // Item 38: Dashboard Aggregates (Speed & Correctness)
    // -------------------------------------------------------------
    console.log('--- Testing Item 38: Dashboard Aggregates ---');
    const startAdmin = Date.now();
    const adminRes = await makeRequest({
      method: 'GET',
      path: '/api/admin/dashboard-stats',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminDuration = Date.now() - startAdmin;

    assert(adminRes.status === 200, `Admin dashboard returned 200 OK (${adminDuration}ms)`);
    assert(adminRes.body?.success === true, 'Admin dashboard response has success: true');
    assert(adminRes.body?.metrics?.todaysAppointments !== undefined, 'Admin metrics contains todaysAppointments');
    assert(adminRes.body?.charts?.weeklyTrend?.length === 7, 'Admin charts contains 7-day weekly trend');
    assert(adminDuration < 200, `Admin dashboard executed in sub-200ms (${adminDuration}ms)`);

    const startFd = Date.now();
    const fdRes = await makeRequest({
      method: 'GET',
      path: '/api/frontdesk/stats',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const fdDuration = Date.now() - startFd;

    assert(fdRes.status === 200, `Front desk stats returned 200 OK (${fdDuration}ms)`);
    assert(fdRes.body?.success === true, 'Front desk stats has success: true');
    assert(fdRes.body?.stats?.totalPatients !== undefined, 'Front desk stats has totalPatients');
    assert(fdDuration < 200, `Front desk stats executed in sub-200ms (${fdDuration}ms)`);

    // -------------------------------------------------------------
    // Item 39: Separate Statistics Endpoints
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 39: Separate Statistics Endpoints ---');
    const accountantRes = await makeRequest({
      method: 'GET',
      path: '/api/billing/accountant-dashboard',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(accountantRes.status === 200, 'Accountant dashboard stats returned 200 OK');
    assert(accountantRes.body?.success === true, 'Accountant dashboard stats success: true');

    const expenseRes = await makeRequest({
      method: 'GET',
      path: '/api/expenses/stats',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(expenseRes.status === 200, 'Expense statistics endpoint returned 200 OK');
    assert(expenseRes.body?.stats?.categories !== undefined, 'Expense stats includes category breakdowns');

    // -------------------------------------------------------------
    // Item 40: Database Indexes Verification
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 40: Database Indexes Verification ---');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const indexNames = new Set(indexes.map(i => i.indexname));

    assert(indexNames.has('pharmacy_medicines_name_idx'), 'Index pharmacy_medicines_name_idx exists in PostgreSQL');
    assert(indexNames.has('pharmacy_medicines_category_idx'), 'Index pharmacy_medicines_category_idx exists in PostgreSQL');
    assert(indexNames.has('nursery_admissions_admissionNo_idx'), 'Index nursery_admissions_admissionNo_idx exists in PostgreSQL');
    assert(indexNames.has('audit_logs_action_idx'), 'Index audit_logs_action_idx exists in PostgreSQL');
    assert(indexNames.has('audit_logs_entity_idx'), 'Index audit_logs_entity_idx exists in PostgreSQL');

    // -------------------------------------------------------------
    // Item 42: Additional Analytics Optimization
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 42: Additional Analytics Optimization ---');
    const startParallel = Date.now();
    const [pCount, aCount, iAgg] = await Promise.all([
      prisma.patient.count({ where: { isArchived: false } }),
      prisma.appointment.count({ where: { isArchived: false } }),
      prisma.invoice.aggregate({ where: { isVoided: false }, _sum: { paidAmount: true } })
    ]);
    const parallelDuration = Date.now() - startParallel;

    assert(typeof pCount === 'number', `Parallel Patient Count = ${pCount}`);
    assert(typeof aCount === 'number', `Parallel Appointment Count = ${aCount}`);
    assert(typeof (iAgg._sum.paidAmount || 0) === 'number', `Parallel Revenue Aggregate = ${iAgg._sum.paidAmount || 0}`);
    assert(parallelDuration < 150, `Parallel database aggregates completed in sub-150ms (${parallelDuration}ms)`);

    console.log(`\n=== PHASE F TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
