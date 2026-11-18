/**
 * Automated Multi-Visit System Integrity Test Suite
 * Covers:
 * 1. Opening a patient profile does NOT auto-create a visit.
 * 2. Explicit 'Start New Visit' creates an encounter with VIS-YYYY-XXXXXX format and ACTIVE status.
 * 3. Scoping department orders (OPD, Lab, X-Ray) to the active visitId.
 * 4. Multi-visit isolation: Visit #2's master bill reflects only Visit #2 orders and balances.
 * 5. Historical visit closure: closing sets COMPLETED/DISCHARGED status and checkOutDate.
 * 6. Read-Only guard: rejects new orders on completed or discharged visits.
 * 7. Visit-scoped checkout: settling Visit #2 leaves Visit #1's past dues completely untouched.
 * 8. Authorized reopening: allows ADMIN to reopen an encounter with an audit reason.
 */

const prisma = require('../src/config/prisma');
const {
  createPatientVisit,
  getPatientVisits,
  getVisitById,
  closeOrDischargeVisit,
  reopenVisit
} = require('../src/controllers/visitController');
const {
  getPatientById,
  getPatientMasterBill,
  settlePatientDues
} = require('../src/controllers/patientController');
const { createAppointment } = require('../src/controllers/appointmentController');
const { createLabOrder } = require('../src/controllers/labController');
const { createXrayOrder } = require('../src/controllers/xrayController');

