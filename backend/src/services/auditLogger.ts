import prisma from '../lib/prisma';

export interface LogAuditParams {
  bidId?: string;
  action: string;
  actor: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  previousState?: string;
  newState?: string;
  notes?: string;
}

/**
 * Persists an event into the immutable audit trail.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        bidId: params.bidId || null,
        action: params.action,
        actor: params.actor || 'system',
        actorRole: params.actorRole || 'PROCUREMENT_OFFICER',
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        previousState: params.previousState || null,
        newState: params.newState || null,
        notes: params.notes || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log entry:', err);
  }
}
