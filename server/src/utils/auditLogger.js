const prisma = require('../config/prisma');

/**
 * Enterprise Audit Logger
 * Records immutable audit events for sensitive medical, financial, and administrative operations.
 */
async function logAuditEvent({
  action,
  entity,
  entityId = null,
  userId = null,
  userName = null,
  ipAddress = null,
  details = null,
  req = null,
  tx = null
}) {
  try {
    const effectiveUserId = userId || req?.user?.id || null;
    const effectiveUserName = userName || req?.user?.name || req?.user?.role || (req?.user?.email ? req.user.email.split('@')[0] : 'System');
    const effectiveIp = ipAddress || req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null;
    
    let serializedDetails = details;
    if (typeof details === 'object' && details !== null) {
      try {
        serializedDetails = JSON.stringify(details);
      } catch {
        serializedDetails = String(details);
      }
    }

    const client = tx || prisma;
    return await client.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        userId: effectiveUserId ? String(effectiveUserId) : null,
        userName: effectiveUserName,
        ipAddress: effectiveIp ? String(effectiveIp) : null,
        details: serializedDetails ? String(serializedDetails) : null
      }
    });
  } catch (err) {
    console.error(`[AUDIT_LOG_ERROR] Failed to record audit log for ${action} on ${entity}:`, err.message);
    return null;
  }
}

module.exports = {
  logAuditEvent
};
