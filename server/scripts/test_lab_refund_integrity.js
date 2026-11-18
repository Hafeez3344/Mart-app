/**
 * Automated Test Suite: HMS Lab Refund Accounting and Order-Level Reconciliation
 * Verifies:
 * 1. Multiple original payments (Rs. 2000 + Rs. 1000)
 * 2. Partial refund (Rs. 500) -> paymentStatus remains PARTIAL, retained 2500, refundAmount 500
 * 3. Original payment records remain immutable
 * 4. Refund links to original payment through originalTxId
 * 5. Returned record exposes originalTxId
 * 6. Over-refund protection (rejects refund > retained cash)
 * 7. Duplicate-request / Idempotency protection on refunds
 * 8. Full refund -> paymentStatus becomes REFUNDED only when net retained cash reaches 0
 * 9. Rejection of refund attempts on fully refunded orders
 * 10. Separation of clinical status (CANCELLED, PENDING, COMPLETED) from payment status
 * 11. Order-level reconciliation and flagging of inconsistencies in master bill
 * 12. Complete consistency between getPatientMasterBill and getPatientById
 */

const prisma = require('../src/config/prisma');
const { settlePatientDues, getPatientMasterBill, getPatientById } = require('../src/controllers/patientController');
const { refundPatient } = require('../src/controllers/billingController');

let realUser = null;

