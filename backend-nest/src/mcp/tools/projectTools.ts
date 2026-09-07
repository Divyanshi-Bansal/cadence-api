import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectRepository } from "../../repositories/projectRepository";
import { prisma } from "../../lib/prisma";

export function registerProjectTools(server: McpServer) {
  // 1. List Projects
  server.tool(
    "list_projects",
    "List projects in the Cadence workspace. If userId is provided, filters projects where the user is a member. Otherwise lists all active projects.",
    {
      userId: z.string().optional().describe("Filter by user CUID. Defaults to process.env.CADENCE_USER_ID if set."),
    },
    async ({ userId }) => {
      try {
        const effectiveUserId = userId || process.env.CADENCE_USER_ID;
        if (effectiveUserId) {
          const projects = await projectRepository.findAllForUser(effectiveUserId);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
          };
        }

        // Fallback: list all active projects in database
        const projects = await prisma.project.findMany({
          where: { status: "ACTIVE" },
          include: {
            _count: { select: { tasks: true, members: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const formatted = projects.map((p) => ({
          id: p.id,
          name: p.name,
          projectType: p.projectType,
          description: p.description,
          status: p.status,
          taskPrefix: p.taskPrefix,
          taskCount: p.taskCount,
          totalTasks: p._count.tasks,
          totalMembers: p._count.members,
          createdAt: p.createdAt,
        }));

        return {
          content: [{ type: "text" as const, text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to list projects: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // 2. Get Project Details
  const getProjectDetailsHandler = async ({ projectId, userId }: any) => {
    try {
      const effectiveUserId = userId || process.env.CADENCE_USER_ID;
      
      if (effectiveUserId) {
        const projectDetails = await projectRepository.findByIdForUser(projectId, effectiveUserId);
        if (projectDetails) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(projectDetails, null, 2) }],
          };
        }
      }

      // Direct fetch if no user context filter
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          stages: { orderBy: { order: "asc" } },
          issueTypes: true,
          members: { include: { user: true } },
          tasks: {
            include: {
              assignees: { include: { user: true } },
              stage: true,
              issueType: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!project) {
        return {
          content: [{ type: "text" as const, text: `Project with ID '${projectId}' not found.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Failed to get project details: ${error.message}` }],
        isError: true,
      };
    }
  };

  const getProjectDetailsSchema = {
    projectId: z.string().describe("The CUID of the project"),
    userId: z.string().optional().describe("User CUID performing the query. Defaults to CADENCE_USER_ID."),
  };

  server.tool(
    "get_project_details",
    "Get detailed project view including Kanban stages (columns), issue types, members, and all tasks.",
    getProjectDetailsSchema,
    getProjectDetailsHandler
  );

  server.tool(
    "summary_project",
    "Alias for get_project_details. Get detailed project view including Kanban stages, members, and tasks.",
    getProjectDetailsSchema,
    getProjectDetailsHandler
  );


  // 3. Create Project
  server.tool(
    "create_project",
    "Create a new Cadence project. Automatically initializes standard Kanban stages (Backlog, To Do, In Progress, Done) and issue types (Task, Bug, Feature).",
    {
      name: z.string().min(1).describe("Name of the project"),
      projectType: z.string().optional().describe("Category/Type (e.g. 'Software', 'Marketing', 'Design')"),
      description: z.string().optional().describe("Summary description of the project"),
      ownerId: z.string().optional().describe("User CUID of the project owner. Defaults to CADENCE_USER_ID."),
    },
    async ({ name, projectType, description, ownerId }) => {
      try {
        const effectiveOwnerId = ownerId || process.env.CADENCE_USER_ID;
        if (!effectiveOwnerId) {
          return {
            content: [{ type: "text" as const, text: "Error: ownerId parameter or CADENCE_USER_ID env variable is required to create a project." }],
            isError: true,
          };
        }

        const project = await projectRepository.create(
          { name, projectType, description },
          effectiveOwnerId
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: "Project created successfully", project }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create project: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // 4. Archive/Delete Project
  server.tool(
    "archive_project",
    "Archive a Cadence project by setting its status to INACTIVE.",
    {
      projectId: z.string().describe("Project CUID to archive"),
    },
    async ({ projectId }) => {
      try {
        const archived = await projectRepository.delete(projectId);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: "Project archived successfully", projectId: archived.id }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to archive project: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
