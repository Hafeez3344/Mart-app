import api from './api';
import { printRawBase64ViaWebUsb, printViaWorkstationAgent, isWebUsbPaired, isWorkstationAgentOnline } from './webUsbPrint';

/**
 * Resolves full patient billing history, dynamic hospital settings,
 * itemized categories and balances for both hardware thermal and browser preview.
 */
export const resolveMasterReceiptData = async (optionsOrPatient = {}) => {
  let customHospitalName = '';
  let customHospitalAddress = '';
  let customHospitalPhone = '';
  let patientData = null;
  let appointments = null;
  let serviceOrders = null;
  let xrayOrders = null;
  let surgeryOrders = null;
  let labOrders = null;
  let pharmacySales = null;
  let ipdAdmissions = null;
  let nurseryAdmissions = null;
  let ipdBeds = null;
  let ledger = null;

  if (optionsOrPatient && typeof optionsOrPatient === 'object') {
    if (optionsOrPatient.patient || optionsOrPatient.patientName || optionsOrPatient.patientId) {
      if (optionsOrPatient.patient) {
        patientData = optionsOrPatient.patient;
        customHospitalName = optionsOrPatient.hospitalName || '';
        customHospitalAddress = optionsOrPatient.hospitalAddress || '';
        customHospitalPhone = optionsOrPatient.hospitalPhone || '';
        appointments = optionsOrPatient.appointments;
        xrayOrders = optionsOrPatient.xrayOrders;
        serviceOrders = optionsOrPatient.serviceOrders || optionsOrPatient.medicalServiceOrders;
        surgeryOrders = optionsOrPatient.surgeryOrders;
        labOrders = optionsOrPatient.labOrders;
        pharmacySales = optionsOrPatient.pharmacySales;
        ipdAdmissions = optionsOrPatient.ipdAdmissions;
        nurseryAdmissions = optionsOrPatient.nurseryAdmissions;
        ipdBeds = optionsOrPatient.ipdBeds;
        ledger = optionsOrPatient.ledger;
      } else {
        patientData = optionsOrPatient;
        appointments = optionsOrPatient.appointments;
        xrayOrders = optionsOrPatient.xrayOrders;
        serviceOrders = optionsOrPatient.medicalServiceOrders || optionsOrPatient.serviceOrders;
        surgeryOrders = optionsOrPatient.surgeryOrders || optionsOrPatient.surgeries;
        labOrders = optionsOrPatient.labOrders;
        pharmacySales = optionsOrPatient.pharmacySales;
        ipdAdmissions = optionsOrPatient.ipdAdmissions;
        nurseryAdmissions = optionsOrPatient.nurseryAdmissions;
        ipdBeds = optionsOrPatient.ipdBeds;
        if (optionsOrPatient.hospitalName) customHospitalName = optionsOrPatient.hospitalName;
        if (optionsOrPatient.hospitalAddress) customHospitalAddress = optionsOrPatient.hospitalAddress;
        if (optionsOrPatient.hospitalPhone) customHospitalPhone = optionsOrPatient.hospitalPhone;
      }
    } else {
      patientData = optionsOrPatient;
      appointments = optionsOrPatient.appointments;
      xrayOrders = optionsOrPatient.xrayOrders;
      serviceOrders = optionsOrPatient.medicalServiceOrders || optionsOrPatient.serviceOrders;
      surgeryOrders = optionsOrPatient.surgeryOrders || optionsOrPatient.surgeries;
      labOrders = optionsOrPatient.labOrders;
      pharmacySales = optionsOrPatient.pharmacySales;
      ipdAdmissions = optionsOrPatient.ipdAdmissions;
      nurseryAdmissions = optionsOrPatient.nurseryAdmissions;
      ipdBeds = optionsOrPatient.ipdBeds;
      if (optionsOrPatient.hospitalName) customHospitalName = optionsOrPatient.hospitalName;
      if (optionsOrPatient.hospitalAddress) customHospitalAddress = optionsOrPatient.hospitalAddress;
      if (optionsOrPatient.hospitalPhone) customHospitalPhone = optionsOrPatient.hospitalPhone;
    }
  } else if (typeof optionsOrPatient === 'string') {
    patientData = { id: optionsOrPatient };
  }

  let pObj = { ...(patientData || {}) };

  // 1. Fetch Live Dynamic Hospital Settings
  let hospitalName = customHospitalName;
  let hospitalAddress = customHospitalAddress;
  let hospitalPhone = customHospitalPhone;

  try {
    const setRes = await api.get('/settings');
    if (setRes.data?.success && setRes.data.settings) {
      const s = setRes.data.settings;
      if (!hospitalName || hospitalName === 'DOST & CARE HOSPITAL' || hospitalName === 'CarePulse Hospital & Health System') {
        hospitalName = s.hospitalName || 'CarePulse Hospital';
      }
      if (!hospitalAddress) {
        hospitalAddress = s.locationAddress || s.address || 'Main Hospital Boulevard, Medical District';
      }
      if (!hospitalPhone) {
        hospitalPhone = s.phone || s.contactPhone || s.emergencyContact || '0300-1234567';
      }
    }
  } catch (e) {
    console.warn('Could not load dynamic hospital settings:', e);
  }

  hospitalName = hospitalName || 'Shiffa Hospital Samar Bagh';
  hospitalAddress = hospitalAddress || 'Plot 14, Sector H-8/4, Islamabad, Pakistan';
  hospitalPhone = hospitalPhone || '+92 51 111 222 333';

  // Detect IPD Admission record
  const isIpdAdmissionRecord = Boolean(
    pObj.wardOrRoomName ||
    pObj.bedNo ||
    (pObj.admissionNo && !pObj.incubatorCode) ||
    (pObj.dailyRate && !pObj.incubatorCode && !pObj.babyMrn)
  );
  if (isIpdAdmissionRecord && (!ipdAdmissions || ipdAdmissions.length === 0)) {
    ipdAdmissions = [pObj];
  }

  // Detect Nursery Admission record
  const isNurseryAdmissionRecord = Boolean(
    pObj.incubatorCode ||
    pObj.babyMrn ||
    pObj.motherMrn ||
    pObj.birthWeight ||
    (pObj.admissionNo && (pObj.babyGender || pObj.motherName))
  );
  if (isNurseryAdmissionRecord && (!nurseryAdmissions || nurseryAdmissions.length === 0)) {
    nurseryAdmissions = [pObj];
  }

  // If surgery/lab/service orders are attached directly to pObj:
  if (pObj.surgeryOrder && (!surgeryOrders || surgeryOrders.length === 0)) {
    surgeryOrders = [pObj.surgeryOrder];
  }
  if (Array.isArray(pObj.labOrders) && (!labOrders || labOrders.length === 0)) {
    labOrders = pObj.labOrders;
  }
  if (Array.isArray(pObj.serviceOrders) && (!serviceOrders || serviceOrders.length === 0)) {
    serviceOrders = pObj.serviceOrders;
  }

  // 2. Auto-fetch full patient record if missing relations or when called with lightweight object
  // For IPD admission: pObj.patientId is the patient ID, not pObj.id
  const targetId = isIpdAdmissionRecord
    ? (pObj.patientId || pObj.patient?.id || null)
    : (isNurseryAdmissionRecord ? null : (pObj.patientId || pObj.id));

  // Check if surgery orders are missing or lack fee information
  const needsSurgeryFetch = Boolean(
    targetId && (
      !surgeryOrders ||
      surgeryOrders.length === 0 ||
      surgeryOrders.some(s => s.totalFee === undefined && s.netTotal === undefined && s.procedureFee === undefined)
    )
  );

  const hasAnyOrders = (appointments?.length || 0) + (labOrders?.length || 0) + (serviceOrders?.length || 0) + (xrayOrders?.length || 0) + (pharmacySales?.length || 0) + (surgeryOrders?.length || 0) + (ipdAdmissions?.length || 0) + (nurseryAdmissions?.length || 0);
  const isMissingDeptOrders = !pObj.pharmacySales || !pObj.labOrders || !pObj.medicalServiceOrders || !pObj.xrayOrders || needsSurgeryFetch;

  if (targetId && (hasAnyOrders === 0 || isMissingDeptOrders || !pObj.name || pObj.name === 'PATIENT')) {
    try {
      const mbRes = await api.get(`/patients/${targetId}/master-bill`).catch(() => null);
      if (mbRes?.data?.success) {
        const mb = mbRes.data;
        if (!appointments || appointments.length === 0) appointments = mb.appointments;
        if (needsSurgeryFetch || !surgeryOrders || surgeryOrders.length === 0) surgeryOrders = mb.surgeryOrders;
        if (!labOrders || labOrders.length === 0) labOrders = mb.labOrders;
        if (!serviceOrders || serviceOrders.length === 0) serviceOrders = mb.serviceOrders;
        if (!xrayOrders || xrayOrders.length === 0) xrayOrders = mb.xrayOrders;
        if (!pharmacySales || pharmacySales.length === 0) pharmacySales = mb.pharmacySales;
        if (!ipdAdmissions || ipdAdmissions.length === 0) ipdAdmissions = mb.ipdAdmission ? [mb.ipdAdmission] : [];
        if (!ipdBeds || ipdBeds.length === 0) ipdBeds = mb.ipdBeds;
        if (!nurseryAdmissions || nurseryAdmissions.length === 0) nurseryAdmissions = mb.nurseryAdmissions || [];
      } else {
        const res = await api.get(`/patients/${targetId}`);
        if (res.data?.success && res.data.patient) {
          const fullP = res.data.patient;
          pObj = { ...fullP, ...pObj };
          if (!appointments || appointments.length === 0) appointments = fullP.appointments;
          if (needsSurgeryFetch || !surgeryOrders || surgeryOrders.length === 0) surgeryOrders = fullP.surgeryOrders;
          if (!labOrders || labOrders.length === 0) labOrders = fullP.labOrders;
          if (!serviceOrders || serviceOrders.length === 0) serviceOrders = fullP.medicalServiceOrders || fullP.serviceOrders;
          if (!xrayOrders || xrayOrders.length === 0) xrayOrders = fullP.xrayOrders;
          if (!pharmacySales || pharmacySales.length === 0) pharmacySales = fullP.pharmacySales;
          if (!ipdAdmissions || ipdAdmissions.length === 0) ipdAdmissions = fullP.ipdAdmissions;
          if (!ipdBeds || ipdBeds.length === 0) ipdBeds = fullP.ipdBeds;
          if (!nurseryAdmissions || nurseryAdmissions.length === 0) nurseryAdmissions = fullP.nurseryAdmissions || [];
        }
      }
    } catch (e) {
      console.warn('Auto-fetch patient details for master thermal receipt warning:', e);
    }
  }

  let appts = (appointments && appointments.length > 0) ? appointments : (pObj.appointments || []);
  let labs = (labOrders && labOrders.length > 0) ? labOrders : (pObj.labOrders || []);
  let srvs = (serviceOrders && serviceOrders.length > 0) ? serviceOrders : (pObj.medicalServiceOrders || pObj.serviceOrders || []);
  let xrays = ((xrayOrders && xrayOrders.length > 0) ? xrayOrders : (pObj.xrayOrders || [])).filter(x => x.status !== 'CANCELLED' || x.paymentStatus === 'REFUNDED');
  let pharm = (pharmacySales && pharmacySales.length > 0) ? pharmacySales : (pObj.pharmacySales || []);
  let ipd = (ipdAdmissions && ipdAdmissions.length > 0) ? ipdAdmissions : (pObj.ipdAdmissions || []);
  let beds = (ipdBeds && ipdBeds.length > 0) ? ipdBeds : (pObj.ipdBeds || []);
  let surg = (surgeryOrders && surgeryOrders.length > 0) ? surgeryOrders : (pObj.surgeryOrders || pObj.surgeries || []);
  let nurs = (nurseryAdmissions && nurseryAdmissions.length > 0) ? nurseryAdmissions : (pObj.nurseryAdmissions || []);
  let patientRefunds = Array.isArray(optionsOrPatient?.refunds)
    ? [...optionsOrPatient.refunds]
    : (Array.isArray(pObj.refunds) ? [...pObj.refunds] : []);

  // If refunds not passed, auto-fetch from expenses for this patient
  if (patientRefunds.length === 0 && (pObj.id || pObj.mrn || pObj.name)) {
    try {
      const q = pObj.mrn || pObj.name;
      const refRes = await api.get(`/expenses?category=Patient Refund&search=${encodeURIComponent(q)}`);
      if (refRes.data?.expenses && Array.isArray(refRes.data.expenses)) {
        patientRefunds = refRes.data.expenses.filter(e =>
          e.category === 'Patient Refund' &&
          (
            (pObj.name && e.paidTo?.toLowerCase().includes(pObj.name.toLowerCase())) ||
            (pObj.mrn && e.notes?.includes(pObj.mrn)) ||
            (pObj.name && e.notes?.toLowerCase().includes(pObj.name.toLowerCase()))
          )
        );
      }
    } catch (e) {}
  }

  // Also include any items in appts, labs, srvs that were explicitly marked as REFUNDED
  (appts || []).forEach(a => {
    if (a.paymentStatus === 'REFUNDED' || (a.clinicalNotes && a.clinicalNotes.includes('[REFUNDED'))) {
      const already = patientRefunds.some(r => r.referenceNo?.includes(a.appointmentNo || a.id) || r.notes?.includes(a.appointmentNo || a.id));
      if (!already) {
        const docName = a.doctor?.user?.name ? (a.doctor.user.name.startsWith('Dr.') ? a.doctor.user.name : `Dr. ${a.doctor.user.name}`) : 'OPD Doctor';
        patientRefunds.push({
          receiptNo: `REF-OPD`,
          title: `Refund for OPD Token #${a.tokenNo || '1'} (${docName})`,
          amount: parseFloat(a.consultationFee || 500),
          notes: a.clinicalNotes || 'Token Fee Refunded',
          expenseDate: a.date
        });
      }
    }
  });

  (labs || []).forEach(l => {
    if (l.paymentStatus === 'REFUNDED') {
      const already = patientRefunds.some(r => r.referenceNo?.includes(l.orderNo || l.id) || r.notes?.includes(l.orderNo || l.id));
      if (!already) {
        patientRefunds.push({
          receiptNo: `REF-LAB`,
          title: `Refund for Lab Order #${l.orderNo || 'LAB'}`,
          amount: parseFloat(l.totalFee || l.netTotal || 0),
          notes: l.notes || 'Lab Diagnostics Order Refunded',
          expenseDate: l.createdAt
        });
      }
    }
  });

  (srvs || []).forEach(s => {
    if (s.paymentStatus === 'REFUNDED') {
      const already = patientRefunds.some(r => r.referenceNo?.includes(s.orderNo || s.id) || r.notes?.includes(s.orderNo || s.id));
      if (!already) {
        patientRefunds.push({
          receiptNo: `REF-SERV`,
          title: `Refund for Clinical Service #${s.orderNo || 'SERV'}`,
          amount: parseFloat(s.totalFee || s.netTotal || 0),
          notes: s.notes || 'Clinical Service Order Refunded',
          expenseDate: s.createdAt
        });
      }
    }
  });

  (xrays || []).forEach(x => {
    if (x.paymentStatus === 'REFUNDED') {
      const already = patientRefunds.some(r => r.referenceNo?.includes(x.orderNo || x.id) || r.notes?.includes(x.orderNo || x.id));
      if (!already) {
        patientRefunds.push({
          receiptNo: `REF-XRAY`,
          title: `Refund for X-Ray Order #${x.orderNo || 'XRAY'}`,
          amount: parseFloat(x.paidAmount || x.netTotal || x.fee || 0),
          notes: 'X-Ray Order Refunded',
          expenseDate: x.createdAt
        });
      }
    }
  });

  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let pName = (pObj.name || pObj.patientName || '').toUpperCase();
  if (isNurseryAdmissionRecord || pObj.babyName || pObj.motherName) {
    pName = (pObj.babyName || (pObj.motherName ? `B/O ${pObj.motherName}` : 'NURSERY BABY')).toUpperCase();
  }
  if (!pName) pName = 'PATIENT';

  let mrn = pObj.mrn || 'N/A';
  if (isNurseryAdmissionRecord && pObj.babyMrn) {
    mrn = pObj.babyMrn;
  }

  let phone = pObj.phone || pObj.motherPhone || pObj.fatherPhone || 'N/A';

  let grandBilled = 0;
  let grandPaid = 0;
  let totalOrderDiscounts = 0;
  const categories = [];

  // Precise categorization helper
  const isProcedure = (a) => a && (a.type === 'PROCEDURE' || (a.clinicalNotes && a.clinicalNotes.startsWith('PROCEDURE:')));
  const isSurgery = (a) => a && !isProcedure(a) && (a.type === 'SURGERY' || (a.clinicalNotes && (a.clinicalNotes.startsWith('SURGERY:') || a.clinicalNotes.toLowerCase().includes('surgery') || a.clinicalNotes.toLowerCase().includes('operation'))));

  // 1. OPD CONSULTATIONS
  // Exclude REFUNDED appointments — they appear in category 8 (CASH REFUNDS) instead.
  const opdList = appts.filter(a =>
    !isProcedure(a) &&
    !isSurgery(a) &&
    a.status !== 'CANCELLED' &&
    a.status !== 'NO_SHOW' &&
    a.paymentStatus !== 'REFUNDED' &&
    (a.paymentStatus === 'PAID' || a.status === 'COMPLETED' || (a.paidAmount && parseFloat(a.paidAmount) > 0) || (optionsOrPatient.appointments && optionsOrPatient.appointments.length > 0))
  );

  if (opdList.length > 0) {
    const catItems = [];
    opdList.forEach((a) => {
      const docName = a.doctor?.user?.name ? (a.doctor.user.name.startsWith('Dr.') ? a.doctor.user.name : `Dr. ${a.doctor.user.name}`) : 'Consultant Doctor';
      const fee = parseFloat(a.consultationFee || 500);
      const disc = parseFloat(a.discountAmount || a.discount || 0);
      totalOrderDiscounts += disc;
      const netFee = Math.max(0, fee - disc);
      // REFUNDED: patient originally paid — count it toward grandPaid. Refund tracked separately.
      const pAmt = (a.paymentStatus === 'PAID' || a.paymentStatus === 'REFUNDED' || (a.paidAmount && parseFloat(a.paidAmount) >= netFee)) ? netFee : parseFloat(a.paidAmount || 0);
      grandBilled += fee;
      grandPaid += pAmt;
      catItems.push({ name: docName, price: fee });
    });
    categories.push({ title: '1. OPD CONSULTATIONS', items: catItems });
  }

  // 2. CLINICAL SERVICES & PROCEDURES
  // Exclude REFUNDED items from the services list — they appear in category 8 (CASH REFUNDS) instead.
  const allServices = [...srvs, ...appts.filter(a => isProcedure(a))].filter(s => s.paymentStatus !== 'REFUNDED');
  if (allServices.length > 0) {
    const catItems = [];
    allServices.forEach((s) => {
      let servItems = [];
      if (Array.isArray(s.services)) {
        servItems = s.services;
      } else if (typeof s.servicesJson === 'string') {
        try { servItems = JSON.parse(s.servicesJson || '[]'); } catch (e) { servItems = []; }
      } else if (Array.isArray(s.servicesJson)) {
        servItems = s.servicesJson;
      }

      const disc = parseFloat(s.discountAmount || s.discount || 0);
      totalOrderDiscounts += disc;
      const totalServFee = parseFloat(s.totalFee || ((parseFloat(s.netTotal || 0)) + disc) || s.fee || s.consultationFee || 0);
      const servNet = parseFloat(s.netTotal || Math.max(0, totalServFee - disc));
      const perServPrice = servItems.length > 0 ? (totalServFee / servItems.length) : totalServFee;

      if (servItems.length > 0) {
        servItems.forEach(item => {
          const sName = typeof item === 'string' ? item : (item.name || item.serviceName || item.title || 'Clinical Service');
          const sFee = (typeof item === 'object' && item.fee) ? parseFloat(item.fee) : perServPrice;
          grandBilled += sFee;
          catItems.push({ name: sName, price: sFee });
        });
        // REFUNDED items: patient originally paid — count paidAmount in grandPaid.
        // The refund deduction is handled separately in totalRefunds/netPaidCash.
        if (s.paymentStatus === 'PAID' || s.paymentStatus === 'REFUNDED' || s.isPaid) {
          grandPaid += servNet;
        } else if (s.paidAmount !== undefined && s.paidAmount !== null) {
          grandPaid += Math.min(servNet, parseFloat(s.paidAmount || 0));
        }
      } else {
        const title = s.serviceName || s.name || s.clinicalNotes?.replace(/^PROCEDURE:\s*/i, '') || 'Clinical Service';
        const fee = totalServFee;
        // REFUNDED: patient paid originally — count it, refund tracked separately.
        const pAmt = (s.paymentStatus === 'PAID' || s.paymentStatus === 'REFUNDED' || s.isPaid || (s.paidAmount && parseFloat(s.paidAmount) >= servNet)) ? servNet : parseFloat(s.paidAmount || 0);
        grandBilled += fee;
        grandPaid += pAmt;
        catItems.push({ name: title, price: fee });
      }
    });
    if (catItems.length > 0) {
      categories.push({ title: '2. CLINICAL SERVICES & PROCEDURES', items: catItems });
    }
  }

  // 3. SURGERY & OT OPERATIONS
  const allSurgeries = [...surg, ...appts.filter(a => isSurgery(a))];
  if (allSurgeries.length > 0) {
    const catItems = [];
    allSurgeries.forEach((sg) => {
      const title = sg.surgeryName || sg.name || sg.procedureName || sg.clinicalNotes?.replace(/^SURGERY:\s*/i, '') || 'Surgical Operation';
      const disc = parseFloat(sg.discountAmount || sg.discount || 0);
      totalOrderDiscounts += disc;
      const fee = parseFloat(
        sg.totalFee ||
        ((parseFloat(sg.netTotal || 0)) + disc) ||
        sg.procedureFee ||
        ((parseFloat(sg.surgeonFee || 0) + parseFloat(sg.otFee || 0) + parseFloat(sg.anesthesiaFee || 0) + parseFloat(sg.hospitalFee || 0) + parseFloat(sg.otaFee || 0))) ||
        sg.fee ||
        sg.consultationFee ||
        0
      );
      const surgNet = parseFloat(sg.netTotal || Math.max(0, fee - disc));
      const surgPaidRaw = parseFloat(sg.paidAmount !== undefined && sg.paidAmount !== null ? sg.paidAmount : 0);
      const isSurgPaid = (sg.paymentStatus === 'PAID' && (surgPaidRaw >= surgNet || surgNet === 0)) || (surgPaidRaw >= surgNet && surgNet > 0);
      const pAmt = isSurgPaid ? surgNet : Math.min(surgNet, Math.max(0, surgPaidRaw));
      grandBilled += fee;
      grandPaid += pAmt;
      catItems.push({ name: title, price: fee });
    });
    if (catItems.length > 0) {
      categories.push({ title: '3. SURGERY & OT OPERATIONS', items: catItems });
    }
  }

  // 4. LABORATORY DIAGNOSTIC TESTS
  if (labs.length > 0) {
    const catItems = [];
    labs.forEach((l) => {
      let testItems = [];
      if (Array.isArray(l.tests)) {
        testItems = l.tests;
      } else if (typeof l.testsJson === 'string') {
        try { testItems = JSON.parse(l.testsJson || '[]'); } catch (e) { testItems = []; }
      } else if (Array.isArray(l.testsJson)) {
        testItems = l.testsJson;
      }

      const disc = parseFloat(l.discountAmount || l.discount || 0);
      totalOrderDiscounts += disc;
      const totalLabOrderFee = parseFloat(l.totalFee || ((parseFloat(l.netTotal || 0)) + disc) || l.fee || 0);
      const labNet = parseFloat(l.netTotal || Math.max(0, totalLabOrderFee - disc));
      const perTestPrice = testItems.length > 0 ? (totalLabOrderFee / testItems.length) : totalLabOrderFee;

      if (testItems.length > 0) {
        testItems.forEach(t => {
          const tName = typeof t === 'string' ? t : (t.name || t.testName || 'Lab Test');
          const tFee = (typeof t === 'object' && (t.fee !== undefined || t.price !== undefined || t.cost !== undefined))
            ? parseFloat(t.fee ?? t.price ?? t.cost ?? 0)
            : perTestPrice;
          grandBilled += tFee;
          catItems.push({ name: tName, price: tFee });
        });
        // REFUNDED: patient originally paid — count it. Refund tracked separately.
        if (l.paymentStatus === 'PAID' || l.paymentStatus === 'REFUNDED' || l.isPaid) {
          grandPaid += labNet;
        } else if (l.paidAmount !== undefined && l.paidAmount !== null) {
          grandPaid += Math.min(labNet, parseFloat(l.paidAmount || 0));
        }
      } else {
        const title = l.testName || 'Diagnostic Test Order';
        const fee = totalLabOrderFee;
        grandBilled += fee;
        // REFUNDED: patient originally paid — count it. Refund tracked separately.
        const pAmt = (l.paymentStatus === 'PAID' || l.paymentStatus === 'REFUNDED' || l.isPaid || (l.paidAmount && parseFloat(l.paidAmount) >= labNet)) ? labNet : parseFloat(l.paidAmount || 0);
        grandPaid += pAmt;
        catItems.push({ name: title, price: fee });
      }
    });
    if (catItems.length > 0) {
      categories.push({ title: '4. LABORATORY DIAGNOSTIC TESTS', items: catItems });
    }
  }

  // 4B. X-RAY SCANS
  const xrayActive = xrays.filter(x =>
    x.paymentStatus !== 'REFUNDED' &&
    (parseFloat(x.fee || x.totalFee || x.netTotal || 0) > 0 || parseFloat(x.paidAmount || 0) > 0)
  );
  if (xrayActive.length > 0) {
    const catItems = [];
    xrayActive.forEach((x) => {
      const disc = parseFloat(x.discountAmount || x.discount || 0);
      totalOrderDiscounts += disc;
      const fee = parseFloat(x.fee || x.totalFee || ((parseFloat(x.netTotal || 0)) + disc) || 0);
      const net = parseFloat(x.netTotal !== undefined && x.netTotal !== null ? x.netTotal : Math.max(0, fee - disc));
      const paidRaw = parseFloat(x.paidAmount !== undefined && x.paidAmount !== null ? x.paidAmount : 0);
      const pAmt = (x.paymentStatus === 'PAID' && paidRaw <= 0) ? net : Math.min(net, Math.max(0, paidRaw));
      grandBilled += fee;
      grandPaid += pAmt;
      const scanQty = Math.max(1, parseInt(x.quantity || x.qty || 1, 10) || 1);
      catItems.push({
        name: `${x.scanType || 'X-Ray'}${x.bodyPart ? ` (${x.bodyPart})` : ''}`,
        qty: scanQty,
        price: fee
      });
    });
    if (catItems.length > 0) {
      categories.push({ title: '4B. X-RAY SCANS', items: catItems });
    }
  }

  // 5. PHARMACY MEDICINES DISPENSED
  if (pharm.length > 0) {
    const catItems = [];
    pharm.forEach((sale) => {
      const saleItems = sale.items || [];
      const disc = parseFloat(sale.discount || sale.discountAmount || 0);
      totalOrderDiscounts += disc;
      const isPaid = sale.status === 'PAID' || sale.paymentStatus === 'PAID';

      if (saleItems.length > 0) {
        let saleSubtotal = 0;
        saleItems.forEach((item) => {
          const medName = item.medicineName || item.name || 'Medicine';
          const qty = item.quantity || 1;
          const uPrice = parseFloat(item.unitPrice || 0);
          const totalItemFee = parseFloat(item.totalPrice || (qty * uPrice));
          saleSubtotal += totalItemFee;
          grandBilled += totalItemFee;
          catItems.push({
            name: medName,
            qty: qty,
            unitPrice: uPrice,
            price: totalItemFee
          });
        });
        const saleNet = parseFloat(sale.netTotal !== undefined ? sale.netTotal : Math.max(0, saleSubtotal - disc));
        if (isPaid) {
          grandPaid += saleNet;
        } else if (sale.paidAmount !== undefined && sale.paidAmount !== null) {
          grandPaid += Math.min(saleNet, parseFloat(sale.paidAmount || 0));
        }
      } else {
        const grossFee = parseFloat(sale.subtotal || ((parseFloat(sale.netTotal || 0)) + disc) || 0);
        const saleNet = parseFloat(sale.netTotal !== undefined ? sale.netTotal : Math.max(0, grossFee - disc));
        grandBilled += grossFee;
        const pAmt = isPaid ? saleNet : Math.min(saleNet, parseFloat(sale.paidAmount || 0));
        grandPaid += pAmt;
        catItems.push({ name: 'Pharmacy Prescription Dispense', qty: 1, unitPrice: grossFee, price: grossFee });
      }
    });
    if (catItems.length > 0) {
      categories.push({ title: '5. PHARMACY MEDICINES DISPENSED', isPharmacy: true, items: catItems });
    }
  }

  // Helper to identify any nursery or NICU admission records
  const isNurseryAdm = (a) => {
    if (!a) return false;
    if (a.admissionType === 'NURSERY') return true;
    const w = (a.wardOrRoomName || a.ward?.name || '').toLowerCase();
    if (w.includes('nursery') || w.includes('nicu')) return true;
    const b = (a.bedNo || a.incubatorCode || a.name || '').toUpperCase();
    if (b.startsWith('INC')) return true;
    if (a.babyMrn || a.motherMrn || a.incubatorCode) return true;
    return false;
  };

  // 6. INPATIENT WARD BED & ROOM CHARGES (Exclude Nursery / NICU)
  const validIpdAdmissions = ipd.filter(adm => {
    return adm && !isNurseryAdm(adm) && (adm.wardOrRoomName || adm.bedNo || adm.admissionNo || adm.dailyRate);
  });

  const validBeds = beds.filter(b => {
    const bNo = (b.bedNo || b.name || '').trim().toLowerCase();
    return bNo && !isNurseryAdm(b) && !bNo.includes('pending') && bNo !== 'n/a';
  });

  if (validIpdAdmissions.length > 0 || validBeds.length > 0) {
    const catItems = [];
    if (validIpdAdmissions.length > 0) {
      validIpdAdmissions.forEach((adm) => {
        const days = Math.max(1, adm.totalDays || Math.ceil((new Date() - new Date(adm.admittedAt || adm.createdAt || Date.now())) / (1000 * 60 * 60 * 24)));
        const rate = parseFloat(adm.dailyRate || 2500);
        const bill = parseFloat(adm.totalBill || adm.bedCost) || (days * rate);
        const disc = parseFloat(adm.discountAmount || adm.discount || 0);
        totalOrderDiscounts += disc;
        const netBill = Math.max(0, bill - disc);
        const admPaidRaw = parseFloat(adm.paidAmount !== undefined && adm.paidAmount !== null ? adm.paidAmount : (adm.advanceDeposit || 0));
        const isAdmPaid = (adm.paymentStatus === 'PAID' && (admPaidRaw >= netBill || netBill === 0)) || (admPaidRaw >= netBill && netBill > 0);
        const pAmt = isAdmPaid ? netBill : Math.min(netBill, Math.max(0, admPaidRaw));
        grandBilled += bill;
        grandPaid += pAmt;
        const loc = adm.bedNo ? `${adm.wardOrRoomName || 'Ward'} (${adm.bedNo})` : (adm.wardOrRoomName || 'Inpatient Room');
        catItems.push({ name: `Ward Stay: ${loc} ${days}D @ Rs.${rate}`, qty: 1, price: bill });
      });
    } else {
      validBeds.forEach((b) => {
        const days = b.admittedAt ? Math.max(1, Math.ceil((new Date() - new Date(b.admittedAt)) / (1000 * 60 * 60 * 24))) : 1;
        const rate = parseFloat(b.dailyRate || 2500);
        const bill = days * rate;
        const disc = parseFloat(b.discountAmount || b.discount || 0);
        totalOrderDiscounts += disc;
        const netBill = Math.max(0, bill - disc);
        const bedPaidRaw = parseFloat(b.paidAmount !== undefined && b.paidAmount !== null ? b.paidAmount : (b.advanceDeposit || 0));
        const isBedPaid = (b.paymentStatus === 'PAID' && (bedPaidRaw >= netBill || netBill === 0)) || (bedPaidRaw >= netBill && netBill > 0);
        const pAmt = isBedPaid ? netBill : Math.min(netBill, Math.max(0, bedPaidRaw));
        grandBilled += bill;
        grandPaid += pAmt;
        catItems.push({ name: `Ward Bed (${b.bedNo || b.name || 'ROOM'}) ${days}D @ Rs.${rate}`, qty: 1, price: bill });
      });
    }
    if (catItems.length > 0) {
      categories.push({ title: '6. INPATIENT WARD BED & ROOM CHARGES', items: catItems });
    }
  }

  // 7. NURSARY INCUBATOR CARE (NICU / Nursery Admissions & Incubator mirror stays)
  const allNurs = [...nurs];
  [...ipd, ...beds].forEach(adm => {
    if (isNurseryAdm(adm) && !allNurs.some(n => (n.id && n.id === adm.id) || (n.admissionNo && n.admissionNo === adm.admissionNo))) {
      allNurs.push(adm);
    }
  });

  if (allNurs.length > 0) {
    const catItems = [];
    allNurs.forEach((n) => {
      const elapsedDays = Math.max(1, Math.ceil((new Date(n.checkOutTime || Date.now()) - new Date(n.checkInTime || n.admittedAt || n.createdAt || Date.now())) / (1000 * 60 * 60 * 24)));
      const days = n.daysInNicu || n.totalDays || elapsedDays;
      const rate = parseFloat(n.dailyRate || 3500);
      const gross = parseFloat(n.totalCharges || n.gross || n.totalBill || (days * rate));
      const disc = parseFloat(n.discountAmount || n.discount || 0);
      totalOrderDiscounts += disc;
      const bill = Math.max(0, gross - disc);
      const nPaidRaw = parseFloat(n.paidAmount !== undefined && n.paidAmount !== null ? n.paidAmount : (n.paid || n.advanceDeposit || 0));
      const isPaid = n.paymentStatus === 'PAID' || n.paymentStatus === 'FULL_PAID' || (nPaidRaw >= bill && bill > 0);
      const pAmt = isPaid ? bill : Math.min(bill, Math.max(0, nPaidRaw));
      grandBilled += gross;
      grandPaid += pAmt;
      const incCode = n.incubatorCode || n.bedNo || 'INC-COT';
      catItems.push({
        name: `Nursary Incubator Care (${incCode}) ${days}D @ Rs.${rate}`,
        qty: 1,
        price: gross
      });
    });
    if (catItems.length > 0) {
      categories.push({ title: '7. NURSARY INCUBATOR CARE', items: catItems });
    }
  }

  // 8. PATIENT CASH REFUNDS & REVERSALS
  let totalRefunds = 0;
  if (patientRefunds && patientRefunds.length > 0) {
    const catItems = [];
    patientRefunds.forEach((r) => {
      const amt = Math.abs(parseFloat(r.amount || 0));
      if (amt <= 0) return;
      totalRefunds += amt;
      const refTitle = r.title || r.itemDescription || r.notes?.split('.')[0] || 'Patient Cash Refund';
      const refCode = (r.receiptNo || r.referenceNo || r.refCode) ? ` [${r.receiptNo || r.referenceNo || r.refCode}]` : '';
      catItems.push({
        name: `[REFUND] ${refTitle}${refCode}`,
        qty: 1,
        price: -amt,
        isRefund: true
      });
    });
    if (catItems.length > 0) {
      categories.push({
        title: '8. CASH REFUNDS & REVERSALS',
        isRefund: true,
        items: catItems
      });
    }
  }

  // Ledger override if provided
  let departmentDiscounts = totalOrderDiscounts;
  let masterDiscount = 0;
  if (optionsOrPatient?.departmentDiscounts !== undefined && optionsOrPatient.departmentDiscounts !== null) {
    departmentDiscounts = parseFloat(optionsOrPatient.departmentDiscounts || 0);
  } else if (ledger?.departmentDiscounts !== undefined && ledger.departmentDiscounts !== null) {
    departmentDiscounts = parseFloat(ledger.departmentDiscounts || 0);
  }

  if (optionsOrPatient?.masterDiscount !== undefined && optionsOrPatient.masterDiscount !== null) {
    masterDiscount = parseFloat(optionsOrPatient.masterDiscount || 0);
  } else if (ledger?.masterDiscount !== undefined && ledger.masterDiscount !== null) {
    masterDiscount = parseFloat(ledger.masterDiscount || 0);
  }

  let discount = departmentDiscounts + masterDiscount;
  if (optionsOrPatient && optionsOrPatient.discount !== undefined && optionsOrPatient.discount !== null) {
    const directDisc = parseFloat(optionsOrPatient.discount || 0);
    if (directDisc > discount) {
      masterDiscount = Math.max(0, directDisc - departmentDiscounts);
      discount = directDisc;
    }
  }
  if (ledger && ledger.discount !== undefined && ledger.discount !== null) {
    const lDisc = parseFloat(ledger.discount || 0);
    if (lDisc > discount) {
      masterDiscount = Math.max(0, lDisc - departmentDiscounts);
      discount = lDisc;
    }
  }

  const netBilled = Math.max(0, grandBilled - discount);
  grandPaid = Math.min(grandPaid, netBilled);
  const netPaidCash = Math.max(0, grandPaid - totalRefunds);
  // Outstanding = what the patient still owes (NOT affected by refunds).
  // Refunds reduce cash in hand, not the outstanding balance.
  // e.g. Patient paid Rs.500 → outstanding 0. Refund Rs.500 → cash=0, outstanding still 0.
  const netOutstandingDue = Math.max(0, netBilled - grandPaid);

  return {
    hospitalName,
    hospitalAddress,
    hospitalPhone,
    patient: pObj,
    targetId,
    pName,
    mrn,
    phone,
    dateStr,
    categories,
    grandBilled,
    grandPaid,
    totalRefunds,
    netPaidCash,
    netBilled,
    netOutstandingDue,
    discount,
    departmentDiscounts,
    masterDiscount,
    refunds: patientRefunds,
    paymentMethod: ledger?.paymentMethod || 'CASH'
  };
};

