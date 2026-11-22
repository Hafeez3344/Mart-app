const os = require('os');
const prisma = require('../config/prisma');

// Get LAN Network Info for multi-terminal access
const getLanInfo = async (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({ interface: name, ip: iface.address });
        }
      }
    }

    const preferred = addresses.find(a => a.ip.startsWith('192.168.') || a.ip.startsWith('10.'));
    const primaryIp = preferred ? preferred.ip : (addresses[0]?.ip || 'localhost');

    return res.status(200).json({
      success: true,
      primaryIp,
      addresses,
      accessUrl: `http://${primaryIp}:3000`,
      apiUrl: `http://${primaryIp}:5000`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to resolve LAN IP' });
  }
};

// Get current Mart Store Settings
const getStoreSettings = async (req, res) => {
  try {
    let settings = await prisma.storeSetting.findFirst();

    if (!settings) {
      settings = await prisma.storeSetting.create({
        data: {
          storeName: 'Al Masoom Supar Mart',
          tagline: 'Fresh Quality Products, Best Daily Prices',
          phone: '+92 300 1234567',
          email: 'info@almasoommart.pk',
          address: 'Main Commercial Boulevard, Phase 4, City Center',
          taxNumber: 'NTN-5829104-1',
          currencyCode: 'PKR',
          currencySymbol: 'Rs.',
          receiptHeader: 'Thank you for shopping with us!',
          receiptFooter: 'Items can be exchanged within 7 days with valid receipt.',
          printerType: 'ESC_POS',
          paperWidth: 80,
          enableSound: true,
          enableCashDrawer: true
        }
      });
    }

    // Also provide alias properties for backward compatibility with frontend
    const responsePayload = {
      ...settings,
      hospitalName: settings.storeName, // Backward-compat alias
      locationAddress: settings.address,
      taxRegistrationNo: settings.taxNumber
    };

    return res.status(200).json({ success: true, settings: responsePayload });
  } catch (error) {
    console.error('getStoreSettings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch store settings.' });
  }
};

// Update Mart Store Settings
const updateStoreSettings = async (req, res) => {
  try {
    const {
      storeName,
      hospitalName,
      tagline,
      phone,
      email,
      address,
      locationAddress,
      taxNumber,
      taxRegistrationNo,
      currencyCode,
      currencySymbol,
      receiptHeader,
      receiptFooter,
      printerType,
      paperWidth,
      enableSound,
      enableCashDrawer,
      cashDrawerCode,
      logoUrl
    } = req.body;

    let existing = await prisma.storeSetting.findFirst();

    const name = storeName || hospitalName;
    const finalAddress = address || locationAddress;
    const finalTax = taxNumber || taxRegistrationNo;

    const data = {};
    if (name !== undefined) data.storeName = name.trim();
    if (tagline !== undefined) data.tagline = tagline.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (email !== undefined) data.email = email.trim();
    if (finalAddress !== undefined) data.address = finalAddress.trim();
    if (finalTax !== undefined) data.taxNumber = finalTax.trim();
    if (currencyCode !== undefined) data.currencyCode = currencyCode.trim();
    if (currencySymbol !== undefined) data.currencySymbol = currencySymbol.trim();
    if (receiptHeader !== undefined) data.receiptHeader = receiptHeader.trim();
    if (receiptFooter !== undefined) data.receiptFooter = receiptFooter.trim();
    if (printerType !== undefined) data.printerType = printerType.trim();
    if (paperWidth !== undefined) data.paperWidth = parseInt(paperWidth, 10) || 80;
    if (enableSound !== undefined) data.enableSound = Boolean(enableSound);
    if (enableCashDrawer !== undefined) data.enableCashDrawer = Boolean(enableCashDrawer);
    if (cashDrawerCode !== undefined) data.cashDrawerCode = cashDrawerCode.trim();
    if (logoUrl !== undefined) data.logoUrl = logoUrl;

    let settings;
    if (existing) {
      settings = await prisma.storeSetting.update({
        where: { id: existing.id },
        data
      });
    } else {
      settings = await prisma.storeSetting.create({
        data: {
          storeName: name || 'Al Masoom Supar Mart',
          ...data
        }
      });
    }

    const responsePayload = {
      ...settings,
      hospitalName: settings.storeName,
      locationAddress: settings.address,
      taxRegistrationNo: settings.taxNumber
    };

    return res.status(200).json({
      success: true,
      message: 'Mart settings updated successfully.',
      settings: responsePayload
    });
  } catch (error) {
    console.error('updateStoreSettings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update store settings.' });
  }
};

module.exports = {
  getHospitalSettings: getStoreSettings,
  updateHospitalSettings: updateStoreSettings,
  getStoreSettings,
  updateStoreSettings,
  getLanInfo
};