// Test Helper: Mock Express Request/Response
function createMockReqRes({ params = {}, body = {}, user = null, query = {}, headers = {} } = {}) {
  const req = {
    params,
    body,
    query,
    user: user || { id: 'admin-test-user-id', name: 'Admin Audit Test', role: 'ADMIN' },
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

async function runMultiVisitTests() {
  console.log('\n======================================================');
  console.log('🏥 HMS MULTI-VISIT PATIENT SYSTEM INTEGRITY TEST SUITE');
  console.log('======================================================\n');

  let testPatient = null;
  let testDoctor = null;
  let testLabTest = null;
  let testXrayRate = null;
  let visit1 = null;
  let visit2 = null;

  try {
    // Setup test doctor
    testDoctor = await prisma.doctor.findFirst({
      include: { user: true, department: true }
    });
    if (!testDoctor) {
      const user = await prisma.user.create({
        data: {
          name: 'Dr. Multi-Visit Test',
          email: `doc.test.${Date.now()}@hms.local`,
          password: 'hashedpassword',
          role: 'DOCTOR'
        }
      });
      testDoctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          specialization: 'Internal Medicine',
          consultationFee: 2000
        },
        include: { user: true, department: true }
      });
    }

    // Setup lab test mock
    testLabTest = {
      code: 'MV-CBC',
      name: 'Multi-Visit CBC Test',
      category: 'Hematology',
      fee: 1500
    };

    // Setup X-ray rate mock
    testXrayRate = {
      code: 'MV-XR-CHEST',
      name: 'Multi-Visit Chest X-Ray',
      bodyPart: 'Chest',
      modality: 'Digital X-Ray',
      fee: 2500
    };

    // Create a pristine test patient
    const uniquePhone = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
    testPatient = await prisma.patient.create({
      data: {
        mrn: `MRN-MV-${Date.now().toString().slice(-6)}`,
        name: 'Multi-Visit Test Patient',
        phone: uniquePhone,
        gender: 'Female',
        age: 32,
        bloodGroup: 'B+'
      }
    });

    console.log(`[INFO] Test Patient created: ${testPatient.name} (MRN: ${testPatient.mrn}, ID: ${testPatient.id})\n`);

    // =========================================================================
    // TEST 1: Opening a patient profile does NOT auto-create a visit
    // =========================================================================
    console.log('--- TEST 1: Zero Auto-Creation on Viewing Patient Profile ---');
    {
      const mock = createMockReqRes({ params: { id: testPatient.id } });
      await getPatientById(mock.req, mock.res);

      assert(mock.getStatus() === 200, 'getPatientById returns HTTP 200');
      const data = mock.getData();
      assert(data.success === true, 'getPatientById success is true');
      assert(Array.isArray(data.patient?.visits), 'Patient visits is an array');
      assert(data.patient.visits.length === 0, 'No visits auto-created upon opening patient record', `Got: ${data.patient.visits.length}`);

      const dbVisitsCount = await prisma.patientVisit.count({ where: { patientId: testPatient.id } });
      assert(dbVisitsCount === 0, 'Database confirms 0 visits exist for patient');
    }

    // =========================================================================
    // TEST 2: Explicit 'Start New Visit' creates an encounter with VIS-YYYY-XXXXXX format
    // =========================================================================
    console.log('\n--- TEST 2: Explicit Visit Encounter Creation ---');
    {
      const mock = createMockReqRes({
        params: { patientId: testPatient.id },
        body: {
          visitType: 'OPD',
          attendingDoctorId: testDoctor.id,
          chiefComplaint: 'Acute migraine and blurred vision',
          bloodPressure: '130/85',
          pulseRate: 78,
          temperature: 98.4,
          spo2: 99,
          weightKg: 62
        }
      });
      await createPatientVisit(mock.req, mock.res);

      assert(mock.getStatus() === 201, 'createPatientVisit returns HTTP 201 Created');
      const data = mock.getData();
      assert(data.success === true, 'Visit creation succeeded');
      visit1 = data.visit;
      assert(Boolean(visit1?.id), 'Visit has valid UUID');
      assert(/^VIS-\d{4}-\d{6}/.test(visit1.visitNo), `Visit number formatted as VIS-YYYY-XXXXXX (got: ${visit1.visitNo})`);
      assert(visit1.status === 'ACTIVE', 'Visit status is ACTIVE');
      assert(Boolean(visit1.checkInDate), 'Visit has checkInDate timestamp');
      assert(visit1.bloodPressure === '130/85', 'Initial vitals (BP) recorded correctly');
    }

    // =========================================================================
    // TEST 3: Scoping Department Orders (OPD & Lab) to Visit 1
    // =========================================================================
    console.log('\n--- TEST 3: Attaching Department Orders Scoped to Visit 1 ---');
    {
      // 3.1: Create OPD Appointment scoped to Visit 1
      const apptMock = createMockReqRes({
        body: {
          patientId: testPatient.id,
          targetVisitId: visit1.id,
          doctorId: testDoctor.id,
          date: new Date().toISOString().split('T')[0],
          time: '10:00 AM',
          consultationFee: 2000,
          paidAmount: 0,
          paymentStatus: 'UNPAID',
          type: 'CONSULTATION',
          clinicalNotes: 'Initial consultation in Visit 1'
        }
      });
      await createAppointment(apptMock.req, apptMock.res);
      assert(apptMock.getStatus() === 201, 'Appointment created with HTTP 201');
      const createdAppt = apptMock.getData()?.appointment;
      assert(createdAppt?.visitId === visit1.id, 'Appointment tagged with visit1.id');

      // 3.2: Create Lab Order scoped to Visit 1
      const labMock = createMockReqRes({
        body: {
          patientId: testPatient.id,
          targetVisitId: visit1.id,
          patientName: testPatient.name,
          mrn: testPatient.mrn,
          refDoctor: 'Dr. Test',
          testsJson: JSON.stringify([{ code: testLabTest.code, name: testLabTest.name, fee: 1500 }]),
          tests: [{ name: testLabTest.name, price: 1500 }],
          totalFee: 1500,
          discountAmount: 0,
          netTotal: 1500,
          paidAmount: 0,
          paymentStatus: 'UNPAID'
        }
      });
      await createLabOrder(labMock.req, labMock.res);
      assert(labMock.getStatus() === 201, 'Lab Order created with HTTP 201');
      const createdLab = labMock.getData()?.order;
      assert(createdLab?.visitId === visit1.id, 'Lab Order tagged with visit1.id');

      // 3.3: Master bill scoped to Visit 1
      const billMock = createMockReqRes({
        params: { id: testPatient.id },
        query: { visitId: visit1.id }
      });
      await getPatientMasterBill(billMock.req, billMock.res);
      assert(billMock.getStatus() === 200, 'getPatientMasterBill returns HTTP 200');
      const billData = billMock.getData();
      assert(billData.isVisitScoped === true, 'Master bill is flagged as isVisitScoped: true');
      assert(billData.visit?.id === visit1.id, 'Master bill scoped to Visit 1');
      assert(billData.summary?.netTotalPayable === 3500, 'Visit 1 Net Total is Rs 3,500 (2000 OPD + 1500 Lab)', `Got: ${billData.summary?.netTotalPayable}`);
      assert(billData.summary?.netRemainingDue === 3500, 'Visit 1 Balance Due is Rs 3,500', `Got: ${billData.summary?.netRemainingDue}`);
    }

    // =========================================================================
    // TEST 4: Multi-Visit Isolation: Visit 2 has separate encounter & orders
    // =========================================================================
    console.log('\n--- TEST 4: Multi-Visit Encounter Isolation ---');
    {
      // 4.1: Create Visit 2
      const mockV2 = createMockReqRes({
        params: { patientId: testPatient.id },
        body: {
          visitType: 'EMERGENCY',
          attendingDoctorId: testDoctor.id,
          chiefComplaint: 'Chest pain post injury',
          bloodPressure: '140/90'
        }
      });
      await createPatientVisit(mockV2.req, mockV2.res);
      assert(mockV2.getStatus() === 201, 'createPatientVisit (Visit 2) returns HTTP 201');
      visit2 = mockV2.getData().visit;
      assert(visit2.id !== visit1.id, 'Visit 2 has unique ID');
      assert(visit2.visitNo !== visit1.visitNo, 'Visit 2 has unique Visit Number');

      // 4.2: Create X-Ray order attached to Visit 2
      const xrayMock = createMockReqRes({
        body: {
          patientType: 'INTERNAL',
          patientId: testPatient.id,
          targetVisitId: visit2.id,
          mrn: testPatient.mrn,
          patientName: testPatient.name,
          paymentStatus: 'UNPAID',
          paymentMethod: 'CASH',
          discountAmount: 0,
          netTotal: 2500,
          paidAmount: 0,
          scans: [{ name: testXrayRate.name, bodyPart: 'Chest', modality: 'Digital X-Ray', fee: 2500 }]
        }
      });
      await createXrayOrder(xrayMock.req, xrayMock.res);
      assert(xrayMock.getStatus() === 201, 'X-Ray order created with HTTP 201');
      const createdXray = xrayMock.getData()?.order;
      assert(createdXray?.visitId === visit2.id, 'X-Ray order tagged with visit2.id');

      // 4.3: Verify Visit 2 master bill contains ONLY Visit 2 charges (Rs 2,500)
      const v2BillMock = createMockReqRes({
        params: { id: testPatient.id },
        query: { visitId: visit2.id }
      });
      await getPatientMasterBill(v2BillMock.req, v2BillMock.res);
      const v2Bill = v2BillMock.getData();
      assert(v2Bill.summary?.netTotalPayable === 2500, 'Visit 2 Net Total is isolated at Rs 2,500 (does NOT include Visit 1 charges of Rs 3,500)', `Got: ${v2Bill.summary?.netTotalPayable}`);
      assert(v2Bill.summary?.netRemainingDue === 2500, 'Visit 2 Balance Due is isolated at Rs 2,500', `Got: ${v2Bill.summary?.netRemainingDue}`);

      // 4.4: Verify Patient Cumulative bill has total of both (3500 + 2500 = 6000)
      const cumBillMock = createMockReqRes({ params: { id: testPatient.id } });
      await getPatientMasterBill(cumBillMock.req, cumBillMock.res);
      const cumBill = cumBillMock.getData();
      assert(cumBill.summary?.netTotalPayable === 6000, 'Lifetime Cumulative Net Total is Rs 6,000 (3500 + 2500)', `Got: ${cumBill.summary?.netTotalPayable}`);
    }

    // =========================================================================
    // TEST 5 & 6: Historical Visit Closure and Read-Only Enforcement
    // =========================================================================
    console.log('\n--- TEST 5 & 6: Historical Visit Closure and Read-Only Guard ---');
    {
      // 5.1: Close Visit 1 as COMPLETED
      const closeMock = createMockReqRes({
        params: { id: visit1.id },
        body: { status: 'COMPLETED', dischargeNotes: 'Patient cleared for home recovery.' }
      });
      await closeOrDischargeVisit(closeMock.req, closeMock.res);
      assert(closeMock.getStatus() === 200, 'closeOrDischargeVisit returns HTTP 200');
      const closedV1 = closeMock.getData().visit;
      assert(closedV1.status === 'COMPLETED', 'Visit 1 status is COMPLETED');
      assert(Boolean(closedV1.checkOutDate), 'Visit 1 checkOutDate is populated');

      // 6.1: Attempt to create an Appointment on closed Visit 1 -> MUST BE REJECTED
      const rejectApptMock = createMockReqRes({
        body: {
          patientId: testPatient.id,
          targetVisitId: visit1.id,
          doctorId: testDoctor.id,
          date: new Date().toISOString().split('T')[0],
          time: '11:00 AM',
          consultationFee: 1000,
          paymentStatus: 'UNPAID'
        }
      });
      await createAppointment(rejectApptMock.req, rejectApptMock.res);
      assert(rejectApptMock.getStatus() === 400, 'createAppointment rejects adding to closed encounter with HTTP 400');
      assert(/closed|completed|discharged/i.test(rejectApptMock.getData()?.message || ''), 'Error message states visit is closed');

      // 6.2: Attempt to create a Lab Order on closed Visit 1 -> MUST BE REJECTED
      const rejectLabMock = createMockReqRes({
        body: {
          patientId: testPatient.id,
          targetVisitId: visit1.id,
          patientName: testPatient.name,
          mrn: testPatient.mrn,
          refDoctor: 'Dr. Test',
          testsJson: JSON.stringify([{ code: testLabTest.code, name: testLabTest.name, fee: 1500 }]),
          tests: [{ name: testLabTest.name, price: 1500 }],
          totalFee: 1500,
          paymentStatus: 'UNPAID'
        }
      });
      await createLabOrder(rejectLabMock.req, rejectLabMock.res);
      assert(rejectLabMock.getStatus() === 400, 'createLabOrder rejects adding to closed encounter with HTTP 400');
      assert(/closed|completed|discharged/i.test(rejectLabMock.getData()?.message || ''), 'Error message states visit is closed');
    }

    // =========================================================================
    // TEST 7: Visit-Scoped Checkout & Debt Isolation
    // Settle Visit 2 dues; Visit 1 past dues (Rs 3,500) must remain intact!
    // =========================================================================
    console.log('\n--- TEST 7: Visit-Scoped Master Checkout & Debt Isolation ---');
    {
      const settleMock = createMockReqRes({
        params: { id: testPatient.id },
        body: {
          amount: 2500,
          paymentMethod: 'CASH',
          visitId: visit2.id,
          concessionAmount: 0
        }
      });
      await settlePatientDues(settleMock.req, settleMock.res);
      assert(settleMock.getStatus() === 200, 'settlePatientDues on Visit 2 returns HTTP 200');

      // Check Visit 2 Master Bill: dues should now be 0
      const v2AfterMock = createMockReqRes({
        params: { id: testPatient.id },
        query: { visitId: visit2.id }
      });
      await getPatientMasterBill(v2AfterMock.req, v2AfterMock.res);
      const v2After = v2AfterMock.getData();
      assert(v2After.summary?.netRemainingDue === 0, 'Visit 2 dues are fully cleared (Rs 0 remaining)', `Got: ${v2After.summary?.netRemainingDue}`);

      // Check Visit 1 Master Bill: dues MUST STILL BE Rs 3,500!
      const v1AfterMock = createMockReqRes({
        params: { id: testPatient.id },
        query: { visitId: visit1.id }
      });
      await getPatientMasterBill(v1AfterMock.req, v1AfterMock.res);
      const v1After = v1AfterMock.getData();
      assert(v1After.summary?.netRemainingDue === 3500, 'CRITICAL: Visit 1 past dues remained completely isolated at Rs 3,500 and were NOT altered by Visit 2 settlement!', `Got: ${v1After.summary?.netRemainingDue}`);
    }

    // =========================================================================
    // TEST 8: Authorized Admin Reopening of Encounter
    // =========================================================================
    console.log('\n--- TEST 8: Authorized Encounter Reopening ---');
    {
      const reopenMock = createMockReqRes({
        params: { id: visit1.id },
        body: { reason: 'Administrative review: patient returned for same-day suture check' },
        user: { id: 'admin-id', name: 'Dr. Admin', role: 'ADMIN' }
      });
      await reopenVisit(reopenMock.req, reopenMock.res);
      assert(reopenMock.getStatus() === 200, 'reopenVisit returns HTTP 200');
      const reopenedV1 = reopenMock.getData().visit;
      assert(reopenedV1.status === 'ACTIVE', 'Reopened encounter status restored to ACTIVE');
      assert(reopenedV1.checkOutDate === null, 'Reopened encounter checkOutDate reset to null');
    }

    // =========================================================================
    // TEST 9: getPatientVisits Summary API Validation
    // =========================================================================
    console.log('\n--- TEST 9: getPatientVisits Computed Ledger API ---');
    {
      const visitsMock = createMockReqRes({ params: { patientId: testPatient.id } });
      await getPatientVisits(visitsMock.req, visitsMock.res);
      assert(visitsMock.getStatus() === 200, 'getPatientVisits returns HTTP 200');
      const visitsData = visitsMock.getData();
      assert(visitsData.count === 2, 'Returns exactly 2 encounters for patient', `Got: ${visitsData.count}`);
      const v2Summary = visitsData.visits.find(v => v.id === visit2.id);
      assert(v2Summary?.balanceDue === 0, 'Visit 2 summary confirms balanceDue is 0');
      const v1Summary = visitsData.visits.find(v => v.id === visit1.id);
      assert(v1Summary?.balanceDue === 3500, 'Visit 1 summary confirms balanceDue is 3500');
    }

  } catch (err) {
    console.error('Fatal Test Exception:', err);
    failedTests++;
  } finally {
    // Clean up test data
    console.log('\n--- Cleanup: Purging Test Patient Records ---');
    try {
      if (testPatient) {
        // Cascade delete child orders first
        await prisma.paymentTransaction.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.invoice.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.xrayOrder.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.labOrder.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.appointment.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.patientVisit.deleteMany({ where: { patientId: testPatient.id } });
        await prisma.patient.delete({ where: { id: testPatient.id } });
        console.log(`[INFO] Test patient ${testPatient.id} and child records cleanly removed.`);
      }
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
  }

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMultiVisitTests();
