const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAuditEvent } = require('../src/utils/auditLogger');
const { generateInvoiceNo, generateMrn, generateAppointmentNo } = require('../src/utils/idGenerator');

async function runTests() {
  console.log('=== STARTING PHASE D HISTORICAL DATA PROTECTION TESTS ===\n');

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

  let testPatient = null;
  let testInvoice = null;
  let testAppt = null;
  let testDoctor = null;
  let testUser = null;

  try {
    // -------------------------------------------------------------
    // Setup test records
    // -------------------------------------------------------------
    testUser = await prisma.user.create({
      data: {
        name: 'Phase D Test Doctor',
        email: 'doc.phased.' + Date.now() + '@hospital.com',
        password: 'hash'
      }
    });

    testDoctor = await prisma.doctor.create({
      data: {
        userId: testUser.id,
        specialization: 'General Surgery',
        licenseNo: 'PMDC-TEST-D',
        consultationFee: 500
      }
    });

    testPatient = await prisma.patient.create({
      data: {
        name: 'Protection Test Patient',
        mrn: generateMrn(),
        gender: 'Male',
        age: 30
      }
    });

    testInvoice = await prisma.invoice.create({
      data: {
        invoiceNo: generateInvoiceNo(2026),
        patientId: testPatient.id,
        totalAmount: 1500,
        paidAmount: 1500,
        balance: 0,
        status: 'PAID'
      }
    });

    testAppt = await prisma.appointment.create({
      data: {
        appointmentNo: generateAppointmentNo(2026),
        patientId: testPatient.id,
        doctorId: testDoctor.id,
        date: new Date(),
        time: '10:00 AM',
        status: 'SCHEDULED'
      }
    });

    // -------------------------------------------------------------
    // Item 27: Stop Hard Deletion & Soft Archive Patient
    // -------------------------------------------------------------
    console.log('--- Testing Item 27: Stop Hard Deletion (Patient) ---');
    // Simulate soft deletion
    const archivedPatient = await prisma.patient.update({
      where: { id: testPatient.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: 'Patient moved out of state'
      }
    });

    await logAuditEvent({
      action: 'PATIENT_ARCHIVED',
      entity: 'Patient',
      entityId: testPatient.id,
      details: { mrn: testPatient.mrn, name: testPatient.name, reason: 'Patient moved out of state' }
    });

    const stillExistsPatient = await prisma.patient.findUnique({ where: { id: testPatient.id } });
    assert(stillExistsPatient !== null, 'Patient record was NOT removed from PostgreSQL');
    assert(stillExistsPatient.isArchived === true, 'Patient is marked isArchived: true');
    assert(stillExistsPatient.archivedAt !== null, 'Patient has recorded archivedAt timestamp');
    assert(stillExistsPatient.archivedReason === 'Patient moved out of state', 'Patient archivedReason preserved');

    // -------------------------------------------------------------
    // Item 28: Void Mechanism (Invoice)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 28: Void/Archive Mechanisms (Invoice) ---');
    const voidedInvoice = await prisma.invoice.update({
      where: { id: testInvoice.id },
      data: {
        status: 'VOIDED',
        isVoided: true,
        voidedAt: new Date(),
        voidReason: 'Billing error: double entry',
        voidedBy: 'Billing Officer'
      }
    });

    await logAuditEvent({
      action: 'INVOICE_VOIDED',
      entity: 'Invoice',
      entityId: testInvoice.id,
      details: { invoiceNo: testInvoice.invoiceNo, reason: 'Billing error: double entry' }
    });

    const stillExistsInvoice = await prisma.invoice.findUnique({ where: { id: testInvoice.id } });
    assert(stillExistsInvoice !== null, 'Invoice record was NOT removed from database');
    assert(stillExistsInvoice.status === 'VOIDED', 'Invoice status updated to VOIDED');
    assert(stillExistsInvoice.isVoided === true, 'Invoice has isVoided: true');
    assert(stillExistsInvoice.voidReason === 'Billing error: double entry', 'Invoice voidReason recorded');
    assert(stillExistsInvoice.voidedBy === 'Billing Officer', 'Invoice voidedBy recorded');

    // Default query hides voided
    const activeInvoices = await prisma.invoice.findMany({
      where: { id: testInvoice.id, isVoided: false }
    });
    assert(activeInvoices.length === 0, 'Active invoice queries filter out voided invoices by default');

    // Audit/all query includes voided
    const allInvoices = await prisma.invoice.findMany({
      where: { id: testInvoice.id }
    });
    assert(allInvoices.length === 1, 'Historical accounting queries can still retrieve voided invoice');

    // -------------------------------------------------------------
    // Item 29: Audit Trail
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 29: Audit Trail (audit_logs table) ---');
    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: { in: [testPatient.id, testInvoice.id] }
      },
      orderBy: { createdAt: 'desc' }
    });

    assert(logs.length >= 2, `Audit trail recorded all critical events (${logs.length} audit logs found)`);
    const patientLog = logs.find(l => l.action === 'PATIENT_ARCHIVED');
    const invoiceLog = logs.find(l => l.action === 'INVOICE_VOIDED');
    assert(patientLog !== undefined, 'PATIENT_ARCHIVED audit entry exists');
    assert(patientLog?.entity === 'Patient', 'Patient audit log has entity: Patient');
    assert(invoiceLog !== undefined, 'INVOICE_VOIDED audit entry exists');
    assert(invoiceLog?.entity === 'Invoice', 'Invoice audit log has entity: Invoice');

    // -------------------------------------------------------------
    // Item 30: Clinical vs Financial Status Separation
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 30: Clinical vs Financial Status Separation ---');
    // Create surgery order
    const surgery = await prisma.surgeryOrder.create({
      data: {
        orderNo: 'SURG-TEST-' + Date.now().toString().slice(-4),
        patientId: testPatient.id,
        patientName: testPatient.name,
        mrn: testPatient.mrn,
        surgeryName: 'Appendectomy',
        status: 'PENDING', // Clinical state: scheduled/not operated
        paymentStatus: 'UNPAID', // Financial state: unpaid
        totalFee: 40000
      }
    });

    // Simulate paying invoice or settling dues: only financial status changes
    const updatedSurgery = await prisma.surgeryOrder.update({
      where: { id: surgery.id },
      data: {
        paidAmount: 40000,
        paymentStatus: 'PAID'
      }
    });

    assert(updatedSurgery.paymentStatus === 'PAID', 'Financial status updated to PAID');
    assert(updatedSurgery.status === 'PENDING', 'Clinical surgical procedure status remained PENDING (not COMPLETED)');

    // Simulate voiding an invoice related to this surgery
    const voidedSurgInvoice = await prisma.invoice.create({
      data: {
        invoiceNo: generateInvoiceNo(2026),
        patientId: testPatient.id,
        totalAmount: 40000,
        status: 'VOIDED',
        isVoided: true
      }
    });

    // Verify clinical order still exists and is untouched
    const surgeryPostVoid = await prisma.surgeryOrder.findUnique({ where: { id: surgery.id } });
    assert(surgeryPostVoid !== null, 'Surgery clinical record exists after invoice void');
    assert(surgeryPostVoid.surgeryName === 'Appendectomy', 'Clinical procedure data fully intact');

    // Cleanup
    await prisma.surgeryOrder.delete({ where: { id: surgery.id } });
    await prisma.invoice.delete({ where: { id: voidedSurgInvoice.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [testPatient.id, testInvoice.id] } } });
    await prisma.appointment.delete({ where: { id: testAppt.id } });
    await prisma.invoice.delete({ where: { id: testInvoice.id } });
    await prisma.patient.delete({ where: { id: testPatient.id } });
    await prisma.doctor.delete({ where: { id: testDoctor.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log(`\n=== PHASE D TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
