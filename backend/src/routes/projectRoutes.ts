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
  inviteProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../controllers/projectController';

const router = Router();

router.use(requireAuth);

router.get('/', getAllProjects);
router.post('/', createProject);
router.get('/:projectId', getProjectById);
router.patch('/:projectId', requireProjectRole(['OWNER', 'ADMIN']), updateProject);
router.delete('/:projectId', requireProjectRole(['OWNER']), deleteProject);

router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', requireProjectRole(['OWNER', 'ADMIN']), inviteProjectMember);
router.patch('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), updateProjectMemberRole);
router.delete('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), removeProjectMember);

export default router;