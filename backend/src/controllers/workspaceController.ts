import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { workspaceService, AppError } from '../services/workspaceService';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  moveProjectSchema,
} from '../validations/workspaceValidation';

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
  console.error(`[workspaceController] ${label}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function getAllWorkspaces(req: Request, res: Response) {
  try {
    const workspaces = await workspaceService.getAllForUser(req.userId);
    res.json(workspaces);
  } catch (err) {
    handleError(res, err, 'getAllWorkspaces');
  }
}

export async function getWorkspaceById(req: Request, res: Response) {
  try {
    const workspace = await workspaceService.getById(req.params.workspaceId as string, req.userId);
    res.json(workspace);
  } catch (err) {
    handleError(res, err, 'getWorkspaceById');
  }
}

export async function createWorkspace(req: Request, res: Response) {
  try {
    const data = createWorkspaceSchema.parse(req.body);
    const workspace = await workspaceService.create(data, req.userId);
    res.status(201).json(workspace);
  } catch (err) {
    handleError(res, err, 'createWorkspace');
  }
}

export async function updateWorkspace(req: Request, res: Response) {
  try {
    const data = updateWorkspaceSchema.parse(req.body);
    const workspace = await workspaceService.update(req.params.workspaceId as string, data);
    res.json(workspace);
  } catch (err) {
    handleError(res, err, 'updateWorkspace');
  }
}

export async function deleteWorkspace(req: Request, res: Response) {
  try {
    await workspaceService.delete(req.params.workspaceId as string);
    res.json({ success: true, message: 'Workspace deleted. Projects were unassigned, not removed.' });
  } catch (err) {
    handleError(res, err, 'deleteWorkspace');
  }
}

export async function getWorkspaceMembers(req: Request, res: Response) {
  try {
    const members = await workspaceService.getMembers(req.params.workspaceId as string);
    res.json(members);
  } catch (err) {
    handleError(res, err, 'getWorkspaceMembers');
  }
}

export async function inviteMember(req: Request, res: Response) {
  try {
    const { email, role } = inviteMemberSchema.parse(req.body);
    await workspaceService.inviteMember(req.params.workspaceId as string, email, role);
    res.json({ success: true, message: 'User successfully added to the workspace.' });
  } catch (err) {
    handleError(res, err, 'inviteMember');
  }
}

export async function updateMemberRole(req: Request, res: Response) {
  try {
    const { role } = updateMemberRoleSchema.parse(req.body);
    const updated = await workspaceService.updateMemberRole(req.params.workspaceId as string, req.params.userId as string, role);
    res.json(updated);
  } catch (err) {
    handleError(res, err, 'updateMemberRole');
  }
}

export async function removeMember(req: Request, res: Response) {
  try {
    await workspaceService.removeMember(req.params.workspaceId as string, req.params.userId as string);
    res.json({ success: true, message: 'Member removed from the workspace successfully.' });
  } catch (err) {
    handleError(res, err, 'removeMember');
  }
}

export async function getWorkspaceProjects(req: Request, res: Response) {
  try {
    const projects = await workspaceService.getProjects(req.params.workspaceId as string);
    res.json(projects);
  } catch (err) {
    handleError(res, err, 'getWorkspaceProjects');
  }
}

export async function moveProject(req: Request, res: Response) {
  try {
    const { projectId, newWorkspaceId } = moveProjectSchema.parse(req.body);
    await workspaceService.moveProject(projectId, req.params.workspaceId as string, newWorkspaceId, req.userId);
    res.json({ projectId, newWorkspaceId, success: true });
  } catch (err) {
    handleError(res, err, 'moveProject');
  }
}