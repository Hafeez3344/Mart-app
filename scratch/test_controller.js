const { getYearlyRevenueReport } = require('../server/src/controllers/billingController');

async function testDirect() {
  const req = {
    query: { year: '2026' },
    user: { id: 'admin', role: 'ADMIN' }
  };
  const res = {
    status: (code) => {
      console.log('Status code:', code);
      return res;
    },
    json: (data) => {
      console.log('Success:', data.success);
      if (data.data) {
        console.log('Year summary:', data.data.yearSummary);
        console.log('Months count:', data.data.months.length);
        data.data.months.forEach(m => {
          if (m.netRevenue > 0 || m.totalExpenses > 0) {
            console.log(`Month ${m.monthNumber} (${m.monthName}): Net Revenue = ${m.netRevenue}, Expenses = ${m.totalExpenses}, OPD = ${m.opdRevenue}, Lab = ${m.labRevenue}, Surgery = ${m.surgeryRevenue}`);
          }
        });
      } else {
        console.log('Data:', data);
      }
    }
  };

  try {
    await getYearlyRevenueReport(req, res);
  } catch (err) {
    console.error('Direct controller call error:', err);
  }
}

testDirect();
