const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

/**
 * JWT Authentication Middleware
 * Strictly validates JWT tokens from Authorization header or query parameter.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

  if (!token && req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Valid authentication token required.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;

    if (decoded.id) {
      try {
        const activeUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, name: true, role: true, active: true }
        });

        if (activeUser) {
          if (activeUser.active === false) {
            return res.status(403).json({
              success: false,
              message: 'Account is deactivated.'
            });
          }
          req.user = activeUser;
        }
      } catch (e) {
        // Non-fatal, use decoded payload
      }
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Grants access to specified roles; ADMIN has universal administrative access.
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization check.'
      });
    }

    const userRole = req.user.role;
    if (userRole === 'ADMIN' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
    });
  };
};

/**
 * Optional Authentication Middleware
 * Decodes user if token provided, but doesn't block request if absent.
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
      req.user = decoded;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth
};
