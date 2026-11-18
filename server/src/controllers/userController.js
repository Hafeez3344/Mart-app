const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

function generateEmployeeId(prefix = 'STF') {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

// Get all system users
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        active: true,
        createdAt: true,
        staff: {
          select: { employeeId: true, designation: true, baseSalary: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve system users.' });
  }
};

// Create a new user (Cashier, Manager, Admin, Stock Keeper, Accountant)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, designation, baseSalary, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email address is already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: passwordHash,
        role: role.toUpperCase(),
        phone: phone?.trim() || null
      }
    });

    const prefix = role.startsWith('CASH') ? 'CSH' : role.startsWith('MANG') ? 'MGR' : 'STF';
    await prisma.staff.create({
      data: {
        userId: user.id,
        employeeId: generateEmployeeId(prefix),
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || 'Staff',
        email: cleanEmail,
        phone: phone?.trim() || null,
        designation: designation || role,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 25000.00
      }
    });

    return res.status(201).json({ success: true, message: 'User created successfully', user });
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create new user.' });
  }
};

// Toggle user active status
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { active: !user.active }
    });

    return res.status(200).json({
      success: true,
      message: `User account ${updated.active ? 'activated' : 'deactivated'}.`,
      user: updated
    });
  } catch (error) {
    console.error('toggleUserStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

// Reset user password
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { password: passwordHash }
    });

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    console.error('resetUserPassword error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset user password.' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword
};
