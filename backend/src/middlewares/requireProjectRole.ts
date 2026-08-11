import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export function requireProjectRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId as string;
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: req.userId } },
      });

      if (!member || !allowedRoles.includes(member.role)) {
        res.status(403).json({ error: 'Insufficient permissions for this project.' });
        return;
      }

      next();
    } catch (err) {
      console.error('[requireProjectRole]', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}