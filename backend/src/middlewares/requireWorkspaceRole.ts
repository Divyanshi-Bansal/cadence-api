import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export function requireWorkspaceRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.userId } },
      });

      if (!member || !allowedRoles.includes(member.role)) {
        res.status(403).json({ error: 'Insufficient permissions for this workspace.' });
        return;
      }

      next();
    } catch (err) {
      console.error('[requireWorkspaceRole]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}