const prisma = require('../config/prisma');

const getAllCustomers = async (req, res) => {
  try {
    const { search, duesOnly } = req.query;

    const where = { isActive: true };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (duesOnly === 'true') {
      where.currentBalance = { gt: 0 };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { sales: true, payments: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    console.error('getAllCustomers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { items: true }
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 20
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error('getCustomerById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer profile.' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, creditLimit, notes } = req.body;

    if (!name || !name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name and phone number are required.' });
    }

    const cleanPhone = phone.trim();

    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A customer with phone number ${cleanPhone} is already registered as ${existing.name}.`,
        customer: existing
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        address: address?.trim() || null,
        creditLimit: creditLimit ? parseFloat(creditLimit) : 50000,
        currentBalance: 0,
        notes: notes?.trim() || null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      customer
    });
  } catch (error) {
    console.error('createCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register customer.' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, creditLimit, notes, isActive } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email ? email.trim() : null;
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (creditLimit !== undefined) updateData.creditLimit = parseFloat(creditLimit) || 0;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully.',
      customer
    });
  } catch (error) {
    console.error('updateCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.customer.update({
      where: { id },
      data: { isActive: false }
    });
    return res.status(200).json({ success: true, message: 'Customer deactivated successfully.' });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete customer.' });
  }
};

const receiveCustomerPayment = async (req, res) => {
  try {
    const { customerId, amount, paymentMethod, referenceNo, notes } = req.body;

    if (!customerId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Customer ID and a valid payment amount are required.' });
    }

    const payAmount = parseFloat(amount);
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const receivedBy = req.user?.name || 'Cashier';

    const [updatedCustomer, payment] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: {
          currentBalance: { decrement: payAmount }
        }
      }),
      prisma.customerPayment.create({
        data: {
          customerId,
          amount: payAmount,
          paymentMethod: paymentMethod || 'CASH',
          referenceNo: referenceNo?.trim() || null,
          notes: notes?.trim() || 'Payment received towards customer balance',
          receivedBy,
          paymentDate: new Date()
        }
      })
    ]);

    return res.status(201).json({
      success: true,
      message: `Payment of ${payAmount} recorded successfully. New balance: ${updatedCustomer.currentBalance}.`,
      customer: updatedCustomer,
      payment
    });
  } catch (error) {
    console.error('receiveCustomerPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record customer payment.' });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  receiveCustomerPayment
};

