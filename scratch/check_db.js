const prisma = require('../server/src/config/prisma');

async function check() {
  const appointments = await prisma.appointment.findMany({ select: { date: true, createdAt: true, consultationFee: true, paidAmount: true } });
  console.log('Appointments count:', appointments.length, appointments.slice(0, 3));

  const labs = await prisma.labOrder.findMany({ select: { createdAt: true, paidAmount: true } });
  console.log('Lab orders count:', labs.length, labs.slice(0, 3));

  const pharmacy = await prisma.pharmacySale.findMany({ select: { createdAt: true, netTotal: true, paidAmount: true } });
  console.log('Pharmacy sales count:', pharmacy.length, pharmacy.slice(0, 3));

  const expenses = await prisma.expense.findMany({ select: { date: true, createdAt: true, amount: true } });
  console.log('Expenses count:', expenses.length, expenses.slice(0, 3));

  const surgeries = await prisma.surgeryOrder.findMany({ select: { createdAt: true, paidAmount: true } });
  console.log('Surgeries count:', surgeries.length, surgeries.slice(0, 3));

  await prisma.$disconnect();
}
check();