/**
 * Master Patient Billing Thermal Receipt Print Generator (80mm Thermal Roll Format)
 * Comprehensive itemized breakdown strictly matching reference receipt image.
 */
export const printMasterReceiptPdf = async (optionsOrPatient = {}) => {
  // 1. Open browser tab synchronously at event entry point to bypass popup blockers
  let passedWindow = null;
  if (optionsOrPatient && typeof optionsOrPatient === 'object' && optionsOrPatient.printWindow) {
    passedWindow = optionsOrPatient.printWindow;
  }
  const printWin = passedWindow || window.open('', '_blank');
  if (!printWin) {
    alert('Pop-up blocked. Please allow pop-ups to print master receipts.');
    return { success: false, error: 'POPUP_BLOCKED' };
  }

  // Write immediate initial response so browser window opens instantly (0ms latency)
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generating Master Receipt...</title>
      <style>
        body { font-family: monospace; padding: 25px; text-align: center; color: #1e3a8a; font-size: 11px; }
      </style>
    </head>
    <body>
      <div style="font-weight:900;font-size:13px;margin-bottom:6px;">Shiffa Hospital Samar Bagh</div>
      <div>Loading Master Itemized Billing Receipt...</div>
    </body>
    </html>
  `);

  try {
    const data = await resolveMasterReceiptData(optionsOrPatient);
    const {
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      pName,
      mrn,
      phone,
      dateStr,
      categories,
      grandBilled,
      grandPaid,
      totalRefunds,
      netPaidCash,
      netOutstandingDue,
      discount,
      departmentDiscounts = 0,
      masterDiscount = 0
    } = data;

    // Build Exact 1:1 ESC/POS Box-Drawing Master Receipt
    const H = '─', V = '│', TL = '┌', TR = '┐', BL = '└', BR = '┘', L = '├', R = '┤', C = '┼', T = '┬', B = '┴';
    const W = 42;
    const W1 = 24, W2 = 5, W3 = 11;

    const border = (w, type) => {
      if (type === 'top') return TL + H.repeat(w) + TR;
      if (type === 'bottom') return BL + H.repeat(w) + BR;
      return L + H.repeat(w) + R;
    };
    const div3 = (type) => {
      if (type === 'top') return TL + H.repeat(W1) + T + H.repeat(W2) + T + H.repeat(W3) + TR;
      if (type === 'bottom') return BL + H.repeat(W1) + B + H.repeat(W2) + B + H.repeat(W3) + BR;
      return L + H.repeat(W1) + C + H.repeat(W2) + C + H.repeat(W3) + R;
    };
    const text = (s, align = 'center') => {
      const str = String(s || '').slice(0, W);
      if (align === 'center') {
        const lp = Math.floor((W - str.length) / 2);
        const rp = W - str.length - lp;
        return V + ' '.repeat(Math.max(0, lp)) + str + ' '.repeat(Math.max(0, rp)) + V;
      }
      return V + ' ' + str.padEnd(W - 1, ' ') + V;
    };
    const twoCol = (c1, c2) => {
      const s1 = (' ' + String(c1 || '')).slice(0, 22).padEnd(22, ' ');
      const s2 = (' ' + String(c2 || '')).slice(0, 19).padEnd(19, ' ');
      return V + s1 + V + s2 + V;
    };
    const threeCol = (c1, c2, c3) => {
      const s1 = (' ' + String(c1 || '')).slice(0, W1).padEnd(W1, ' ');
      const s2 = String(c2 || '').slice(0, W2).padStart(W2, ' ');
      const s3 = (String(c3 || '') + ' ').slice(0, W3).padStart(W3, ' ');
      return V + s1 + V + s2 + V + s3 + V;
    };
    const totalsRow = (label, val) => {
      const l = (' ' + String(label || '')).slice(0, 30).padEnd(30, ' ');
      const v = (String(val || '') + ' ').slice(0, 11).padStart(11, ' ');
      return V + l + V + v + V;
    };

    const lines = [];
    lines.push(border(W, 'top'));
    lines.push(text(`[+] ${hospitalName.toUpperCase()} [+]`, 'center'));
    if (hospitalAddress) lines.push(text(hospitalAddress, 'center'));
    if (hospitalPhone) lines.push(text(`Ph: ${hospitalPhone}`, 'center'));
    lines.push(border(W, 'middle'));
    lines.push(text('PATIENT MASTER BILLING RECEIPT', 'center'));
    lines.push(border(W, 'middle'));
    lines.push(twoCol(`Patient: ${String(pName).slice(0, 13)}`, `MRN: ${mrn}`));
    lines.push(twoCol(`Phone: ${phone || 'N/A'}`, `Date: ${String(dateStr).slice(0, 13)}`));
    lines.push(div3('middle'));
    lines.push(threeCol('ITEM / DESCRIPTION', 'QTY', 'PRICE'));
    lines.push(div3('middle'));

    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach(cat => {
        lines.push(text(cat.title, 'left'));
        lines.push(div3('middle'));
        (cat.items || []).forEach(item => {
          const name = item.name || 'Item';
          const rawQty = item.qty !== undefined && item.qty !== null ? item.qty : (item.quantity !== undefined && item.quantity !== null ? item.quantity : 1);
          const numQty = parseInt(rawQty, 10);
          const qty = String(isNaN(numQty) || numQty <= 0 ? 1 : numQty);
          const p = Number(item.price || 0);
          const priceStr = p < 0 ? `-Rs.${Math.abs(p).toFixed(0)}` : `Rs.${p.toFixed(0)}`;
          if (name.length <= 22) {
            lines.push(threeCol(name, qty, priceStr));
          } else {
            lines.push(threeCol(name.slice(0, 22), qty, priceStr));
            lines.push(threeCol(name.slice(22, 44), '', ''));
          }
        });
        lines.push(div3('middle'));
      });
    } else {
      lines.push(text('1. GENERAL HOSPITAL SERVICES', 'left'));
      lines.push(div3('middle'));
      lines.push(threeCol('Consolidated Services', '1', `Rs.${Number(grandBilled).toFixed(0)}`));
      lines.push(div3('middle'));
    }

    lines.push(totalsRow('GROSS BILLED:', `Rs.${Number(grandBilled).toFixed(0)}`));
    if (Number(departmentDiscounts) > 0 && Number(masterDiscount) > 0) {
      lines.push(totalsRow('DEPT DISCOUNTS:', `-Rs.${Number(departmentDiscounts).toFixed(0)}`));
      lines.push(totalsRow('MASTER CONCESSION:', `-Rs.${Number(masterDiscount).toFixed(0)}`));
      lines.push(totalsRow('TOTAL CONCESSION:', `-Rs.${Number(discount).toFixed(0)}`));
      lines.push(totalsRow('NET PAYABLE:', `Rs.${Number(grandBilled - discount).toFixed(0)}`));
    } else if (Number(departmentDiscounts) > 0) {
      lines.push(totalsRow('DEPT DISCOUNTS:', `-Rs.${Number(departmentDiscounts).toFixed(0)}`));
      lines.push(totalsRow('NET PAYABLE:', `Rs.${Number(grandBilled - discount).toFixed(0)}`));
    } else if (Number(masterDiscount) > 0) {
      lines.push(totalsRow('MASTER CONCESSION:', `-Rs.${Number(masterDiscount).toFixed(0)}`));
      lines.push(totalsRow('NET PAYABLE:', `Rs.${Number(grandBilled - discount).toFixed(0)}`));
    } else if (Number(discount) > 0) {
      lines.push(totalsRow('DISCOUNT CONCESSION:', `-Rs.${Number(discount).toFixed(0)}`));
      lines.push(totalsRow('NET PAYABLE:', `Rs.${Number(grandBilled - discount).toFixed(0)}`));
    }
    lines.push(totalsRow('TOTAL PAID:', `Rs.${Number(grandPaid).toFixed(0)}`));
    if (Number(totalRefunds) > 0) {
      lines.push(totalsRow('LESS REFUNDS ISSUED:', `-Rs.${Number(totalRefunds).toFixed(0)}`));
      lines.push(totalsRow('NET CASH COLLECTED:', `Rs.${Number(netPaidCash).toFixed(0)}`));
    }
    lines.push(totalsRow('OUTSTANDING DUE:', `Rs.${Number(netOutstandingDue).toFixed(0)}`));
    lines.push(border(W, 'middle'));
    lines.push(text('Thank you for choosing', 'center'));
    lines.push(text(`${hospitalName}!`, 'center'));
    lines.push(text('Wish you good health.', 'center'));
    lines.push(border(W, 'bottom'));

    const asciiReceiptText = lines.join('\n');

    const documentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Master Thermal Receipt - ${mrn}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0 auto !important;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .receipt-wrapper {
        width: 78mm !important;
        margin: 0 auto !important;
        padding: 2px 0 !important;
        display: flex !important;
        justify-content: center !important;
      }
      pre.escpos-receipt {
        font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
        font-size: 13.5px !important;
        line-height: 1.18 !important;
        font-weight: 700 !important;
        color: #000 !important;
        white-space: pre !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html {
      background: #f1f5f9;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12px 0;
    }
    body {
      background: #fff;
      color: #000;
      margin: 0 auto;
      padding: 4px;
    }
    .receipt-wrapper {
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      display: flex;
      justify-content: center;
    }
    pre.escpos-receipt {
      font-family: 'Courier New', Courier, 'Lucida Console', monospace;
      font-size: 13.5px;
      line-height: 1.18;
      font-weight: 700;
      letter-spacing: 0.1px;
      color: #000;
      white-space: pre;
      margin: 0 auto;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper">
    <pre class="escpos-receipt">${asciiReceiptText}</pre>
  </div>

  <script>
    setTimeout(function() {
      window.focus();
      window.print();
    }, 350);
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(documentHtml);
    printWin.document.close();
    printWin.focus();

    try {
      printWin.onafterprint = () => {
        try { printWin.close(); } catch(e) {}
      };
    } catch(e) {}

    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch(e) {}
    }, 400);

    return { success: true, method: 'browser' };
  } catch (err) {
    console.error('Master thermal receipt print error:', err);
    alert('Failed to launch master thermal receipt print window.');
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware TCP/IP Network Thermal Printing for Master Receipt
 * Sends ESC/POS itemized breakdown directly to network thermal printer.
 * Seamlessly falls back to browser preview print if network printer is offline.
 */
export const printMasterReceiptNetworkThermal = async (optionsOrPatient = {}, forceBrowserPrint = false) => {
  if (!forceBrowserPrint) {
    try {
      const data = await resolveMasterReceiptData(optionsOrPatient);

      // Resolve hardware thermal printer configuration
      let targetPrinter = optionsOrPatient?.printerIp;
      let config = null;
      if (typeof window !== 'undefined') {
        targetPrinter = localStorage.getItem('hms_target_frontdesk');
        try {
          const fSaved = localStorage.getItem('hms_printer_frontdesk') || localStorage.getItem('hms_printer_workstation');
          if (fSaved) config = JSON.parse(fSaved);
        } catch (e) {}
        if (!targetPrinter) {
          targetPrinter = localStorage.getItem('hms_workstation_printer');
        }
      }

      let isWebUsb = config?.mode === 'WEBUSB' || (!config?.mode && isWebUsbPaired());
      let isAgent = config?.mode === 'LOCAL_AGENT';

      // Auto-detect local workstation printer bridge if running on localhost:5005
      if (!isWebUsb && !isAgent && (!config?.mode || config?.mode === 'USB')) {
        try {
          const agentActive = await isWorkstationAgentOnline();
          if (agentActive) {
            isAgent = true;
          }
        } catch (e) {}
      }

      const netRes = await api.post('/print/master-receipt', {
        patientId: data.targetId,
        receiptNo: `REC-${Date.now().toString().slice(-6)}`,
        patientName: data.pName,
        mrn: data.mrn,
        phone: data.phone,
        categories: data.categories,
        subtotal: data.grandBilled,
        discount: data.discount,
        departmentDiscounts: data.departmentDiscounts || 0,
        masterDiscount: data.masterDiscount || 0,
        netTotal: data.netBilled,
        paidAmount: data.grandPaid,
        totalRefunds: data.totalRefunds || 0,
        netPaidCash: data.netPaidCash || (data.grandPaid - (data.totalRefunds || 0)),
        balanceDue: data.netOutstandingDue,
        paymentMethod: data.paymentMethod,
        printerIp: targetPrinter,
        returnBuffer: isWebUsb || isAgent
      });

      if (netRes.data?.rawBase64) {
        if (isWebUsb) {
          await printRawBase64ViaWebUsb(netRes.data.rawBase64);
          return { success: true, method: 'webusb', message: "Master receipt printed directly on this PC's USB printer" };
        } else if (isAgent) {
          await printViaWorkstationAgent(netRes.data.rawBase64, config?.usbPrinterName || 'BlackCopper 80mm Series');
          return { success: true, method: 'agent', message: 'Master receipt printed via local workstation agent' };
        }
      }

      if (netRes.data?.success) {
        console.log('✓ Master receipt printed on thermal printer:', netRes.data.message);
        return { success: true, method: 'hardware', message: netRes.data.message };
      }
    } catch (err) {
      console.warn('Hardware thermal print unavailable, proceeding with browser preview:', err?.response?.data?.message || err.message);
    }
  }

  // Graceful Fallback to Browser Print Preview Window only if hardware thermal print failed or forced
  return await printMasterReceiptPdf(optionsOrPatient);
};

/**
 * Print individual payment transaction receipt (80mm Thermal style)
 */
export const printSinglePaymentReceiptPdf = ({
  hospitalName = 'Shifa Hospital Timergara',
  hospitalAddress = 'Timergara, Lower Dir, KPK',
  hospitalPhone = '+92 945 825123',
  patient = {},
  transaction = {}
}) => {
  const pName = patient.name || patient.patientName || 'Walk-In Patient';
  const mrn = patient.mrn || 'N/A';
  const phone = patient.phone || 'N/A';
  const txNo = transaction.transactionNo || 'TXN-001';
  const rcpNo = transaction.receiptNo || 'RCP-001';
  const dept = transaction.departmentLabel || transaction.department || 'General';
  const ref = transaction.referenceNo ? ` (${transaction.referenceNo})` : '';
  const amt = Number(Math.abs(transaction.amount || 0)).toLocaleString();
  const disc = Number(transaction.discountApplied || 0).toLocaleString();
  const pMethod = transaction.paymentMethod || 'Cash Payment at Desk';
  const cashier = transaction.receivedByName || transaction.receivedBy?.name || 'Cashier';
  const dateStr = transaction.createdAt
    ? new Date(transaction.createdAt).toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : new Date().toLocaleString();
  const isRefund = transaction.transactionType === 'REFUND' || transaction.status === 'REFUNDED' || (transaction.amount < 0);

  const docHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt - ${txNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print {
      body { margin: 0; padding: 4px; }
    }
    body {
      font-family: 'Courier New', monospace;
      width: 76mm;
      margin: 0 auto;
      padding: 10px 4px;
      color: #000;
      font-size: 11px;
      line-height: 1.4;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .title { font-size: 13px; font-weight: 900; }
    .subtitle { font-size: 10px; }
    .badge { border: 1px solid #000; padding: 2px 4px; font-weight: bold; display: inline-block; margin-top: 4px; }
    .amt-box { font-size: 14px; font-weight: 900; margin: 8px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="title">${hospitalName}</div>
    <div class="subtitle">${hospitalAddress}</div>
    ${hospitalPhone ? `<div class="subtitle">Tel: ${hospitalPhone}</div>` : ''}
    <div class="double-divider"></div>
    <div class="badge">${isRefund ? '*** REFUND VOUCHER ***' : 'PAYMENT TRANSACTION RECEIPT'}</div>
  </div>

  <div class="divider"></div>

  <div class="row"><span>Tx No:</span><span class="font-bold">${txNo}</span></div>
  <div class="row"><span>Receipt No:</span><span class="font-bold">${rcpNo}</span></div>
  <div class="row"><span>Date & Time:</span><span>${dateStr}</span></div>

  <div class="divider"></div>

  <div class="row"><span>Patient:</span><span class="font-bold">${pName}</span></div>
  <div class="row"><span>MRN:</span><span class="font-bold">${mrn}</span></div>
  <div class="row"><span>Phone:</span><span>${phone}</span></div>

  <div class="divider"></div>

  <div class="row"><span>Service:</span><span class="font-bold">${dept}${ref}</span></div>
  <div class="row"><span>Method:</span><span>${pMethod}</span></div>
  ${Number(transaction.discountApplied) > 0 ? `<div class="row"><span>Concession:</span><span>Rs. ${disc}</span></div>` : ''}

  <div class="divider"></div>

  <div class="amt-box">
    ${isRefund ? 'REFUNDED:' : 'AMOUNT COLLECTED:'} Rs. ${amt}
  </div>

  <div class="divider"></div>

  <div class="row"><span>Received By:</span><span class="font-bold">${cashier}</span></div>
  <div class="row"><span>Status:</span><span class="font-bold">${transaction.status || 'SUCCESS'}</span></div>

  <div class="double-divider"></div>
  <div class="text-center subtitle">
    Official Payment Ledger Voucher<br/>
    Thank you for choosing ${hospitalName}!
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=420,height=600');
  if (w) {
    w.document.open();
    w.document.write(docHtml);
    w.document.close();
  }
};

export default printMasterReceiptPdf;
