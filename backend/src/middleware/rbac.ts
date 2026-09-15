import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    role: UserRole;
  };
}

/**
 * Middleware that extracts user context or sets default role.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const roleHeader = req.headers['x-user-role'] as string;
  const emailHeader = req.headers['x-user-email'] as string;

  const validRoles: UserRole[] = ['ADMIN', 'PROCUREMENT_OFFICER', 'REVIEWER', 'AUDITOR'];
  const role: UserRole = validRoles.includes(roleHeader as UserRole)
    ? (roleHeader as UserRole)
    : 'PROCUREMENT_OFFICER';

  req.user = {
    email: emailHeader || 'officer@gem.gov.in',
    role,
  };

  next();
}

/**
 * Require specific roles for sensitive operations (e.g. override, upload, analyze).
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'PROCUREMENT_OFFICER';

    if (userRole === 'ADMIN' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Access denied. Role '${userRole}' does not have permission for this action. Required: ${allowedRoles.join(', ')}`,
    });
  };
}
