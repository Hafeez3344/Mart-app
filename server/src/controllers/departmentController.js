const prisma = require('../config/prisma');

const getAllDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { staffMembers: true, doctors: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json({ success: true, count: departments.length, departments });
  } catch (error) {
    console.error('getAllDepartments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve departments.' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Department name and code are required.' });
    }

    const department = await prisma.department.create({
      data: { name, code: code.toUpperCase(), description }
    });

    return res.status(201).json({ success: true, message: 'Department created successfully', department });
  } catch (error) {
    console.error('createDepartment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create department.' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(description !== undefined && { description })
      }
    });

    return res.status(200).json({ success: true, message: 'Department updated successfully', department });
  } catch (error) {
    console.error('updateDepartment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update department.' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Department deleted successfully.' });
  } catch (error) {
    console.error('deleteDepartment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete department.' });
  }
};

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
