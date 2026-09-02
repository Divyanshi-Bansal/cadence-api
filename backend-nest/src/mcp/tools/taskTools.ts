import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { taskRepository } from "../../repositories/taskRepository";
import { prisma } from "../../lib/prisma";
import { Priority } from "@prisma/client";
import { formatUser } from "../../lib/userFormat";

export function registerTaskTools(server: McpServer) {
  // 1. Create Task
  const createTaskHandler = async ({ projectId, stageId, issueTypeId, title, description, priority, reporterId, estimatedMinutes, tags, assigneeIds }: any) => {
    try {
      let targetStageId = stageId;
      if (!targetStageId) {
        const firstStage = await prisma.boardStage.findFirst({
          where: { projectId },
          orderBy: { order: "asc" },
        });
        if (!firstStage) {
          return {
            content: [{ type: "text" as const, text: `Project '${projectId}' has no board stages defined.` }],
            isError: true,
          };
        }
        targetStageId = firstStage.id;
      }

      const effectiveReporterId = reporterId || process.env.CADENCE_USER_ID;
      if (!effectiveReporterId) {
        const fallbackUser = await prisma.user.findFirst();
        if (!fallbackUser) {
          return {
            content: [{ type: "text" as const, text: "Error: reporterId parameter or CADENCE_USER_ID env var is required." }],
            isError: true,
          };
        }
      }

      const reporterToUse = effectiveReporterId || (await prisma.user.findFirst())?.id!;

      const task = await taskRepository.create({
        projectId,
        stageId: targetStageId,
        issueTypeId,
        title,
        description: description ? { type: "doc" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: description }] }] } : undefined,
        priority: priority as Priority,
        reporterId: reporterToUse,
        estimatedMinutes: estimatedMinutes || null,
        tags: tags || [],
        assigneeIds: assigneeIds || [],
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ message: "Task created successfully", task }, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Failed to create task: ${error.message}` }],
        isError: true,
      };
    }
  };

  const createTaskSchema = {
    projectId: z.string().describe("Project CUID"),
    stageId: z.string().optional().describe("Board stage CUID. If omitted, uses the project's first stage (e.g. Backlog or To Do)."),
    issueTypeId: z.string().optional().describe("Issue type CUID. If omitted, uses default 'Task' type."),
    title: z.string().min(1).describe("Short title of the task"),
    description: z.string().optional().describe("Task description text"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM").describe("Task priority level"),
    reporterId: z.string().optional().describe("User CUID of reporter. Defaults to CADENCE_USER_ID."),
    estimatedMinutes: z.number().optional().describe("Estimated duration in minutes"),
    tags: z.array(z.string()).optional().describe("Tags to attach (e.g., ['Backend', 'Security'])"),
    assigneeIds: z.array(z.string()).optional().describe("User CUIDs to assign to this task"),
  };

  server.tool(
    "create_task",
    "Create a new Agile task/ticket in a project stage. Automatically generates issueKey (e.g., CAD-1, CAD-2).",
    createTaskSchema,
    createTaskHandler
  );

  server.tool(
    "create_ticket",
    "Alias for create_task. Create a new Agile ticket in a project stage.",
    createTaskSchema,
    createTaskHandler
  );

  // 2. Move / Update Task Stage
  server.tool(
    "update_task_stage",
    "Move a task to a different Kanban board stage (e.g. move to 'In Progress' or 'Done').",
    {
      taskId: z.string().describe("The task CUID"),
      stageId: z.string().describe("Target board stage CUID"),
    },
    async ({ taskId, stageId }) => {
      try {
        const updated = await taskRepository.update(taskId, { stageId });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: "Task stage updated successfully", task: updated }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to update task stage: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // 3. Search / Query Tasks
  server.tool(
    "search_tasks",
    "Search tasks across projects by query string, project, stage, or priority.",
    {
      projectId: z.string().optional().describe("Filter by project CUID"),
      stageId: z.string().optional().describe("Filter by stage CUID"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().describe("Filter by priority"),
      query: z.string().optional().describe("Search term matching task title or issueKey (e.g. CAD-1)"),
      limit: z.number().min(1).max(100).optional().default(20).describe("Max results to return"),
    },
    async ({ projectId, stageId, priority, query, limit }) => {
      try {
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (stageId) where.stageId = stageId;
        if (priority) where.priority = priority as Priority;
        if (query) {
          where.OR = [
            { title: { contains: query, mode: "insensitive" } },
            { issueKey: { contains: query, mode: "insensitive" } },
          ];
        }

        const rawTasks = await prisma.task.findMany({
          where,
          take: limit,
          include: {
            project: { select: { name: true, taskPrefix: true } },
            stage: { select: { name: true } },
            assignees: { include: { user: true } },
          },
          orderBy: { updatedAt: "desc" },
        });

        const formatted = rawTasks.map((t) => ({
          ...t,
          assignees: t.assignees.map((a) => ({
            ...a,
            user: a.user ? formatUser(a.user) : null,
          })),
        }));

        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to search tasks: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // 4. Add Task Comment
  server.tool(
    "add_task_comment",
    "Add a comment to a task.",
    {
      taskId: z.string().describe("Task CUID"),
      content: z.string().min(1).describe("Comment text content"),
      authorId: z.string().optional().describe("User CUID of comment author. Defaults to CADENCE_USER_ID."),
    },
    async ({ taskId, content, authorId }) => {
      try {
        const effectiveAuthorId = authorId || process.env.CADENCE_USER_ID || (await prisma.user.findFirst())?.id;
        if (!effectiveAuthorId) {
          return {
            content: [{ type: "text" as const, text: "Error: authorId parameter or CADENCE_USER_ID is required to comment." }],
            isError: true,
          };
        }

        const comment = await prisma.comment.create({
          data: {
            taskId,
            userId: effectiveAuthorId,
            content: { type: "doc" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: content }] }] },
          },
          include: { user: true },
        });

        const formattedComment = {
          ...comment,
          user: comment.user ? formatUser(comment.user) : null,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: "Comment added successfully", comment: formattedComment }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to add comment: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // 5. Delete Task
  server.tool(
    "delete_task",
    "Delete a task and all of its subtasks from Cadence.",
    {
      taskId: z.string().describe("Task CUID to delete"),
    },
    async ({ taskId }) => {
      try {
        await taskRepository.delete(taskId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: `Task ${taskId} deleted successfully.` }) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to delete task: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
