import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../lib/prisma';
import { formatUser } from '../lib/userFormat';
import { projectService, AppError } from '../services/projectService';
import { invitationController } from './invitationController';
import { checkCanCreateProject } from '../services/subscriptionService';
import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '../validations/projectValidation';

function handleError(res: Response, err: unknown, label: string): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed.',
      issues: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(`[projectController] ${label}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function getAllProjects(req: Request, res: Response) {
  try {
    const projects = await projectService.getAllForUser(req.userId);
    res.json(projects);
  } catch (err) {
    handleError(res, err, 'getAllProjects');
  }
}

export async function getProjectById(req: Request, res: Response) {
  try {
    const project = await projectService.getById(req.params.projectId as string, req.userId);
    res.json(project);
  } catch (err) {
    handleError(res, err, 'getProjectById');
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const data = createProjectSchema.parse(req.body);
    
    // Enforce Plan Limits
    const canCreate = await checkCanCreateProject(req.userId);
    if (!canCreate) {
      res.status(403).json({ error: "LIMIT_REACHED", message: "You have reached your project limit. Please upgrade your plan." });
      return;
    }

    const project = await projectService.create(data, req.userId);
    res.status(201).json(project);
  } catch (err) {
    handleError(res, err, 'createProject');
  }
}

export async function updateProject(req: Request, res: Response) {
  try {
    const data = updateProjectSchema.parse(req.body);
    const project = await projectService.update(req.params.projectId as string, data);
    res.json(project);
  } catch (err) {
    handleError(res, err, 'updateProject');
  }
}

export async function deleteProject(req: Request, res: Response) {
  try {
    await projectService.delete(req.params.projectId as string);
    res.json({ success: true, message: 'Project deactivated successfully.' });
  } catch (err) {
    handleError(res, err, 'deleteProject');
  }
}

export async function getProjectMembers(req: Request, res: Response) {
  try {
    const members = await projectService.getMembers(req.params.projectId as string);
    res.json(members);
  } catch (err) {
    handleError(res, err, 'getProjectMembers');
  }
}

export async function inviteMember(req: Request, res: Response) {
  return invitationController.createInvitation(req, res);
}

export async function updateMemberRole(req: Request, res: Response) {
  try {
    const { role } = updateMemberRoleSchema.parse(req.body);
    const updated = await projectService.updateMemberRole(req.params.projectId as string, req.params.userId as string, role);
    res.json(updated);
  } catch (err) {
    handleError(res, err, 'updateMemberRole');
  }
}

export async function removeMember(req: Request, res: Response) {
  try {
    await projectService.removeMember(req.params.projectId as string, req.params.userId as string);
    res.json({ success: true, message: 'Member removed from the project successfully.' });
  } catch (err) {
    handleError(res, err, 'removeMember');
  }
}

export async function getProjectNotes(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId as string;
    const notes = await prisma.note.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: { user: true },
    });

    const formatted = notes.map((n) => ({
      id: n.id,
      projectId: n.projectId,
      userId: n.userId,
      title: n.title,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      user: formatUser(n.user),
    }));

    res.json(formatted);
  } catch (err) {
    handleError(res, err, 'getProjectNotes');
  }
}

export async function deleteProjectNote(req: Request, res: Response) {
  try {
    const noteId = req.params.noteId as string;
    await prisma.note.delete({
      where: { id: noteId },
    });
    res.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err) {
    handleError(res, err, 'deleteProjectNote');
  }
}