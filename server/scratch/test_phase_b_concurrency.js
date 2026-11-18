const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('=== STARTING PHASE B DATA INTEGRITY & CONCURRENCY TESTS ===\n');

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
    // Test 17: Pharmacy Stock Concurrency (Items 17)
    // -------------------------------------------------------------
    console.log('--- Testing Item 17: Pharmacy Stock Concurrency ---');
    const testBarcode = 'TEST-CONCUR-' + Date.now();
    const testMed = await prisma.pharmacyMedicine.create({
      data: {
        name: 'Concurrency Test Tablet 500mg',
        genericName: 'Paracetamol',
        barcode: testBarcode,
        retailPrice: 50.0,
        stockQuantity: 5 // Only 5 in stock
      }
    });

    // Fire 2 concurrent sales of 4 tablets each (4 + 4 = 8 > 5)
    async function simulateSale(qty) {
      return prisma.$transaction(async (tx) => {
        const updateRes = await tx.pharmacyMedicine.updateMany({
          where: {
            id: testMed.id,
            stockQuantity: { gte: qty }
          },
          data: {
            stockQuantity: { decrement: qty }
          }
        });

        if (updateRes.count === 0) {
          const cur = await tx.pharmacyMedicine.findUnique({ where: { id: testMed.id } });
          throw new Error(`Insufficient stock. Requested: ${qty}, Available: ${cur.stockQuantity}`);
        }

        return tx.pharmacySale.create({
          data: {
            invoiceNo: `TEST-SALE-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
            subtotal: qty * 50,
            netTotal: qty * 50,
            paidAmount: qty * 50,
            status: 'PAID'
          }
        });
      });
    }

    const saleResults = await Promise.allSettled([
      simulateSale(4),
      simulateSale(4)
    ]);

    const successes = saleResults.filter(r => r.status === 'fulfilled');
    const failures = saleResults.filter(r => r.status === 'rejected');

    assert(successes.length === 1, `Exactly 1 sale succeeded (got ${successes.length})`);
    assert(failures.length === 1, `Exactly 1 sale was blocked by concurrency guard (got ${failures.length})`);

    const finalMed = await prisma.pharmacyMedicine.findUnique({ where: { id: testMed.id } });
    assert(finalMed.stockQuantity === 1, `Stock decremented correctly to 1 without negative balance (got ${finalMed.stockQuantity})`);

    // Cleanup test medicine
    await prisma.pharmacySale.deleteMany({ where: { invoiceNo: { startsWith: 'TEST-SALE-' } } });
    await prisma.pharmacyMedicine.delete({ where: { id: testMed.id } });

    // -------------------------------------------------------------
    // Test 11 & 12: IPD Bed Concurrency & Admission Transactions
    // -------------------------------------------------------------
    console.log('\n--- Testing Items 11 & 12: IPD Bed Concurrency & Admission Transactions ---');
    const testWard = await prisma.ipdWard.findFirst() || await prisma.ipdWard.create({
      data: { name: 'Test Concurrency Ward', genderType: 'MALE' }
    });

    const testBedNo = 'BED-CONCUR-' + Date.now().toString().slice(-4);
    const testBed = await prisma.ipdBed.create({
      data: {
        bedNo: testBedNo,
        wardId: testWard.id,
        dailyRate: 1500,
        isOccupied: false,
        status: 'AVAILABLE'
      }
    });

    const pat1 = await prisma.patient.create({
      data: { name: 'Concurrent Patient 1', mrn: 'MRN-CONCUR-1', phone: '03001111111' }
    });
    const pat2 = await prisma.patient.create({
      data: { name: 'Concurrent Patient 2', mrn: 'MRN-CONCUR-2', phone: '03002222222' }
    });

    // Simulate 2 concurrent admission attempts to the SAME bed
    async function simulateAdmission(patient, bNo) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'ipd_bed_no_' + bNo.toUpperCase());

        const b = await tx.ipdBed.findFirst({
          where: { bedNo: { equals: bNo, mode: 'insensitive' } }
        });

        if (!b) throw new Error('Bed not found');
        if (b.isOccupied) throw new Error(`Bed ${bNo} is currently occupied`);

        const adm = await tx.ipdAdmission.create({
          data: {
            admissionNo: `ADM-CONCUR-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
            patientId: patient.id,
            patientName: patient.name,
            mrn: patient.mrn,
            bedNo: bNo,
            wardOrRoomName: testWard.name,
            status: 'ADMITTED'
          }
        });

        await tx.ipdBed.update({
          where: { id: b.id },
          data: { isOccupied: true, status: 'OCCUPIED', patientId: patient.id }
        });

        await tx.patient.update({
          where: { id: patient.id },
          data: { admittedPlace: `${testWard.name} (${bNo})` }
        });

        return adm;
      });
    }

    const admResults = await Promise.allSettled([
      simulateAdmission(pat1, testBedNo),
      simulateAdmission(pat2, testBedNo)
    ]);

    const admSuccess = admResults.filter(r => r.status === 'fulfilled');
    const admBlocked = admResults.filter(r => r.status === 'rejected');

    assert(admSuccess.length === 1, `Exactly 1 concurrent admission claimed the bed (got ${admSuccess.length})`);
    assert(admBlocked.length === 1, `Second concurrent admission was rejected (got ${admBlocked.length})`);

    const checkedBed = await prisma.ipdBed.findUnique({ where: { id: testBed.id } });
    assert(checkedBed.isOccupied === true, `Bed is marked occupied`);

    // -------------------------------------------------------------
    // Test 13: IPD Discharge
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 13: IPD Discharge ---');
    const winningAdm = admSuccess[0].value;
    const dischargeResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'ipd_adm_' + winningAdm.id);

      const adm = await tx.ipdAdmission.update({
        where: { id: winningAdm.id },
        data: { status: 'DISCHARGED', dischargedAt: new Date() }
      });

      await tx.ipdBed.updateMany({
        where: { bedNo: testBedNo },
        data: { isOccupied: false, status: 'AVAILABLE', patientId: null }
      });

      await tx.patient.update({
        where: { id: winningAdm.patientId },
        data: { admittedPlace: null }
      });

      return adm;
    });

    const dischargedBed = await prisma.ipdBed.findUnique({ where: { id: testBed.id } });
    const dischargedPat = await prisma.patient.findUnique({ where: { id: winningAdm.patientId } });

    assert(dischargedBed.isOccupied === false, 'Bed is freed on discharge');
    assert(dischargedPat.admittedPlace === null, 'Patient admittedPlace cleared on discharge');
    assert(dischargeResult.status === 'DISCHARGED', 'Admission status updated to DISCHARGED');

    // Cleanup IPD test records
    await prisma.ipdAdmission.deleteMany({ where: { bedNo: testBedNo } });
    await prisma.ipdBed.delete({ where: { id: testBed.id } });
    await prisma.patient.deleteMany({ where: { id: { in: [pat1.id, pat2.id] } } });

    // -------------------------------------------------------------
    // Test 15: Invoice Payment Concurrency (Item 15)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 15: Invoice Payment Concurrency ---');
    const invPatient = await prisma.patient.create({
      data: { name: 'Invoice Test Patient', mrn: 'MRN-INV-' + Date.now() }
    });

    const testInvoice = await prisma.invoice.create({
      data: {
        invoiceNo: 'INV-CONCUR-' + Date.now(),
        patientId: invPatient.id,
        totalAmount: 1000,
        paidAmount: 0,
        balance: 1000,
        status: 'PENDING'
      }
    });

    async function payInvoice(amt) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'invoice_pay_' + testInvoice.id);

        const inv = await tx.invoice.findUnique({ where: { id: testInvoice.id } });
        if (inv.balance <= 0 || inv.status === 'PAID') {
          throw new Error('Invoice already fully settled');
        }

        const actual = Math.min(amt, inv.balance);
        const newPaid = inv.paidAmount + actual;
        const newBal = Math.max(0, inv.totalAmount - newPaid);

        return tx.invoice.update({
          where: { id: testInvoice.id },
          data: {
            paidAmount: newPaid,
            balance: newBal,
            status: newBal === 0 ? 'PAID' : 'PARTIAL'
          }
        });
      });
    }

    // Two concurrent payments of 700 on a 1000 invoice (700 + 700 = 1400)
    const payResults = await Promise.allSettled([
      payInvoice(700),
      payInvoice(700)
    ]);

    const finalInv = await prisma.invoice.findUnique({ where: { id: testInvoice.id } });
    assert(finalInv.paidAmount === 1000, `Invoice paid amount correctly capped at totalAmount 1000 (got ${finalInv.paidAmount})`);
    assert(finalInv.balance === 0, `Invoice balance is 0 without going negative (got ${finalInv.balance})`);
    assert(finalInv.status === 'PAID', 'Invoice status is PAID');

    // Cleanup invoice test records
    await prisma.invoice.delete({ where: { id: testInvoice.id } });
    await prisma.patient.delete({ where: { id: invPatient.id } });

    // -------------------------------------------------------------
    // Test 16: Refund Concurrency & Validation (Item 16)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 16: Refund Concurrency & Validation ---');
    const doctor = await prisma.doctor.findFirst() || await prisma.doctor.create({
      data: {
        specialization: 'General',
        user: { create: { name: 'Dr. Test Refund', email: 'dr.refund.' + Date.now() + '@hospital.com', password: 'hash' } }
      }
    });

    const refundPatientRec = await prisma.patient.create({
      data: { name: 'Refund Test Patient', mrn: 'MRN-REF-' + Date.now() }
    });

    const testAppt = await prisma.appointment.create({
      data: {
        appointmentNo: 'APT-REF-' + Date.now(),
        patientId: refundPatientRec.id,
        doctorId: doctor.id,
        date: new Date(),
        time: '10:00 AM',
        consultationFee: 500,
        paidAmount: 500,
        paymentStatus: 'PAID',
        tokenNo: 999
      }
    });

    async function refundAppointment(amt) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'refund_appt_' + testAppt.id);

        const a = await tx.appointment.findUnique({ where: { id: testAppt.id } });
        if (a.paymentStatus === 'REFUNDED') {
          throw new Error('Appointment has already been refunded');
        }

        if (amt > a.paidAmount) {
          throw new Error('Refund amount exceeds paid fee');
        }

        const updated = await tx.appointment.update({
          where: { id: testAppt.id },
          data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' }
        });

        const exp = await tx.expense.create({
          data: {
            expenseNo: 'EXP-REF-TEST-' + Date.now() + '-' + Math.floor(Math.random() * 99999),
            title: 'Test Refund Expense',
            category: 'Patient Refund',
            amount: amt,
            paidTo: refundPatientRec.name,
            expenseDate: new Date(),
            recordedBy: 'Test Runner'
          }
        });

        return { updated, exp };
      });
    }

    // Fire 2 concurrent refunds on the SAME appointment
    const refResults = await Promise.allSettled([
      refundAppointment(500),
      refundAppointment(500)
    ]);

    const refSuccess = refResults.filter(r => r.status === 'fulfilled');
    const refBlocked = refResults.filter(r => r.status === 'rejected');

    assert(refSuccess.length === 1, `Exactly 1 refund transaction succeeded (got ${refSuccess.length})`);
    assert(refBlocked.length === 1, `Duplicate refund attempt was safely blocked (got ${refBlocked.length})`);

    const finalAppt = await prisma.appointment.findUnique({ where: { id: testAppt.id } });
    assert(finalAppt.paymentStatus === 'REFUNDED', 'Appointment marked REFUNDED');

    // Cleanup refund test records
    await prisma.expense.deleteMany({ where: { title: 'Test Refund Expense' } });
    await prisma.appointment.delete({ where: { id: testAppt.id } });
    await prisma.patient.delete({ where: { id: refundPatientRec.id } });

    // -------------------------------------------------------------
    // Test 18: Salary Concurrency & Duplicate Generation (Item 18)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 18: Salary Concurrency ---');
    const testUser = await prisma.user.create({
      data: {
        name: 'Staff Salary Concurrency User',
        email: 'staff.salary.' + Date.now() + '@hospital.com',
        password: 'hash'
      }
    });

    const testStaff = await prisma.staff.create({
      data: {
        userId: testUser.id,
        employeeId: 'EMP-CONCUR-' + Date.now().toString().slice(-4),
        firstName: 'Staff',
        lastName: 'Concurrency',
        email: testUser.email,
        designation: 'Nurse',
        baseSalary: 35000
      }
    });

    const targetMonth = 'October';
    const targetYear = 2026;

    async function disburseSalary() {
      return prisma.$transaction(async (tx) => {
        const lockKey = `salary_${testStaff.id}_${targetMonth}_${targetYear}`;
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', lockKey);

        const existing = await tx.salaryRecord.findFirst({
          where: { staffId: testStaff.id, month: targetMonth, year: targetYear }
        });

        if (existing) {
          throw new Error('Salary has already been disbursed for this staff member');
        }

        return tx.salaryRecord.create({
          data: {
            staffId: testStaff.id,
            month: targetMonth,
            year: targetYear,
            basicSalary: 35000,
            netSalary: 35000,
            status: 'PAID'
          }
        });
      });
    }

    // Fire 2 concurrent salary disbursements for same staff in same month/year
    const salaryResults = await Promise.allSettled([
      disburseSalary(),
      disburseSalary()
    ]);

    const salSuccess = salaryResults.filter(r => r.status === 'fulfilled');
    const salBlocked = salaryResults.filter(r => r.status === 'rejected');

    assert(salSuccess.length === 1, `Exactly 1 salary record created (got ${salSuccess.length})`);
    assert(salBlocked.length === 1, `Duplicate salary disbursement blocked (got ${salBlocked.length})`);

    const countSalaries = await prisma.salaryRecord.count({
      where: { staffId: testStaff.id, month: targetMonth, year: targetYear }
    });
    assert(countSalaries === 1, `Total salary records in DB is exactly 1`);

    // Cleanup salary test records
    await prisma.salaryRecord.deleteMany({ where: { staffId: testStaff.id } });
    await prisma.staff.delete({ where: { id: testStaff.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    // -------------------------------------------------------------
    // Test 19: Supplier Payment Concurrency (Item 19)
    // -------------------------------------------------------------
    console.log('\n--- Testing Item 19: Supplier Payment Concurrency ---');
    const testSupplier = await prisma.pharmacySupplier.create({
      data: {
        companyName: 'Concurrency Pharma Supplier ' + Date.now(),
        payableBalance: 20000
      }
    });

    const testLedger = await prisma.pharmacySupplierLedger.create({
      data: {
        supplierId: testSupplier.id,
        invoiceNo: 'SUP-INV-' + Date.now(),
        totalAmount: 10000,
        paidAmount: 0,
        balance: 10000,
        paymentStatus: 'PENDING'
      }
    });

    async function paySupplier(amt) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'pharm_supp_' + testSupplier.id);

        const ledger = await tx.pharmacySupplierLedger.findUnique({ where: { id: testLedger.id } });
        if (ledger.balance <= 0) {
          throw new Error('Bill is already settled');
        }

        const alloc = Math.min(amt, ledger.balance);
        const newPaid = ledger.paidAmount + alloc;
        const newBal = Math.max(0, ledger.totalAmount - newPaid);

        await tx.pharmacySupplierLedger.update({
          where: { id: testLedger.id },
          data: {
            paidAmount: newPaid,
            balance: newBal,
            paymentStatus: newBal === 0 ? 'PAID' : 'PARTIAL'
          }
        });

        await tx.pharmacySupplier.update({
          where: { id: testSupplier.id },
          data: { payableBalance: { decrement: alloc } }
        });

        return { alloc };
      });
    }

    // Fire 2 concurrent payments of 7000 on a 10000 bill
    const suppPayResults = await Promise.allSettled([
      paySupplier(7000),
      paySupplier(7000)
    ]);

    const finalLedger = await prisma.pharmacySupplierLedger.findUnique({ where: { id: testLedger.id } });
    const finalSupplier = await prisma.pharmacySupplier.findUnique({ where: { id: testSupplier.id } });

    assert(finalLedger.paidAmount === 10000, `Supplier bill paidAmount capped at exactly 10000 (got ${finalLedger.paidAmount})`);
    assert(finalLedger.balance === 0, `Supplier bill balance is 0 without overpayment`);
    assert(finalSupplier.payableBalance === 10000, `Supplier total payableBalance decremented accurately from 20000 to 10000 (got ${finalSupplier.payableBalance})`);

    // Cleanup supplier test records
    await prisma.pharmacySupplierLedger.delete({ where: { id: testLedger.id } });
    await prisma.pharmacySupplier.delete({ where: { id: testSupplier.id } });

    console.log(`\n=== CONCURRENCY TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
