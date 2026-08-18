import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { taskService } from '../services/taskService';
import { AppError } from '../services/projectService';
import { z } from 'zod';
import { stageRepository } from '../repositories/stageRepository';
import { prisma } from '../lib/prisma';

const generateSchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters long."),
});

const taskSchemaDef: z.ZodType<any> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    issueType: z.string(), // Name of issue type
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    estimatedMinutes: z.number().optional().nullable(),
    tags: z.array(z.string()).optional(),
    subtasks: z.array(taskSchemaDef).optional()
  })
);

const bulkCreateSchema = z.object({
  tasks: z.array(taskSchemaDef).min(1)
});

export const aiController = {
  async generateTickets(req: Request, res: Response) {
    try {
      const { brief } = generateSchema.parse(req.body);
      const generatedTasks = await aiService.generateTicketsFromBrief(brief);
      res.json(generatedTasks);
    } catch (err: any) {
      console.error('[aiController] generateTickets:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.issues });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to generate tickets' });
    }
  },

  async bulkCreateTasks(req: Request, res: Response) {
    try {
      const projectId = req.params.projectId as string;
      const reporterId = req.userId;
      const { tasks } = bulkCreateSchema.parse(req.body);

      // Find first stage of the project (e.g. "To Do")
      const stages = await prisma.boardStage.findMany({
        where: { projectId },
        orderBy: { order: 'asc' }
      });
      if (stages.length === 0) {
        throw new AppError('No stages found for this project.', 400);
      }
      // Assuming stages are ordered by 'order' property in findByProject
      const defaultStageId = stages[0].id;

      // Get project issue types to map names to IDs
      const projectIssueTypes = await prisma.issueType.findMany({
        where: { projectId: projectId }
      });
      const globalIssueTypes = await prisma.issueType.findMany({
        where: { projectId: null }
      });
      
      const allIssueTypes = [...projectIssueTypes, ...globalIssueTypes];

      // Prepare mapped tasks
      const mapTask = (t: any, parentId?: string): any => {
        let issueType = allIssueTypes.find(it => it.name.toLowerCase() === t.issueType.toLowerCase());
        return {
          stageId: defaultStageId,
          issueTypeId: issueType?.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          tags: t.tags || [],
          subtasks: t.subtasks?.map((st: any) => mapTask(st)) || []
        };
      };

      const mappedTasks = tasks.map(t => mapTask(t));

      const created = await taskService.bulkCreate(projectId, reporterId, mappedTasks);
      res.status(201).json(created);

    } catch (err: any) {
      console.error('[aiController] bulkCreateTasks:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.issues });
        return;
      }
      res.status(err.statusCode || 500).json({ error: err.message || 'Failed to bulk create tickets' });
    }
  }
};
