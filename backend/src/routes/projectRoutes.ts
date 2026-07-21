import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireProjectRole } from '../middlewares/requireProjectRole';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from '../controllers/projectController';

const router = Router();

router.use(requireAuth); // every project route requires auth

router.get('/', getAllProjects);
router.post('/', createProject);
router.get('/:projectId', getProjectById);
router.patch('/:projectId', requireProjectRole(['OWNER', 'ADMIN']), updateProject);
router.delete('/:projectId', requireProjectRole(['OWNER']), deleteProject);

router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', requireProjectRole(['OWNER', 'ADMIN']), inviteMember);
router.patch('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), updateMemberRole);
router.delete('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), removeMember);

export default router;