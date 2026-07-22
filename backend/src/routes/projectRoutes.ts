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
import {
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
} from '../controllers/stageController';
import {
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController';

const router = Router();

router.use(requireAuth); // every project route requires auth

// ── Projects CRUD ────────────────────────────────────────────────────────────
router.get('/', getAllProjects);
router.post('/', createProject);
router.get('/:projectId', getProjectById);
router.patch('/:projectId', requireProjectRole(['OWNER', 'ADMIN']), updateProject);
router.delete('/:projectId', requireProjectRole(['OWNER']), deleteProject);

// ── Members ──────────────────────────────────────────────────────────────────
router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', requireProjectRole(['OWNER', 'ADMIN']), inviteMember);
router.patch('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), updateMemberRole);
router.delete('/:projectId/members/:userId', requireProjectRole(['OWNER', 'ADMIN']), removeMember);

// ── Columns (Stages) ─────────────────────────────────────────────────────────
router.post('/:projectId/stages', requireProjectRole(['OWNER', 'ADMIN']), createStage);
router.put('/:projectId/stages/reorder', requireProjectRole(['OWNER', 'ADMIN']), reorderStages);
router.patch('/:projectId/stages/:stageId', requireProjectRole(['OWNER', 'ADMIN']), updateStage);
router.delete('/:projectId/stages/:stageId', requireProjectRole(['OWNER', 'ADMIN']), deleteStage);

// ── Tasks ────────────────────────────────────────────────────────────────────
router.post('/:projectId/tasks', requireProjectRole(['OWNER', 'ADMIN', 'MEMBER']), createTask);
router.patch('/:projectId/tasks/:taskId', requireProjectRole(['OWNER', 'ADMIN', 'MEMBER']), updateTask);
router.delete('/:projectId/tasks/:taskId', requireProjectRole(['OWNER', 'ADMIN', 'MEMBER']), deleteTask);

export default router;