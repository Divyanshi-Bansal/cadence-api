import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireWorkspaceRole } from '../middlewares/requireWorkspaceRole';
import {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  getWorkspaceProjects,
  moveProject,
} from '../controllers/workspaceController';

const router = Router();

router.use(requireAuth); // every workspace route requires auth

router.get('/', getAllWorkspaces);
router.post('/', createWorkspace);
router.get('/:workspaceId', getWorkspaceById);
router.patch('/:workspaceId', requireWorkspaceRole(['OWNER', 'ADMIN']), updateWorkspace);
router.delete('/:workspaceId', requireWorkspaceRole(['OWNER']), deleteWorkspace);

router.get('/:workspaceId/members', getWorkspaceMembers);
router.post('/:workspaceId/members', requireWorkspaceRole(['OWNER', 'ADMIN']), inviteMember);
router.patch('/:workspaceId/members/:userId', requireWorkspaceRole(['OWNER', 'ADMIN']), updateMemberRole);
router.delete('/:workspaceId/members/:userId', requireWorkspaceRole(['OWNER', 'ADMIN']), removeMember);

router.get('/:workspaceId/projects', getWorkspaceProjects);
router.post('/:workspaceId/projects/move', requireWorkspaceRole(['OWNER', 'ADMIN']), moveProject);

export default router;