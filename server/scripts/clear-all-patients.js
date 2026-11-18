const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all patients and related patient records from database...');

  // 1. Delete IPD Admissions
  try {
    const ipdAdmCount = await prisma.ipdAdmission.deleteMany({});
    console.log(`Deleted ${ipdAdmCount.count} IPD Admissions.`);
  } catch (e) {
    console.warn('IPD Admissions clear error:', e.message);
  }

  // 2. Delete Surgery Orders
  try {
    const surgeryCount = await prisma.surgeryOrder.deleteMany({});
    console.log(`Deleted ${surgeryCount.count} Surgery Orders.`);
  } catch (e) {
    console.warn('Surgery Orders clear error:', e.message);
  }

  // 3. Delete Lab Orders
  try {
    const labCount = await prisma.labOrder.deleteMany({});
    console.log(`Deleted ${labCount.count} Lab Orders.`);
  } catch (e) {
    console.warn('Lab Orders clear error:', e.message);
  }

  // 4. Delete Medical Service Orders
  try {
    const serviceCount = await prisma.medicalServiceOrder.deleteMany({});
    console.log(`Deleted ${serviceCount.count} Medical Service Orders.`);
  } catch (e) {
    console.warn('Medical Service Orders clear error:', e.message);
  }

  // 5. Delete Pharmacy Sales
  try {
    const pharmacyCount = await prisma.pharmacySale.deleteMany({});
    console.log(`Deleted ${pharmacyCount.count} Pharmacy Sales.`);
  } catch (e) {
    console.warn('Pharmacy Sales clear error:', e.message);
  }

  // 6. Delete Xray Orders
  try {
    const xrayCount = await prisma.xrayOrder.deleteMany({});
    console.log(`Deleted ${xrayCount.count} Xray Orders.`);
  } catch (e) {
    console.warn('Xray Orders clear error:', e.message);
  }

  // 7. Delete Appointments
  try {
    const apptCount = await prisma.appointment.deleteMany({});
    console.log(`Deleted ${apptCount.count} Appointments.`);
  } catch (e) {
    console.warn('Appointments clear error:', e.message);
  }

  // 8. Delete Invoices
  try {
    const invCount = await prisma.invoice.deleteMany({});
    console.log(`Deleted ${invCount.count} Invoices.`);
  } catch (e) {
    console.warn('Invoices clear error:', e.message);
  }

  // 9. Delete Nursery Admissions
  try {
    const nurseryCount = await prisma.nurseryAdmission.deleteMany({});
    console.log(`Deleted ${nurseryCount.count} Nursery Admissions.`);
  } catch (e) {
    console.warn('Nursery Admissions clear error:', e.message);
  }

  // 10. Reset IPD Beds
  try {
    const bedsUpdate = await prisma.ipdBed.updateMany({
      data: {
        status: 'AVAILABLE',
        isOccupied: false,
        admittedAt: null
      }
    });
    console.log(`Reset ${bedsUpdate.count} IPD beds to AVAILABLE.`);
  } catch (e) {
    console.warn('IPD Beds reset error:', e.message);
  }

  // 11. Reset Nursery Incubators
  try {
    const incUpdate = await prisma.nurseryIncubator.updateMany({
      data: {
        status: 'VACANT'
      }
    });
    console.log(`Reset ${incUpdate.count} Nursery Incubators to VACANT.`);
  } catch (e) {
    console.warn('Incubators reset error:', e.message);
  }

  // 12. Delete Patients
  try {
    const patientCount = await prisma.patient.deleteMany({});
    console.log(`Deleted ${patientCount.count} Patients.`);
  } catch (e) {
    console.warn('Patients clear error:', e.message);
  }

  console.log('Successfully cleared all patient data from database!');
}

main()
  .catch((e) => {
    console.error('Error clearing patient data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
