const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const {
  sendToNetworkPrinter,
  testPrinterConnection,
  getWindowsPrinters,
  sendToWindowsUsbPrinter,
  buildTestTicketEscPos,
  buildTokenEscPos,
  buildMasterReceiptEscPos,
  buildPharmacyReceiptEscPos,
  buildServiceReceiptEscPos,
  buildLabReceiptEscPos,
  buildXrayReceiptEscPos,
  buildBarcodeStickerEscPos,
  buildPatientBarcodeStickerEscPos,
  buildCustomerDuesStatementEscPos,
  buildRefundReceiptEscPos
} = require('../utils/escposPrinter');

/**
 * GET /api/print/download-agent
 * Download the zero-install Workstation Print Bridge (.zip)
 * Public asset download route so reception/workstation PCs can download the local helper agent
 */
router.get('/download-agent', (req, res) => {
  const zipPath = path.join(__dirname, '..', '..', 'public', 'workstation-printer.zip');
  if (fs.existsSync(zipPath)) {
    return res.download(zipPath, 'workstation-printer.zip');
  }
  return res.status(404).json({ success: false, message: 'Print agent zip not found' });
});

// Protect printer hardware endpoints against unauthorized network execution
router.use(authenticateToken);

// Helper to get active printer target & hospital settings
async function getPrinterConfig() {
  const settings = await prisma.hospitalSetting.findUnique({
    where: { id: 'default-setting' }
  });

  return {
    printerTarget: settings?.thermalPrinterIp || process.env.THERMAL_PRINTER_IP || '192.168.1.200',
    printerPort: settings?.thermalPrinterPort || 9100,
    enableNetworkPrint: settings?.enableNetworkPrint !== false,
    hospitalName: settings?.hospitalName || 'Shifa Hospital Timergara',
    hospitalAddress: settings?.locationAddress || '',
    hospitalPhone: settings?.phone || settings?.emergencyHelpline || '',
    taxNo: settings?.taxRegistrationNo || ''
  };
}

// Unified dispatcher to route print buffer to either WebUSB (rawBase64 returned), Windows USB Spooler, or TCP/IP Socket
async function dispatchPrintJob(target, buffer, config, fallbackPort = 9100, returnBuffer = false) {
  if (returnBuffer || target === 'WEBUSB' || target?.startsWith('WEBUSB') || target === 'RAW') {
    return {
      type: 'WEBUSB',
      destination: 'Client WebUSB / Local Device',
      rawBase64: buffer.toString('base64'),
      message: 'ESC/POS commands generated successfully for direct client printing'
    };
  }

  // Handle Windows UNC shared printer (e.g. \\FrontDesk-PC\BlackCopper or UNC:\\FrontDesk-PC\BlackCopper)
  const isUnc = target?.startsWith('\\\\') || target?.startsWith('UNC:');
  if (isUnc) {
    const cleanTarget = target.replace(/^UNC:/i, '');
    await sendToWindowsUsbPrinter(cleanTarget, buffer);
    return {
      type: 'NETWORK_SHARED_PRINTER',
      destination: cleanTarget,
      message: `Printed successfully to Network Shared Printer ("${cleanTarget}")`
    };
  }

  const isUsb = !target || target.startsWith('USB:') || (!target.includes('.') && !target.includes(':'));
  if (isUsb) {
    let printerName = target?.startsWith('USB:') ? target.replace('USB:', '') : target;
    const printers = await getWindowsPrinters();
    
    // Check if the requested printerName actually exists on the Windows host
    const exactMatch = printers.find(p => p.name.toLowerCase() === (printerName || '').toLowerCase());
    if (!exactMatch) {
      // Find default or any BlackCopper / 80mm thermal printer installed
      const bestMatch = printers.find(p => p.name.includes('BlackCopper') || p.name.includes('80') || p.name.includes('POS'))
        || printers.find(p => p.isDefault)
        || printers[0];
      if (bestMatch) {
        printerName = bestMatch.name;
      }
    } else {
      printerName = exactMatch.name;
    }

    if (!printerName) {
      printerName = 'BlackCopper 80mm Series';
    }

    await sendToWindowsUsbPrinter(printerName, buffer);
    return {
      type: 'USB',
      destination: printerName,
      message: `Printed successfully to USB Thermal Printer ("${printerName}")`
    };
  } else {
    const port = fallbackPort || config.printerPort || 9100;
    await sendToNetworkPrinter(target, buffer, port);
    return {
      type: 'NETWORK',
      destination: `${target}:${port}`,
      message: `Printed successfully to Network Thermal Printer (${target}:${port})`
    };
  }
}



