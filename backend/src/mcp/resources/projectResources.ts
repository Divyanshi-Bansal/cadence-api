import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "../../lib/prisma";
import { formatUser } from "../../lib/userFormat";

export function registerProjectResources(server: McpServer) {
  // 1. Projects Overview Resource
  server.resource(
    "all-projects",
    "cadence://projects",
    async (uri) => {
      const projects = await prisma.project.findMany({
        where: { status: "ACTIVE" },
        include: {
          _count: { select: { tasks: true, members: true } },
          stages: { select: { id: true, name: true, order: true } },
        },
        orderBy: { name: "asc" },
      });

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(projects, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 2. Project Board Resource
  server.resource(
    "project-board",
    new ResourceTemplate("cadence://project/{projectId}/board", { list: undefined }),
    async (uri, { projectId }) => {
      const pId = Array.isArray(projectId) ? projectId[0] : projectId;
      const project = await prisma.project.findUnique({
        where: { id: pId },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              tasks: {
                include: {
                  assignees: { include: { user: true } },
                  subtasks: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!project) {
        throw new Error(`Project with ID ${pId} not found`);
      }

      // Format human-readable markdown board view
      let markdown = `# Board: ${project.name} (Prefix: ${project.taskPrefix})\n\n`;
      for (const stage of project.stages) {
        markdown += `## ${stage.name} (${stage.tasks.length} tasks)\n`;
        if (stage.tasks.length === 0) {
          markdown += `_No tasks_\n\n`;
          continue;
        }
        for (const t of stage.tasks) {
          const assignees = t.assignees
            .map((a) => {
              if (!a.user) return "Unassigned";
              const clean = formatUser(a.user);
              return clean.name || clean.email;
            })
            .join(", ") || "Unassigned";

          markdown += `- **[${t.issueKey || t.id}]** ${t.title} (Priority: ${t.priority}, Assignees: ${assignees})\n`;
          if (t.subtasks && t.subtasks.length > 0) {
            for (const st of t.subtasks) {
              markdown += `  - Subtask: [${st.issueKey || st.id}] ${st.title}\n`;
            }
          }
        }
        markdown += `\n`;
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: markdown,
            mimeType: "text/markdown",
          },
        ],
      };
    }
  );
}
