const http = require('http');

function postLogin() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'admin@hospital.com', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getRequest(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const loginRes = await postLogin();
  const token = loginRes.token;
  console.log('Login status:', loginRes.success ? 'SUCCESS' : 'FAILED');

  const patientsRes = await getRequest('/api/patients?limit=5', token);
  const patient = patientsRes.patients?.[0];
  if (patient) {
    console.log(`Checking patient ${patient.name} (${patient.id})...`);
    const singleRes = await getRequest(`/api/patients/${patient.id}`, token);
    console.log('Single patient loaded:', singleRes.success);
    console.log('Refunds array in patient:', Array.isArray(singleRes.patient?.refunds));
    console.log('Total refunded:', singleRes.patient?.totalRefunded);
    console.log('Financial ledger totalRefunded:', singleRes.patient?.financialLedger?.totalRefunded);
    console.log('Financial ledger netGrandTotalPaid:', singleRes.patient?.financialLedger?.netGrandTotalPaid);
  } else {
    console.log('No patients found.');
  }

  const printStatus = await getRequest('/api/print/status', token);
  console.log('Print service online:', printStatus?.success, printStatus?.message);

  // Test POST /api/print/refund-receipt
  const postData = JSON.stringify({
    receiptNo: 'REF-EXP-999999',
    refCode: 'REF-ON-TEST',
    patientName: 'ddk',
    mrn: 'MRN-12345',
    phone: '03001234567',
    amount: 500,
    reason: 'Doctor Delayed / Patient Left',
    itemDescription: 'OPD Consultation Token #1',
    paymentMethod: 'CASH'
  });

  const printRefundRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/print/refund-receipt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(postData);
    req.end();
  });

  console.log('Refund Receipt Print Endpoint Response:', printRefundRes);
}

main().catch(console.error);