function createMockReqRes({ params = {}, body = {}, user = null, headers = {} } = {}) {
  const req = {
    params,
    body,
    user: user || (realUser ? { id: realUser.id, name: realUser.name || 'Lab QA Auditor', role: realUser.role || 'ADMIN' } : null),
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

async function runLabRefundTestSuite() {
  console.log('===============================================================');
  console.log('🧪 Starting HMS Lab Refund Accounting & Reconciliation Test Suite');
  console.log('===============================================================\n');

  realUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!realUser) {
    realUser = await prisma.user.findFirst();
  }

  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  const patient = await prisma.patient.create({
    data: {
      mrn: `LABMRN-${suffix}`,
      name: `Lab Refund Patient ${suffix}`,
      gender: 'Male',
      age: 38,
      phone: `0300${suffix.slice(0, 7)}`,
      paymentScheme: 'SELF_PAY'
    }
  });

  console.log(`Created isolated test patient: ${patient.name} (${patient.mrn})`);

  let labOrder = null;

  try {
    // -------------------------------------------------------------
    // Setup Lab Order: Gross Fee 3500, Discount 500, Net 3000
    // -------------------------------------------------------------
    labOrder = await prisma.labOrder.create({
      data: {
        orderNo: `LAB-ORD-${suffix}`,
        patientId: patient.id,
        patientName: patient.name,
        mrn: patient.mrn,
        totalFee: 3500,
        discountAmount: 500,
        netTotal: 3000,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        testsJson: JSON.stringify([
          { name: 'Complete Blood Count (CBC)', fee: 1500 },
          { name: 'Liver Function Test (LFT)', fee: 2000 }
        ])
      }
    });

    // -------------------------------------------------------------
    // Test 1: Multiple Original Payments (Rs. 2,000 + Rs. 1,000)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Multiple Original Payments (2,000 + 1,000) ---');

    // First payment: Rs. 2,000
    const mPay1 = createMockReqRes({
      params: { id: patient.id },
      body: { collectedAmount: 2000, discountAmount: 0, paymentMethod: 'CASH' }
    });
    await settlePatientDues(mPay1.req, mPay1.res);
    assert(mPay1.getStatus() === 200, 'First payment (2000) returns HTTP 200');

    let labAfterPay1 = await prisma.labOrder.findUnique({ where: { id: labOrder.id } });
    assert(labAfterPay1.paidAmount === 2000, 'Lab order paidAmount updated to 2000');
    assert(labAfterPay1.paymentStatus === 'PARTIAL', 'Lab order paymentStatus is PARTIAL');

    // Second payment: Rs. 1,000
    const mPay2 = createMockReqRes({
      params: { id: patient.id },
      body: { collectedAmount: 1000, discountAmount: 0, paymentMethod: 'CASH' }
    });
    await settlePatientDues(mPay2.req, mPay2.res);
    assert(mPay2.getStatus() === 200, 'Second payment (1000) returns HTTP 200');

    let labAfterPay2 = await prisma.labOrder.findUnique({ where: { id: labOrder.id } });
    assert(labAfterPay2.paidAmount === 3000, 'Lab order paidAmount updated to 3000');
    assert(labAfterPay2.paymentStatus === 'PAID', 'Lab order paymentStatus updated to PAID');
    assert(labAfterPay2.isPaid === true, 'Lab order isPaid flag is true');

    // Check payment transactions
    const paymentTxs = await prisma.paymentTransaction.findMany({
      where: { patientId: patient.id, referenceId: labOrder.id, transactionType: 'PAYMENT' },
      orderBy: { createdAt: 'asc' }
    });
    assert(paymentTxs.length === 2, 'Exactly 2 PAYMENT transactions exist in ledger');
    assert(paymentTxs[0].amount === 2000 && paymentTxs[1].amount === 1000, 'Payment transactions match 2000 and 1000');
    const firstPaymentTxId = paymentTxs[0].id;
    const secondPaymentTxId = paymentTxs[1].id;

    // -------------------------------------------------------------
    // Test 2: Partial Refund (Rs. 500) & Regression Verification
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Partial Refund (Rs. 500) ---');
    const mRefund = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 500,
        reason: 'Sample clotted - retest unnecessary',
        paymentMethod: 'CASH'
      }
    });

    await refundPatient(mRefund.req, mRefund.res);
    assert(mRefund.getStatus() === 200, 'Refund executes with HTTP 200');

    const refundResp = mRefund.getData()?.refund;
    assert(refundResp?.amount === 500, 'Returned refund object reports Rs. 500');
    assert(refundResp?.originalTxId !== undefined && refundResp?.originalTxId !== null, 'Returned refund exposes originalTxId');
    console.log('    Returned originalTxId:', refundResp?.originalTxId);

    // Verify refund in database
    const dbRefundTx = await prisma.paymentTransaction.findFirst({
      where: { patientId: patient.id, referenceId: labOrder.id, transactionType: 'REFUND' }
    });
    assert(dbRefundTx !== null, 'Refund PaymentTransaction created in database');
    assert(dbRefundTx.amount === 500, 'Refund transaction amount is positive 500');
    assert(dbRefundTx.originalTxId === secondPaymentTxId || dbRefundTx.originalTxId === firstPaymentTxId, 'Refund linked to originalTxId');

    // Verify original payments remain immutable
    const dbPaymentsAfterRefund = await prisma.paymentTransaction.findMany({
      where: { patientId: patient.id, referenceId: labOrder.id, transactionType: 'PAYMENT' },
      orderBy: { createdAt: 'asc' }
    });
    assert(
      dbPaymentsAfterRefund.length === 2 &&
      dbPaymentsAfterRefund[0].amount === 2000 &&
      dbPaymentsAfterRefund[1].amount === 1000,
      'Original payment records remain completely immutable'
    );

    // Verify Lab Order in DB retains 2500, is PARTIAL, NOT REFUNDED
    const labAfterRefund = await prisma.labOrder.findUnique({ where: { id: labOrder.id } });
    assert(labAfterRefund.paidAmount === 2500, 'Lab order DB paidAmount is 2,500 (3,000 - 500)');
    assert(labAfterRefund.paymentStatus === 'PARTIAL', 'Lab order DB paymentStatus is PARTIAL (NOT REFUNDED!)');
    assert(labAfterRefund.status === 'PENDING', 'Clinical status preserved as PENDING');

    // -------------------------------------------------------------
    // Test 3: Master Bill Endpoint Consistency & Expected Scenario
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing getPatientMasterBill Regression Scenario ---');
    const mMaster = createMockReqRes({ params: { id: patient.id } });
    await getPatientMasterBill(mMaster.req, mMaster.res);
    assert(mMaster.getStatus() === 200, 'getPatientMasterBill returns HTTP 200');

    const masterData = mMaster.getData();
    const labInMaster = (masterData.labOrders || []).find(l => l.id === labOrder.id);
    assert(labInMaster !== undefined, 'Lab order present in master bill');

    console.log('    Master Bill Lab Order checks:');
    console.log('      Gross Fee:', labInMaster?.fee);
    console.log('      Discount:', labInMaster?.discountAmount);
    console.log('      Net Bill:', labInMaster?.net);
    console.log('      Paid (Retained Cash):', labInMaster?.paid);
    console.log('      Total Paid Before Refund:', labInMaster?.totalPaidBeforeRefund);
    console.log('      Refund Amount:', labInMaster?.refundAmount);
    console.log('      Remaining Balance:', labInMaster?.remainingBalance);
    console.log('      Payment Status:', labInMaster?.paymentStatus);
    console.log('      isRefunded:', labInMaster?.isRefunded);
    console.log('      hasRefund:', labInMaster?.hasRefund);

    assert(labInMaster?.net === 3000, 'Net bill is Rs. 3,000 (totalFee 3500 - discount 500)');
    assert(labInMaster?.totalPaidBeforeRefund === 3000, 'Total cash paid before refund is Rs. 3,000');
    assert(labInMaster?.refundAmount === 500, 'Refund amount reports Rs. 500 (NOT 2500!)');
    assert(labInMaster?.paid === 2500, 'Net cash retained reports Rs. 2,500');
    assert(labInMaster?.remainingBalance === 500, 'Remaining balance is Rs. 500');
    assert(labInMaster?.paymentStatus === 'PARTIAL', 'Payment status is PARTIAL');
    assert(labInMaster?.isRefunded === false, 'isRefunded is false (partially retained)');
    assert(labInMaster?.hasRefund === true, 'hasRefund is true');

    // Order-level reconciliation in master bill
    const labReconciliation = labInMaster?.reconciliation;
    assert(labReconciliation?.isReconciled === true, 'Order-level reconciliation passes (isReconciled: true)');
    assert(labReconciliation?.discrepancy === 0, 'Order-level discrepancy is 0');
    assert(labReconciliation?.departmentPaid === 2500, 'Order departmentPaid is 2500');
    assert(labReconciliation?.ledgerNetPaid === 2500, 'Order ledgerNetPaid is 2500 (3000 paid - 500 refund)');

    // Aggregate master bill reconciliation
    const aggReconciliation = masterData.financials?.reconciliation;
    assert(aggReconciliation?.isReconciled === true, 'Aggregate master reconciliation is true');
    assert(aggReconciliation?.status === 'RECONCILED', 'Aggregate reconciliation status is RECONCILED');
    assert((aggReconciliation?.orderInconsistencies || []).length === 0, 'No order inconsistencies flagged');

    // -------------------------------------------------------------
    // Test 4: getPatientById Endpoint Consistency
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing getPatientById Endpoint Consistency ---');
    const mById = createMockReqRes({ params: { id: patient.id } });
    await getPatientById(mById.req, mById.res);
    assert(mById.getStatus() === 200, 'getPatientById returns HTTP 200');

    const byIdPatient = mById.getData()?.patient;
    const labInById = (byIdPatient?.labOrders || []).find(l => l.id === labOrder.id);
    assert(labInById !== undefined, 'Lab order present in getPatientById');
    assert(labInById?.net === 3000, 'getPatientById net bill is Rs. 3,000');
    assert(labInById?.paidAmount === 2500, 'getPatientById paidAmount is Rs. 2,500');
    assert(labInById?.refundAmount === 500, 'getPatientById refundAmount is Rs. 500');
    assert(labInById?.paymentStatus === 'PARTIAL', 'getPatientById paymentStatus is PARTIAL');
    assert(labInById?.remainingBalance === 500, 'getPatientById remainingBalance is Rs. 500');

    // -------------------------------------------------------------
    // Test 5: Over-refund Protection
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Over-Refund Protection (Refund > Retained Balance) ---');
    const mOverRefund = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 2600, // Retained is 2500
        reason: 'Over-refund test'
      }
    });

    await refundPatient(mOverRefund.req, mOverRefund.res);
    assert(mOverRefund.getStatus() === 400, 'Over-refund (2600 > 2500) rejected with HTTP 400');
    console.log('    Rejection message:', mOverRefund.getData()?.message);

    // -------------------------------------------------------------
    // Test 6: Duplicate-Request / Idempotency Protection on Refunds
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Refund Idempotency Replay ---');
    const refundIdempKey = `IDEMP-REF-${suffix}`;
    const mIdemp1 = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 500,
        idempotencyKey: refundIdempKey,
        reason: 'Patient cancellation part 2'
      }
    });

    await refundPatient(mIdemp1.req, mIdemp1.res);
    assert(mIdemp1.getStatus() === 200, 'First refund request with key succeeds');

    // Repeat with identical idempotencyKey
    const mIdemp2 = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 500,
        idempotencyKey: refundIdempKey,
        reason: 'Patient cancellation part 2 (retry)'
      }
    });

    await refundPatient(mIdemp2.req, mIdemp2.res);
    assert(mIdemp2.getStatus() === 200, 'Retried refund request returns HTTP 200');
    assert(mIdemp2.getData()?.isIdempotentReplay === true, 'Response flagged as isIdempotentReplay');

    // Retained balance should be 2000 (2500 - 500), NOT 1500!
    const labAfterIdemp = await prisma.labOrder.findUnique({ where: { id: labOrder.id } });
    assert(labAfterIdemp.paidAmount === 2000, 'Paid amount deducted exactly once (2000)');

    // -------------------------------------------------------------
    // Test 7: Full Refund (Remaining 2000) & Policy Confirmation
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Full Refund to Zero Retained Balance ---');
    const mFullRefund = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 2000,
        cancelOrder: true,
        reason: 'Doctor cancelled entire pathology diagnostic workup'
      }
    });

    await refundPatient(mFullRefund.req, mFullRefund.res);
    assert(mFullRefund.getStatus() === 200, 'Full refund executes with HTTP 200');

    const labFullyRefunded = await prisma.labOrder.findUnique({ where: { id: labOrder.id } });
    assert(labFullyRefunded.paidAmount === 0, 'Paid amount is 0');
    assert(labFullyRefunded.paymentStatus === 'REFUNDED', 'Payment status is REFUNDED');
    assert(labFullyRefunded.status === 'CANCELLED', 'Clinical status updated to CANCELLED as explicitly requested');

    // Verify subsequent refund attempt on fully refunded order is rejected
    const mRefundEmpty = createMockReqRes({
      body: {
        patientId: patient.id,
        labOrderId: labOrder.id,
        refundAmount: 100,
        reason: 'Attempt refund on 0 balance'
      }
    });
    await refundPatient(mRefundEmpty.req, mRefundEmpty.res);
    assert(mRefundEmpty.getStatus() === 400, 'Subsequent refund attempt on fully refunded order rejected with HTTP 400');

    // -------------------------------------------------------------
    // Test 8: Order-Level Inconsistency Flagging in Master Bill
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Order-Level Inconsistency Flagging ---');
    // Artificially simulate a database corruption/manual edit on paidAmount (e.g., 750 instead of 0)
    await prisma.labOrder.update({
      where: { id: labOrder.id },
      data: { paidAmount: 750 }
    });

    const mInconsistent = createMockReqRes({ params: { id: patient.id } });
    await getPatientMasterBill(mInconsistent.req, mInconsistent.res);
    assert(mInconsistent.getStatus() === 200, 'Master bill returns HTTP 200');

    const masterWithMismatch = mInconsistent.getData();
    const inconsistencies = masterWithMismatch?.financials?.reconciliation?.orderInconsistencies || [];
    assert(inconsistencies.length > 0, 'Order-level inconsistency successfully detected');
    assert(inconsistencies[0]?.department === 'LAB', 'Inconsistency correctly flagged on LAB department');
    assert(inconsistencies[0]?.discrepancy === 750, 'Discrepancy correctly calculated as 750');
    assert(masterWithMismatch?.financials?.reconciliation?.isReconciled === false, 'Master bill isReconciled is false');
    assert(masterWithMismatch?.financials?.reconciliation?.status === 'DISCREPANCY_FLAGGED', 'Status is DISCREPANCY_FLAGGED');
    console.log('    Flagged inconsistency note:', inconsistencies[0]?.reason);

    // Restore clean state
    await prisma.labOrder.update({
      where: { id: labOrder.id },
      data: { paidAmount: 0 }
    });

  } finally {
    // Cleanup isolated test records
    try {
      await prisma.paymentTransaction.deleteMany({ where: { patientId: patient.id } });
      if (labOrder) {
        await prisma.labOrder.deleteMany({ where: { id: labOrder.id } });
      }
      await prisma.patient.delete({ where: { id: patient.id } });
      console.log(`\n🧹 Cleaned up isolated test patient (${patient.mrn})`);
    } catch (cleanupErr) {
      console.warn('Cleanup notice:', cleanupErr.message);
    }
  }

  console.log('\n===============================================================');
  console.log(`📊 Lab Refund Test Suite Finished: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLabRefundTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
