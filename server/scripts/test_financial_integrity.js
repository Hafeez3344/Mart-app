/**
 * Automated Financial-Integrity Test Suite
 * Covers:
 * 1. Partial payments & department atomicity
 * 2. Full dues settlement & master concessions
 * 3. Overpayment rejection (rejects amounts exceeding eligible dues)
 * 4. Excessive discount rejection (rejects concession > eligible dues)
 * 5. Duplicate-request protection (database-enforced idempotency replay)
 * 6. Refund accounting & trace to originalTxId
 * 7. Simultaneous cashiers settling the same patient (concurrency race test)
 * 8. Ledger vs department reconciliation
 */

const prisma = require('../src/config/prisma');
const { settlePatientDues, getPatientMasterBill } = require('../src/controllers/patientController');
const { refundPatient } = require('../src/controllers/billingController');

let realUser = null;

// Test Helper: Mock Express Request/Response
function createMockReqRes({ params = {}, body = {}, user = null, headers = {} } = {}) {
  const req = {
    params,
    body,
    user: user || (realUser ? { id: realUser.id, name: realUser.name || 'Admin Audit', role: realUser.role || 'ADMIN' } : null),
    headers
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 Starting HMS Financial Integrity & Ledger Test Suite');
  console.log('===============================================================\n');

  realUser = await prisma.user.findFirst();

  // Find or create a dedicated test doctor and patient
  let testDoctor = await prisma.doctor.findFirst({
    include: { user: true }
  });

  if (!testDoctor) {
    const user = await prisma.user.findFirst();
    testDoctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        specialization: 'General Medicine',
        consultationFee: 1000
      },
      include: { user: true }
    });
  }

  // Generate unique MRN for test isolation
  const testMrn = `TEST-${Date.now().toString().slice(-6)}`;
  const patient = await prisma.patient.create({
    data: {
      name: `FinTest Patient ${testMrn}`,
      mrn: testMrn,
      phone: '03001234567',
      gender: 'Male',
      age: 30
    }
  });

  console.log(`Created isolated test patient: ${patient.name} (${patient.mrn})`);

  try {
    // -------------------------------------------------------------
    // Test 1: Partial Payment & Department Balance Atomicity
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Partial Payment Allocation ---');
    const appt1 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: testDoctor.id,
        appointmentNo: `APT-${Date.now().toString().slice(-6)}-1`,
        date: new Date(),
        time: '10:00 AM',
        consultationFee: 1000,
        paidAmount: 0,
        discountAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'SCHEDULED'
      }
    });

    const m1 = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 400,
        discountAmount: 0,
        paymentMethod: 'Cash Payment at Desk'
      }
    });

    await settlePatientDues(m1.req, m1.res);
    assert(m1.getStatus() === 200, 'Partial payment returns HTTP 200');
    assert(m1.getData()?.collectedAmount === 400, 'Collected amount matches 400');
    assert(m1.getData()?.paymentTransactions?.length === 1, 'Exactly 1 PaymentTransaction recorded');

    // Verify DB item
    const appt1After = await prisma.appointment.findUnique({ where: { id: appt1.id } });
    assert(appt1After.paidAmount === 400, 'Appointment paidAmount updated to 400');
    assert(appt1After.paymentStatus === 'PARTIAL', 'Appointment status set to PARTIAL');

    // -------------------------------------------------------------
    // Test 2: Full Settlement with Master Concession (Discount)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Full Settlement with Concession (Discount) ---');
    // Outstanding due is 600. Cashier gives 100 concession, collects 500 cash.
    const m2 = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 500,
        discountAmount: 100,
        paymentMethod: 'Cash Payment at Desk'
      }
    });

    await settlePatientDues(m2.req, m2.res);
    assert(m2.getStatus() === 200, 'Settlement with concession returns HTTP 200');
    assert(m2.getData()?.collectedAmount === 500, 'Collected cash is 500');
    assert(m2.getData()?.discountApplied === 100, 'Discount applied is 100');

    const appt1Final = await prisma.appointment.findUnique({ where: { id: appt1.id } });
    assert(appt1Final.paidAmount === 900, 'Appointment paidAmount is 900 (1000 fee - 100 disc)');
    assert(appt1Final.discountAmount === 100, 'Appointment discountAmount is 100');
    assert(appt1Final.paymentStatus === 'PAID', 'Appointment paymentStatus is PAID');

    // -------------------------------------------------------------
    // Test 3: Cash Reconciliation - Overpayment Rejection
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Overpayment Rejection (Prevent Silent Drop) ---');
    // Patient has 0 remaining balance. Attempt to collect 200.
    const m3 = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 200,
        discountAmount: 0,
        paymentMethod: 'Cash Payment at Desk'
      }
    });

    await settlePatientDues(m3.req, m3.res);
    assert(m3.getStatus() === 400, 'Overpayment rejected with HTTP 400');
    assert(m3.getData()?.message?.includes('exceeds outstanding dues'), 'Clear error message returned');

    // -------------------------------------------------------------
    // Test 4: Excessive Concession (Discount) Rejection
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Excessive Concession Rejection ---');
    // Create new appointment for 500
    const appt2 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: testDoctor.id,
        appointmentNo: `APT-${Date.now().toString().slice(-6)}-2`,
        date: new Date(),
        time: '10:00 AM',
        consultationFee: 500,
        paidAmount: 0,
        discountAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'SCHEDULED'
      }
    });

    const m4 = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 100,
        discountAmount: 800, // Due is only 500!
        paymentMethod: 'Cash Payment at Desk'
      }
    });

    await settlePatientDues(m4.req, m4.res);
    assert(m4.getStatus() === 400, 'Excessive discount rejected with HTTP 400');
    assert(m4.getData()?.message?.includes('cannot exceed total eligible outstanding dues'), 'Clear concession error returned');

    // -------------------------------------------------------------
    // Test 5: Duplicate-Request Protection (Idempotency Key Replay)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Duplicate-Request Protection (Idempotency) ---');
    const testIdempotencyKey = `IDEM-KEY-${Date.now()}`;
    const m5a = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 500,
        discountAmount: 0,
        paymentMethod: 'Cash Payment at Desk',
        idempotencyKey: testIdempotencyKey
      }
    });

    await settlePatientDues(m5a.req, m5a.res);
    assert(m5a.getStatus() === 200, 'First request with idempotency key succeeds');
    const firstReceiptNo = m5a.getData()?.receiptNo;

    // Immediately retry with identical idempotencyKey (simulating user double-clicking)
    const m5b = createMockReqRes({
      params: { id: patient.id },
      body: {
        collectedAmount: 500,
        discountAmount: 0,
        paymentMethod: 'Cash Payment at Desk',
        idempotencyKey: testIdempotencyKey
      }
    });

    await settlePatientDues(m5b.req, m5b.res);
    assert(m5b.getStatus() === 200, 'Retried request returns HTTP 200');
    assert(m5b.getData()?.isIdempotentReplay === true, 'Response flagged as isIdempotentReplay');
    assert(m5b.getData()?.receiptNo === firstReceiptNo, 'Replay returned the exact same original receipt number');

    // Verify DB count: only 1 transaction created for this payment
    const dbTxs = await prisma.paymentTransaction.findMany({
      where: { idempotencyKey: testIdempotencyKey }
    });
    assert(dbTxs.length === 1, 'Exactly 1 transaction exists in database for this idempotency key');

    // -------------------------------------------------------------
    // Test 6: Refund Accounting & Audit Linkage (originalTxId)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Refund Traceability & originalTxId Linkage ---');
    const originalTx = dbTxs[0];

    const m6 = createMockReqRes({
      body: {
        patientId: patient.id,
        appointmentId: appt2.id,
        refundAmount: 200,
        reason: 'Patient doctor consultation delayed',
        paymentMethod: 'CASH',
        cancelOrder: true
      }
    });

    await refundPatient(m6.req, m6.res);
    assert(m6.getStatus() === 200, 'Refund executes with HTTP 200');

    // Verify refund transaction in DB
    const refundTx = await prisma.paymentTransaction.findFirst({
      where: {
        patientId: patient.id,
        transactionType: 'REFUND',
        referenceId: appt2.id
      }
    });

    assert(refundTx !== null, 'Refund PaymentTransaction created in database');
    assert(refundTx.amount === 200, 'Refund amount is positive 200 with REFUND type');
    assert(refundTx.originalTxId === originalTx.id, 'Refund is linked to original payment transaction (originalTxId)');

    // Verify appointment balance reduced
    const appt2AfterRefund = await prisma.appointment.findUnique({ where: { id: appt2.id } });
    assert(appt2AfterRefund.paidAmount === 300, 'Appointment paidAmount reduced to 300 (500 - 200)');
    assert(appt2AfterRefund.paymentStatus === 'PARTIAL', 'Appointment paymentStatus updated to PARTIAL (300 retained)');

    // -------------------------------------------------------------
    // Test 7: Simultaneous Cashiers Settling Same Patient (Race Condition)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Concurrent Cashier Race Condition (Advisory Lock) ---');
    // Create an order for 1000
    const appt3 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: testDoctor.id,
        appointmentNo: `APT-${Date.now().toString().slice(-6)}-3`,
        date: new Date(),
        time: '10:00 AM',
        consultationFee: 1000,
        paidAmount: 0,
        discountAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'SCHEDULED'
      }
    });

    // Two cashiers simultaneously submit 1000 for the same patient
    const cashierA = createMockReqRes({
      params: { id: patient.id },
      body: { collectedAmount: 1000, discountAmount: 0, paymentMethod: 'Cashier A' }
    });
    const cashierB = createMockReqRes({
      params: { id: patient.id },
      body: { collectedAmount: 1000, discountAmount: 0, paymentMethod: 'Cashier B' }
    });

    // Fire concurrently
    const [resA, resB] = await Promise.allSettled([
      settlePatientDues(cashierA.req, cashierA.res),
      settlePatientDues(cashierB.req, cashierB.res)
    ]);

    const statuses = [cashierA.getStatus(), cashierB.getStatus()];
    const hasOneSuccess = statuses.includes(200);
    const hasOneRejection = statuses.includes(400);

    assert(hasOneSuccess, 'Exactly one cashier transaction succeeded');
    assert(hasOneRejection, 'Second simultaneous checkout rejected due to cleared balance');

    // Verify DB appointment never collected 2000
    const appt3After = await prisma.appointment.findUnique({ where: { id: appt3.id } });
    assert(appt3After.paidAmount === 1000, 'Total collected strictly capped at bill amount (1000)');

    // -------------------------------------------------------------
    // Test 8: Ledger Reconciliation
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Ledger vs Department Reconciliation ---');
    const m8 = createMockReqRes({ params: { id: patient.id } });
    await getPatientMasterBill(m8.req, m8.res);

    assert(m8.getStatus() === 200, 'getPatientMasterBill returns HTTP 200');
    const reconciliation = m8.getData()?.financials?.reconciliation;
    assert(reconciliation !== undefined, 'Reconciliation object present in financials');
    console.log('    Reconciliation status:', reconciliation?.status);
    console.log('    Department Net Paid:', reconciliation?.departmentPaid);
    console.log('    Ledger Net Paid:', reconciliation?.ledgerPaid);
    console.log('    Discrepancy:', reconciliation?.discrepancy);
    assert(reconciliation?.status === 'RECONCILED' || reconciliation?.isReconciled, 'Ledger and departmental totals reconciled');

  } finally {
    // Clean up test patient and related records
    try {
      await prisma.paymentTransaction.deleteMany({ where: { patientId: patient.id } });
      await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
      await prisma.patient.delete({ where: { id: patient.id } });
      console.log(`\n🧹 Cleaned up isolated test patient (${patient.mrn})`);
    } catch (cleanupErr) {
      console.warn('Cleanup notice:', cleanupErr.message);
    }
  }

  console.log('\n===============================================================');
  console.log(`📊 Test Suite Finished: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
