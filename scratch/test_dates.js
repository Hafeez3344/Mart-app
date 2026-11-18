const prisma = require('../server/src/config/prisma');

async function testDates() {
  const apts = await prisma.appointment.findMany({
    select: { id: true, date: true, createdAt: true, paidAmount: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Appointments sample:', apts);

  const labs = await prisma.labOrder.findMany({
    select: { id: true, createdAt: true, paidAmount: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Lab sample:', labs);

  const sales = await prisma.pharmacySale.findMany({
    select: { id: true, createdAt: true, paidAmount: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Pharmacy sales sample:', sales);

  const exp = await prisma.expense.findMany({
    select: { id: true, expenseDate: true, createdAt: true, amount: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Expenses sample:', exp);

  await prisma.$disconnect();
}
testDates();
