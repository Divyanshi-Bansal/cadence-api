import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { aiService } from "../../services/aiService";
import { taskRepository } from "../../repositories/taskRepository";
import { prisma } from "../../lib/prisma";

export function registerAiTools(server: McpServer) {
  server.tool(
    "ai_generate_tickets",
    "Use Gemini AI to analyze a feature brief/requirements document and break it down into technical, actionable Agile tickets. Optionally auto-creates them in the project.",
    {
      projectId: z.string().describe("Project CUID to generate tickets for"),
      brief: z.string().min(10).describe("The feature brief, user story, or requirements description"),
      autoCreate: z.boolean().optional().default(false).describe("If true, automatically creates the generated tasks in the project's first stage."),
      reporterId: z.string().optional().describe("User CUID of reporter if autoCreate is true. Defaults to CADENCE_USER_ID."),
    },
    async ({ projectId, brief, autoCreate, reporterId }) => {
      try {
        const generatedTasks = await aiService.generateTicketsFromBrief(brief);

        if (!autoCreate) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ message: "Tickets generated (preview mode). Set autoCreate: true to persist.", generatedTasks }, null, 2) }],
          };
        }

        // Auto-create tasks in project
        const firstStage = await prisma.boardStage.findFirst({
          where: { projectId },
          orderBy: { order: "asc" },
        });

        if (!firstStage) {
          return {
            content: [{ type: "text" as const, text: `Error: Project '${projectId}' has no board stages to add tasks to.` }],
            isError: true,
          };
        }

        const effectiveReporterId = reporterId || process.env.CADENCE_USER_ID || (await prisma.user.findFirst())?.id;
        if (!effectiveReporterId) {
          return {
            content: [{ type: "text" as const, text: "Error: reporterId parameter or CADENCE_USER_ID env var is required to create tasks." }],
            isError: true,
          };
        }

        const createdTasks = [];
        for (const taskData of generatedTasks) {
          // Find matching issueType or default
          const issueType = await prisma.issueType.findFirst({
            where: { projectId, name: { equals: taskData.issueType, mode: "insensitive" } },
          });

          const created = await taskRepository.create({
            projectId,
            stageId: firstStage.id,
            issueTypeId: issueType?.id,
            title: taskData.title,
            description: {
              type: "doc" as const,
              content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: taskData.description }] }],
            },
            priority: taskData.priority,
            reporterId: effectiveReporterId,
            estimatedMinutes: taskData.estimatedMinutes,
            tags: taskData.tags || [],
            subtasks: taskData.subtasks?.map((st) => ({
              stageId: firstStage.id,
              title: st.title,
              description: st.description,
              priority: st.priority,
              estimatedMinutes: st.estimatedMinutes,
              tags: st.tags,
            })),
          });

          createdTasks.push(created);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message: `Successfully generated and created ${createdTasks.length} tasks with subtasks in project ${projectId}`,
              tasks: createdTasks,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `AI ticket generation failed: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
