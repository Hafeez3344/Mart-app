const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { parseMoney, validateFinancials, parseBoolean, parseIsoDate, formatDateYmd } = require('../src/utils/validationUtils');
const {
  generateInvoiceNo,
  generateAdmissionNo,
  generateAppointmentNo,
  generateLabOrderNo,
  generateXrayOrderNo,
  generateSurgeryOrderNo,
  generateServiceOrderNo,
  generatePharmacyInvoiceNo,
  generatePharmacyReturnNo,
  generateMrn,
  generateEmployeeId,
  generateDoctorLicenseNo,
  generateBedNo,
  generateRoomNo,
  generateResetCode
} = require('../src/utils/idGenerator');

async function runTests() {
  console.log('=== STARTING PHASE C DATABASE INTEGRITY TESTS ===\n');

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
    // -------------------------------------------------------------
    // Item 20: Unique Constraints
    // -------------------------------------------------------------
    console.log('--- Testing Item 20: Unique Constraints ---');
    const testUser = await prisma.user.create({
      data: {
        name: 'Unique Constraint Test Staff',
        email: 'unique.staff.' + Date.now() + '@hospital.com',
        password: 'hash'
      }
    });

    const testStaff = await prisma.staff.create({
      data: {
        userId: testUser.id,
        employeeId: 'EMP-UQ-' + Date.now().toString().slice(-4),
        firstName: 'Unique',
        lastName: 'Staff',
        email: testUser.email,
        designation: 'Technician',
        baseSalary: 40000
      }
    });

    const month = 'November';
    const year = 2026;

    // First salary record
    const sal1 = await prisma.salaryRecord.create({
      data: {
        staffId: testStaff.id,
        month,
        year,
        basicSalary: 40000,
        netSalary: 40000,
        status: 'PAID'
      }
    });
    assert(sal1.id !== undefined, 'First salary record created successfully');

    // Duplicate attempt with same [staffId, month, year]
    let dupBlocked = false;
    try {
      await prisma.salaryRecord.create({
        data: {
          staffId: testStaff.id,
          month,
          year,
          basicSalary: 40000,
          netSalary: 40000,
          status: 'PAID'
        }
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        dupBlocked = true;
      }
    }
    assert(dupBlocked, 'Database enforced @@unique([staffId, month, year]) on duplicate salary record');

    // Cleanup salary test
    await prisma.salaryRecord.deleteMany({ where: { staffId: testStaff.id } });
    await prisma.staff.delete({ where: { id: testStaff.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    // -------------------------------------------------------------
    // Item 21: Safe ID Generation (Collision Resistance)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 21: Safe ID Generation (Collision Resistance) ---');
    const idCount = 1000;
    const invoiceSet = new Set();
    const admissionSet = new Set();
    const mrnSet = new Set();
    const pharmInvSet = new Set();
    const pharmRetSet = new Set();
    const serviceOrderSet = new Set();
    const empIdSet = new Set();
    const docLicenseSet = new Set();
    const bedSet = new Set();
    const roomSet = new Set();

    for (let i = 0; i < idCount; i++) {
      invoiceSet.add(generateInvoiceNo(2026));
      admissionSet.add(generateAdmissionNo(2026));
      mrnSet.add(generateMrn());
      pharmInvSet.add(generatePharmacyInvoiceNo(2026));
      pharmRetSet.add(generatePharmacyReturnNo(2026));
      serviceOrderSet.add(generateServiceOrderNo(2026));
      empIdSet.add(generateEmployeeId('STF'));
      docLicenseSet.add(generateDoctorLicenseNo());
      bedSet.add(generateBedNo('BED'));
      roomSet.add(generateRoomNo('OPD'));
    }

    assert(invoiceSet.size === idCount, `1,000 generated invoices had 0 collisions (${invoiceSet.size}/${idCount} unique)`);
    assert(admissionSet.size === idCount, `1,000 generated admissions had 0 collisions (${admissionSet.size}/${idCount} unique)`);
    assert(mrnSet.size === idCount, `1,000 generated MRNs had 0 collisions (${mrnSet.size}/${idCount} unique)`);
    assert(pharmInvSet.size === idCount, `1,000 generated Pharmacy Invoices had 0 collisions (${pharmInvSet.size}/${idCount} unique)`);
    assert(pharmRetSet.size === idCount, `1,000 generated Pharmacy Returns had 0 collisions (${pharmRetSet.size}/${idCount} unique)`);
    assert(serviceOrderSet.size === idCount, `1,000 generated Service Orders had 0 collisions (${serviceOrderSet.size}/${idCount} unique)`);
    assert(empIdSet.size === idCount, `1,000 generated Employee IDs had 0 collisions (${empIdSet.size}/${idCount} unique)`);
    assert(docLicenseSet.size === idCount, `1,000 generated Doctor Licenses had 0 collisions (${docLicenseSet.size}/${idCount} unique)`);
    assert(bedSet.size === idCount, `1,000 generated Bed Nos had 0 collisions (${bedSet.size}/${idCount} unique)`);
    assert(roomSet.size === idCount, `1,000 generated Room Nos had 0 collisions (${roomSet.size}/${idCount} unique)`);

    const resetCode = generateResetCode();
    assert(/^\d{6}$/.test(resetCode), `generateResetCode produces valid 6-digit numeric OTP ("${resetCode}")`);

    // -------------------------------------------------------------
    // Item 22: PostgreSQL Database Indexes
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 22: PostgreSQL Database Indexes ---');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const indexNames = new Set(indexes.map(i => i.indexname));

    assert(indexNames.has('salary_records_staffId_month_year_key'), 'Unique index salary_records_staffId_month_year_key exists in PostgreSQL');
    assert(indexNames.has('appointments_doctorId_date_idx'), 'Composite index appointments_doctorId_date_idx exists in PostgreSQL');
    assert(indexNames.has('invoices_patientId_idx'), 'Index invoices_patientId_idx exists in PostgreSQL');
    assert(indexNames.has('invoices_status_idx'), 'Index invoices_status_idx exists in PostgreSQL');
    assert(indexNames.has('ipd_admissions_bedNo_idx'), 'Index ipd_admissions_bedNo_idx exists in PostgreSQL');
    assert(indexNames.has('lab_orders_paymentStatus_idx'), 'Index lab_orders_paymentStatus_idx exists in PostgreSQL');
    assert(indexNames.has('surgery_orders_scheduledDate_idx'), 'Index surgery_orders_scheduledDate_idx exists in PostgreSQL');

    // -------------------------------------------------------------
    // Item 23: Patient ID Relationships
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 23: Patient ID Relationships ---');
    let foreignKeyBlocked = false;
    try {
      await prisma.invoice.create({
        data: {
          invoiceNo: generateInvoiceNo(2026),
          patientId: '00000000-0000-0000-0000-000000000000', // Non-existent patient
          totalAmount: 500
        }
      });
    } catch (err) {
      if (err.code === 'P2003' || err.message?.includes('Foreign key constraint failed')) {
        foreignKeyBlocked = true;
      }
    }
    assert(foreignKeyBlocked, 'Database rejected invoice with non-existent patientId (P2003 Foreign Key constraint)');

    // -------------------------------------------------------------
    // Item 24: Money Validation & Calculations
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 24: Money Validation ---');
    assert(parseMoney(-500) === 0, 'parseMoney clamps negative money to 0.00');
    assert(parseMoney('abc', 10) === 10, 'parseMoney handles NaN with default value');
    assert(parseMoney(19.999) === 20.00, 'parseMoney rounds correctly to 2 decimal places');
    assert(parseMoney(0.1 + 0.2) === 0.30, 'parseMoney fixes floating-point precision leaks (0.1 + 0.2 = 0.30)');

    const fin1 = validateFinancials({ totalAmount: 1000, discountAmount: 1200, paidAmount: 500 });
    assert(fin1.discount === 1000, 'Discount cannot exceed total amount');
    assert(fin1.netTotal === 0, 'Net total clamped to 0 when discount exceeds total');
    assert(fin1.balance === 0, 'Balance is 0');
    assert(fin1.paymentStatus === 'PAID', '100% discount marks status PAID');

    const fin2 = validateFinancials({ totalAmount: 1000, discountAmount: 200, paidAmount: 500 });
    assert(fin2.netTotal === 800, 'Net total = 1000 - 200 = 800');
    assert(fin2.paid === 500, 'Paid = 500');
    assert(fin2.balance === 300, 'Balance = 300');
    assert(fin2.paymentStatus === 'PARTIAL', 'Status is PARTIAL');

    // -------------------------------------------------------------
    // Item 25: Boolean Validation
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 25: Boolean Validation ---');
    assert(parseBoolean(true) === true, 'parseBoolean(true) is true');
    assert(parseBoolean(false) === false, 'parseBoolean(false) is false');
    assert(parseBoolean('true') === true, 'parseBoolean("true") is true');
    assert(parseBoolean('false') === false, 'parseBoolean("false") is false (not truthy string)');
    assert(parseBoolean('0') === false, 'parseBoolean("0") is false');
    assert(parseBoolean('1') === true, 'parseBoolean("1") is true');
    assert(parseBoolean('yes') === true, 'parseBoolean("yes") is true');
    assert(parseBoolean('no') === false, 'parseBoolean("no") is false');
    assert(parseBoolean(undefined, true) === true, 'parseBoolean(undefined) uses default fallback');

    // -------------------------------------------------------------
    // Item 26: Date/Time Standardization
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 26: Date/Time Standardization ---');
    const validIso = parseIsoDate('2026-10-01T12:00:00Z');
    assert(!isNaN(validIso.getTime()), 'parseIsoDate successfully parsed ISO date');

    const fallbackDate = new Date('2026-01-01');
    const invalidIso = parseIsoDate('invalid-date-string', fallbackDate);
    assert(invalidIso.getTime() === fallbackDate.getTime(), 'parseIsoDate safely handled invalid date with fallback');

    const ymd = formatDateYmd(new Date('2026-10-01T15:30:00Z'));
    assert(ymd === '2026-10-01', `formatDateYmd formatted to "2026-10-01" (got "${ymd}")`);

    console.log(`\n=== PHASE C INTEGRITY TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