/**
 * GET /api/print/windows-printers
 * List all printers installed on the host operating system
 */
router.get('/windows-printers', async (req, res) => {
  try {
    const printers = await getWindowsPrinters();
    const defaultPrinter = printers.find(p => p.isDefault)?.name || printers[0]?.name || '';
    return res.json({
      success: true,
      printers,
      defaultPrinter
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, printers: [] });
  }
});

/**
 * GET /api/print/status
 * Test printer connection (handles both USB and TCP/IP)
 */
router.get('/status', async (req, res) => {
  try {
    const config = await getPrinterConfig();
    const queryTarget = req.query.ip || config.printerTarget;
    const queryPort = parseInt(req.query.port, 10) || config.printerPort;

    const isUsb = queryTarget?.startsWith('USB:') || (!queryTarget?.includes('.') && !queryTarget?.includes(':'));
    if (isUsb) {
      const printerName = queryTarget.startsWith('USB:') ? queryTarget.replace('USB:', '') : queryTarget;
      const printers = await getWindowsPrinters();
      const matched = printers.find(p => p.name.toLowerCase() === (printerName || '').toLowerCase()) || printers.find(p => p.isDefault);

      if (matched) {
        return res.json({
          success: true,
          online: !matched.isOffline,
          isUsb: true,
          printerName: matched.name,
          port: matched.port,
          message: matched.isOffline
            ? `USB Printer "${matched.name}" is marked OFFLINE in Windows. Check USB cable and power.`
            : `USB Printer "${matched.name}" is ONLINE & READY (Port: ${matched.port})`,
          configuredTarget: config.printerTarget,
          enableNetworkPrint: config.enableNetworkPrint
        });
      } else {
        return res.json({
          success: true,
          online: false,
          isUsb: true,
          message: `Printer "${printerName}" not found in Windows installed printers.`,
          configuredTarget: config.printerTarget,
          enableNetworkPrint: config.enableNetworkPrint
        });
      }
    }

    const result = await testPrinterConnection(queryTarget, queryPort);
    return res.json({
      success: true,
      ...result,
      isUsb: false,
      configuredTarget: config.printerTarget,
      configuredPort: config.printerPort,
      enableNetworkPrint: config.enableNetworkPrint
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/print/test-ticket
 * Print a physical test ticket to verify hardware paper feed and cutter
 */
router.post('/test-ticket', async (req, res) => {
  try {
    const config = await getPrinterConfig();
    const target = req.body.target || config.printerTarget;
    const port = parseInt(req.body.port, 10) || config.printerPort;
    const label = req.body.label || target;

    const buffer = buildTestTicketEscPos(config.hospitalName, label);
    const dispatch = await dispatchPrintJob(target, buffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      rawBase64: dispatch.rawBase64,
      ...dispatch
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/print/token
 * Direct printing of OPD Appointment Consultation Token
 */
router.post('/token', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      appointmentId,
      tokenNo,
      patientName,
      mrn,
      doctorName,
      department,
      fee,
      paidAmount,
      paymentStatus,
      dateStr,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      tokenNo: tokenNo || '1',
      patientName: patientName || 'WALK-IN PATIENT',
      mrn: mrn || 'N/A',
      doctorName: doctorName || 'Duty Medical Officer',
      department: department || 'OPD General',
      fee: fee || 500,
      paidAmount: paidAmount !== undefined ? paidAmount : null,
      paymentStatus: paymentStatus || '',
      dateStr: dateStr || new Date().toLocaleString('en-GB')
    };

    if (appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: true,
          doctor: { include: { user: true, department: true } }
        }
      });

      if (appt) {
        finalData.tokenNo = String(appt.tokenNo || tokenNo || '1');
        finalData.patientName = appt.patient?.name || patientName || 'PATIENT';
        finalData.mrn = appt.patient?.mrn || mrn || 'N/A';
        finalData.doctorName = appt.doctor?.user?.name
          ? (appt.doctor.user.name.startsWith('Dr.') ? appt.doctor.user.name : `Dr. ${appt.doctor.user.name}`)
          : doctorName;
        finalData.department = appt.doctor?.department?.name || department || 'OPD General';
        finalData.fee = appt.consultationFee || fee || 500;
        finalData.paidAmount = appt.paidAmount !== undefined && appt.paidAmount !== null ? appt.paidAmount : finalData.paidAmount;
        finalData.paymentStatus = appt.paymentStatus || paymentStatus || '';
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildTokenEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Token #${finalData.tokenNo} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      tokenNo: finalData.tokenNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print token error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/master-receipt
 * Direct printing of Master Patient Billing Checkout Receipt
 */
router.post('/master-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      patientId,
      receiptNo,
      patientName,
      mrn,
      phone,
      gender,
      age,
      categories,
      items,
      subtotal,
      discount,
      departmentDiscounts,
      masterDiscount,
      netTotal,
      paidAmount,
      balanceDue,
      paymentMethod,
      cashierName,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      taxNo: config.taxNo,
      receiptNo: receiptNo || `REC-${Date.now().toString().slice(-6)}`,
      patientName: patientName || 'PATIENT',
      mrn: mrn || 'N/A',
      phone: phone || '',
      gender: gender || '',
      age: age || '',
      dateStr: new Date().toLocaleString('en-GB'),
      cashierName: cashierName || 'Front Desk Reception',
      categories: Array.isArray(categories) ? categories : [],
      items: Array.isArray(items) ? items : [],
      subtotal: subtotal || netTotal || 0,
      discount: discount || 0,
      departmentDiscounts: departmentDiscounts || 0,
      masterDiscount: masterDiscount || 0,
      netTotal: netTotal || 0,
      paidAmount: paidAmount || 0,
      balanceDue: balanceDue || 0,
      paymentMethod: paymentMethod || 'CASH'
    };

    if (patientId && (!finalData.items || finalData.items.length === 0)) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          invoices: { take: 5, orderBy: { createdAt: 'desc' } },
          appointments: { take: 3, orderBy: { createdAt: 'desc' } }
        }
      });

      if (patient) {
        finalData.patientName = patient.name || finalData.patientName;
        finalData.mrn = patient.mrn || finalData.mrn;
        finalData.phone = patient.phone || finalData.phone;
        finalData.gender = patient.gender || finalData.gender;
        finalData.age = patient.age || finalData.age;
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildMasterReceiptEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Master Receipt printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      receiptNo: finalData.receiptNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print master receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/pharmacy-receipt
 * Direct silent hardware printing of Pharmacy Sales POS Receipt (USB or Network TCP/IP)
 */
router.post('/pharmacy-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      saleId,
      invoiceNo,
      customerName,
      customerPhone,
      mrn,
      items,
      subtotal,
      discount,
      netTotal,
      totalRefund,
      adjustedNetTotal,
      paidAmount,
      balanceDue,
      paymentMethod,
      paidAtCounter,
      dateStr,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      invoiceNo: invoiceNo || `PHARM-${Date.now().toString().slice(-6)}`,
      customerName: customerName || 'Walk-In Customer',
      customerPhone: customerPhone || '',
      mrn: mrn || 'N/A',
      items: Array.isArray(items) ? items : [],
      subtotal: subtotal || netTotal || 0,
      discount: discount || 0,
      netTotal: netTotal || 0,
      totalRefund: totalRefund || 0,
      adjustedNetTotal: adjustedNetTotal || netTotal || 0,
      paidAmount: paidAmount || 0,
      balanceDue: balanceDue || 0,
      paymentMethod: paymentMethod || 'CASH',
      paidAtCounter: paidAtCounter || 'PHARMACY',
      dateStr: dateStr || new Date().toLocaleString('en-GB')
    };

    // If saleId provided, pull freshest details from DB
    if (saleId) {
      const sale = await prisma.pharmacySale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              medicine: true
            }
          },
          patient: true,
          returns: {
            include: {
              items: true
            }
          }
        }
      });

      if (sale) {
        finalData.invoiceNo = sale.invoiceNo || finalData.invoiceNo;
        finalData.customerName = sale.customerName || sale.patient?.name || finalData.customerName;
        finalData.customerPhone = sale.customerPhone || sale.patient?.phone || finalData.customerPhone;
        finalData.mrn = sale.mrn || sale.patient?.mrn || finalData.mrn;
        finalData.subtotal = sale.subtotal !== undefined ? sale.subtotal : finalData.subtotal;
        finalData.discount = sale.discount !== undefined ? sale.discount : finalData.discount;
        finalData.netTotal = sale.netTotal !== undefined ? sale.netTotal : finalData.netTotal;
        finalData.paidAmount = sale.paidAmount !== undefined ? sale.paidAmount : finalData.paidAmount;
        finalData.paymentMethod = sale.paymentMethod || finalData.paymentMethod;
        finalData.paidAtCounter = sale.paidAtCounter || finalData.paidAtCounter;
        finalData.status = sale.status || 'PAID';

        // Calculate refunds if any returns exist
        let retRefund = 0;
        const returnedMap = {};
        if (sale.returns && sale.returns.length > 0) {
          sale.returns.forEach(r => {
            retRefund += (r.refundAmount || 0);
            (r.items || []).forEach(ri => {
              const key = ri.medicineName || ri.medicineId;
              returnedMap[key] = (returnedMap[key] || 0) + (ri.quantity || 0);
            });
          });
        }
        finalData.totalRefund = retRefund || totalRefund || 0;
        finalData.adjustedNetTotal = Math.max(0, finalData.netTotal - finalData.totalRefund);
        finalData.balanceDue = Math.max(0, finalData.adjustedNetTotal - finalData.paidAmount);

        if (sale.items && sale.items.length > 0 && (!finalData.items || finalData.items.length === 0)) {
          finalData.items = sale.items.map(it => {
            const retQty = returnedMap[it.medicine?.name] || returnedMap[it.medicineId] || 0;
            const activeQty = Math.max(0, (it.quantity || 0) - retQty);
            return {
              medicineName: it.medicine?.name || it.medicineName || 'Medicine',
              quantity: it.quantity,
              activeQuantity: activeQty,
              returnedQuantity: retQty,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
              activeTotalPrice: activeQty * (it.unitPrice || 0)
            };
          });
        }
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildPharmacyReceiptEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Pharmacy Receipt #${finalData.invoiceNo} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      invoiceNo: finalData.invoiceNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print pharmacy receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/service-receipt
 * Direct silent hardware printing of Medical Services & Procedures Receipt
 */
router.post('/service-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      orderId,
      orderNo,
      patientName,
      mrn,
      refDoctor,
      services,
      totalFee,
      discountAmount,
      netTotal,
      paidAmount,
      paymentStatus,
      paymentMethod,
      dateStr,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      orderNo: orderNo || `SERV-${Date.now().toString().slice(-6)}`,
      patientName: patientName || 'PATIENT',
      mrn: mrn || 'WALK-IN',
      refDoctor: refDoctor || 'Consultant Doctor',
      services: Array.isArray(services) ? services : [],
      totalFee: totalFee || 0,
      discountAmount: discountAmount || 0,
      netTotal: netTotal || totalFee || 0,
      paidAmount: paidAmount || 0,
      paymentStatus: paymentStatus || 'PAID',
      paymentMethod: paymentMethod || 'CASH',
      dateStr: dateStr || new Date().toLocaleString('en-GB')
    };

    if (orderId) {
      const order = await prisma.medicalServiceOrder.findUnique({
        where: { id: orderId },
        include: { patient: true }
      });
      if (order) {
        finalData.orderNo = order.orderNo || finalData.orderNo;
        finalData.patientName = order.patientName || order.patient?.name || finalData.patientName;
        finalData.mrn = order.mrn || order.patient?.mrn || finalData.mrn;
        finalData.refDoctor = order.refDoctor || finalData.refDoctor;
        finalData.totalFee = order.totalFee;
        finalData.discountAmount = order.discountAmount;
        finalData.netTotal = order.netTotal;
        finalData.paidAmount = order.paidAmount;
        finalData.paymentStatus = order.paymentStatus;
        finalData.paymentMethod = order.paymentMethod || 'CASH';
        try {
          const parsed = typeof order.servicesJson === 'string' ? JSON.parse(order.servicesJson) : order.servicesJson;
          if (Array.isArray(parsed) && parsed.length > 0) finalData.services = parsed;
        } catch (e) {}
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildServiceReceiptEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Medical Service Receipt #${finalData.orderNo} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      orderNo: finalData.orderNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print service receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/lab-receipt
 * Direct silent hardware printing of Laboratory Test Order Receipt
 */
router.post('/lab-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      orderId,
      orderNo,
      patientName,
      patientType,
      isExternal,
      phone,
      mrn,
      gender,
      age,
      refDoctor,
      tests,
      totalFee,
      discountAmount,
      netTotal,
      paidAmount,
      balanceDue,
      paymentStatus,
      paymentMethod,
      paidAtCounter,
      dateStr,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      orderNo: orderNo || `LAB-${Date.now().toString().slice(-6)}`,
      patientName: patientName || 'PATIENT',
      patientType: patientType || 'INTERNAL',
      isExternal: Boolean(isExternal),
      phone: phone || '',
      mrn: mrn || 'WALK-IN',
      gender: gender || '',
      age: age || '',
      refDoctor: refDoctor || 'Consultant',
      tests: Array.isArray(tests) ? tests : [],
      totalFee: totalFee || 0,
      discountAmount: discountAmount || 0,
      netTotal: netTotal || totalFee || 0,
      paidAmount: paidAmount || 0,
      balanceDue: balanceDue || 0,
      paymentStatus: paymentStatus || 'PAID',
      paymentMethod: paymentMethod || 'CASH',
      paidAtCounter: paidAtCounter || 'FRONTDESK',
      dateStr: dateStr || new Date().toLocaleString('en-GB')
    };

    if (orderId) {
      const ord = await prisma.labOrder.findUnique({
        where: { id: orderId },
        include: { patient: true }
      });
      if (ord) {
        finalData.orderNo = ord.orderNo || finalData.orderNo;
        finalData.patientName = ord.patientName || ord.patient?.name || finalData.patientName;
        finalData.patientType = ord.patientType || finalData.patientType;
        finalData.phone = ord.phone || ord.patient?.phone || finalData.phone;
        finalData.mrn = ord.mrn || ord.patient?.mrn || finalData.mrn;
        finalData.gender = ord.gender || ord.patient?.gender || finalData.gender;
        finalData.age = ord.age || ord.patient?.age || finalData.age;
        finalData.refDoctor = ord.refDoctor || finalData.refDoctor;
        finalData.totalFee = ord.totalFee;
        finalData.discountAmount = ord.discountAmount;
        finalData.netTotal = ord.netTotal;
        finalData.paidAmount = ord.paidAmount;
        finalData.paymentStatus = ord.paymentStatus;
        finalData.paymentMethod = ord.paymentMethod || 'CASH';
        finalData.paidAtCounter = paidAtCounter || ord.paidAtCounter || 'FRONTDESK';
        try {
          const parsed = typeof ord.testsJson === 'string' ? JSON.parse(ord.testsJson) : ord.testsJson;
          if (Array.isArray(parsed) && parsed.length > 0) finalData.tests = parsed;
        } catch (e) {}
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildLabReceiptEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Lab Order Receipt #${finalData.orderNo} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      orderNo: finalData.orderNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print lab receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/xray-receipt
 * Direct silent hardware printing of X-Ray / Radiology Scan Order Receipt
 */
router.post('/xray-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      orderId,
      orderNo,
      patientName,
      patientType,
      isExternal,
      phone,
      mrn,
      gender,
      age,
      referringDoctor,
      scanType,
      modality,
      bodyPart,
      priority,
      scans,
      fee,
      discountAmount,
      netTotal,
      paidAmount,
      balanceDue,
      paymentStatus,
      paymentMethod,
      paidAtCounter,
      dateStr,
      printerIp,
      printerPort
    } = req.body;

    let finalData = {
      hospitalName: config.hospitalName,
      hospitalAddress: config.hospitalAddress,
      hospitalPhone: config.hospitalPhone,
      orderNo: orderNo || `XR-${new Date().getFullYear()}-00000`,
      patientName: patientName || 'PATIENT',
      patientType: patientType || 'INTERNAL',
      isExternal: Boolean(isExternal),
      phone: phone || '',
      mrn: mrn || 'WALK-IN',
      gender: gender || '',
      age: age || '',
      referringDoctor: referringDoctor || 'Hospital OPD Consultant',
      scanType: scanType || 'Chest X-Ray',
      modality: modality || 'Digital X-Ray',
      bodyPart: bodyPart || 'Chest / Thorax',
      priority: priority || 'Routine',
      scans: Array.isArray(scans) ? scans : [],
      fee: fee || 0,
      discountAmount: discountAmount || 0,
      netTotal: netTotal || fee || 0,
      paidAmount: paidAmount || 0,
      balanceDue: balanceDue || 0,
      paymentStatus: paymentStatus || 'PAID',
      paymentMethod: paymentMethod || 'CASH',
      paidAtCounter: paidAtCounter || 'FRONTDESK',
      dateStr: dateStr || new Date().toLocaleString('en-GB')
    };

    if (orderId) {
      const ord = await prisma.xrayOrder.findUnique({
        where: { id: orderId }
      });
      if (ord) {
        finalData.orderNo = ord.orderNo || finalData.orderNo;
        finalData.patientName = ord.patientName || finalData.patientName;
        finalData.patientType = ord.patientType || finalData.patientType;
        finalData.phone = ord.phone || finalData.phone;
        finalData.mrn = ord.mrn || finalData.mrn;
        finalData.gender = ord.gender || finalData.gender;
        finalData.age = ord.age || finalData.age;
        finalData.referringDoctor = ord.referringDoctor || finalData.referringDoctor;
        finalData.scanType = ord.scanType || finalData.scanType;
        finalData.modality = ord.modality || finalData.modality;
        finalData.bodyPart = ord.bodyPart || finalData.bodyPart;
        finalData.priority = ord.priority || finalData.priority;
        finalData.fee = ord.fee;
        finalData.discountAmount = ord.discountAmount;
        finalData.netTotal = ord.netTotal;
        finalData.paidAmount = ord.paidAmount;
        finalData.paymentStatus = ord.paymentStatus;
        finalData.paymentMethod = ord.paymentMethod || 'CASH';
      }
    }

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const escposBuffer = buildXrayReceiptEscPos(finalData);
    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `X-Ray Order Receipt #${finalData.orderNo} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      orderNo: finalData.orderNo,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print X-Ray receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

// POST /api/print/barcode-sticker - Print hardware barcode sticker on thermal/label printer
router.post('/barcode-sticker', async (req, res) => {
  try {
    const config = await getPrinterConfig();
    const {
      medicineName = 'Medicine',
      genericName = '',
      barcode = '890123456701',
      retailPrice = 0,
      expiryDate = '',
      hospitalName = '',
      printerIp,
      printerPort
    } = req.body;

    const totalCopies = Math.min(100, Math.max(1, parseInt(req.body.quantity || req.body.copies, 10) || 1));
    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const singleBuffer = buildBarcodeStickerEscPos({
      hospitalName: hospitalName || config.hospitalName || 'CarePulse Hospital Pharmacy',
      medicineName,
      genericName,
      barcode,
      retailPrice,
      expiryDate
    });

    // Repeat the sticker buffer totalCopies times for batch thermal printing (e.g. 10 at a time)
    const buffers = [];
    for (let i = 0; i < totalCopies; i++) {
      buffers.push(singleBuffer);
    }
    const escposBuffer = Buffer.concat(buffers);

    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port);

    return res.json({
      success: true,
      message: `${totalCopies} Barcode sticker(s) for "${medicineName}" printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      copies: totalCopies,
      barcode
    });
  } catch (err) {
    console.error('Print barcode sticker error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

// POST /api/print/patient-barcode - Print hardware barcode sticker for Patient MRN on thermal label printer
router.post('/patient-barcode', async (req, res) => {
  try {
    const config = await getPrinterConfig();
    const {
      patientId,
      patientName = 'Patient',
      mrn = 'MRN-2026-0001',
      gender = '',
      age = '',
      phone = '',
      hospitalName = '',
      printerIp,
      printerPort
    } = req.body;

    let finalName = patientName;
    let finalMrn = mrn;
    let finalGender = gender;
    let finalAge = age;
    let finalPhone = phone;

    if (patientId) {
      try {
        const p = await prisma.patient.findUnique({ where: { id: patientId } });
        if (p) {
          finalName = p.name || finalName;
          finalMrn = p.mrn || finalMrn;
          finalGender = p.gender || finalGender;
          finalAge = p.age ? String(p.age) : finalAge;
          finalPhone = p.phone || finalPhone;
        }
      } catch (pErr) {}
    }

    const totalCopies = Math.min(50, Math.max(1, parseInt(req.body.quantity || req.body.copies, 10) || 1));
    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort;

    const singleBuffer = buildPatientBarcodeStickerEscPos({
      hospitalName: hospitalName || config.hospitalName || 'DOCTORS HOSPITAL TIMERGARA',
      patientName: finalName,
      mrn: finalMrn,
      gender: finalGender,
      age: finalAge,
      phone: finalPhone
    });

    const buffers = [];
    for (let i = 0; i < totalCopies; i++) {
      buffers.push(singleBuffer);
    }
    const escposBuffer = Buffer.concat(buffers);

    const dispatch = await dispatchPrintJob(target, escposBuffer, config, port);

    return res.json({
      success: true,
      message: `${totalCopies} Barcode sticker(s) for "${finalName}" (${finalMrn}) printed silently on ${dispatch.destination}`,
      destination: dispatch.destination,
      copies: totalCopies,
      mrn: finalMrn
    });
  } catch (err) {
    console.error('Print patient barcode sticker error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/customer-dues
 * Direct Hardware TCP/IP / Windows USB Thermal Printing for Customer Dues & Payment Statement
 */
router.post('/customer-dues', async (req, res) => {
  try {
    const config = await getPrinterConfig();
    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      customerName,
      customerPhone,
      customerId,
      totalBilled,
      totalPaid,
      totalPending,
      sales,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      printerIp,
      printerPort
    } = req.body;

    const buffer = buildCustomerDuesStatementEscPos({
      hospitalName: hospitalName || config.hospitalName,
      hospitalAddress: hospitalAddress || config.hospitalAddress,
      hospitalPhone: hospitalPhone || config.hospitalPhone,
      customerName: customerName || 'Valued Customer',
      customerPhone: customerPhone || '',
      customerId: customerId || '',
      totalBilled: Number(totalBilled || 0),
      totalPaid: Number(totalPaid || 0),
      totalPending: Number(totalPending || 0),
      sales: Array.isArray(sales) ? sales : [],
      dateStr: new Date().toLocaleString('en-GB')
    });

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort || 9100;
    const dispatch = await dispatchPrintJob(target, buffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Customer statement for "${customerName}" printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      type: dispatch.type,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print customer dues statement error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to browser print.`,
      error: err.message
    });
  }
});

/**
 * POST /api/print/refund-receipt
 * Direct silent hardware printing of Patient Cash Refund Voucher (USB or Network TCP/IP)
 */
router.post('/refund-receipt', async (req, res) => {
  try {
    const config = await getPrinterConfig();

    if (!config.enableNetworkPrint) {
      return res.status(400).json({
        success: false,
        disabled: true,
        message: 'Direct thermal printing is disabled in Hospital Settings.'
      });
    }

    const {
      receiptNo,
      refCode,
      patientName,
      mrn,
      phone,
      amount,
      reason,
      itemDescription,
      paymentMethod,
      date,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      printerIp,
      printerPort
    } = req.body;

    const buffer = buildRefundReceiptEscPos({
      hospitalName: hospitalName || config.hospitalName,
      hospitalAddress: hospitalAddress || config.hospitalAddress,
      hospitalPhone: hospitalPhone || config.hospitalPhone,
      receiptNo: receiptNo || `REF-${Date.now().toString().slice(-6)}`,
      refCode: refCode || '',
      patientName: patientName || 'PATIENT',
      mrn: mrn || 'WALK-IN',
      phone: phone || '',
      amount: parseFloat(amount || 0),
      reason: reason || 'Patient Left / Doctor Delayed',
      itemDescription: itemDescription || 'Patient Cash Consultation / Order Refund',
      paymentMethod: paymentMethod || 'CASH',
      date: date || new Date()
    });

    const target = printerIp || config.printerTarget;
    const port = parseInt(printerPort, 10) || config.printerPort || 9100;
    const dispatch = await dispatchPrintJob(target, buffer, config, port, req.body.returnBuffer);

    return res.json({
      success: true,
      message: `Refund voucher ${receiptNo || ''} printed on ${dispatch.destination}`,
      destination: dispatch.destination,
      type: dispatch.type,
      rawBase64: dispatch.rawBase64
    });
  } catch (err) {
    console.error('Print refund receipt error:', err.message);
    return res.status(500).json({
      success: false,
      message: `Thermal printer error: ${err.message}. Falling back to silent browser print.`,
      error: err.message
    });
  }
});

module.exports = router;
