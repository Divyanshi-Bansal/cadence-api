import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function registerNoteTools(server: McpServer) {
  server.tool(
    "create_note",
    "Create a project wiki note or documentation document (e.g. API guidelines, setup guides).",
    {
      projectId: z.string().describe("The project CUID"),
      title: z.string().describe("Note title"),
      content: z.string().describe("Detailed note content text"),
      userId: z.string().optional().describe("User CUID creating the note. Defaults to CADENCE_USER_ID."),
    },
    async ({ projectId, title, content, userId }) => {
      try {
        const effectiveUserId = userId || process.env.CADENCE_USER_ID || (await prisma.user.findFirst())?.id;
        if (!effectiveUserId) {
          return {
            content: [{ type: "text" as const, text: "Error: userId parameter or CADENCE_USER_ID is required to create a note." }],
            isError: true,
          };
        }

        const note = await prisma.note.create({
          data: {
            projectId,
            userId: effectiveUserId,
            title,
            content: {
              type: "doc" as const,
              content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: content }] }],
            },
          },
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: `Project note '${note.title}' successfully created.`, note }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create note: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "search_notes",
    "Search project documentation notes by title or content keywords.",
    {
      projectId: z.string().describe("The project CUID"),
      query: z.string().optional().describe("Keyword to search in title or content. Omit to list all notes."),
    },
    async ({ projectId, query }) => {
      try {
        const notes = await prisma.note.findMany({
          where: { projectId },
          select: { id: true, title: true, content: true, createdAt: true },
        });

        const q = query?.toLowerCase() || "";
        const matchingNotes = notes.filter((n) => {
          if (!q) return true;
          const inTitle = n.title.toLowerCase().includes(q);
          let inContent = false;
          if (n.content && typeof n.content === "object") {
            const strContent = JSON.stringify(n.content).toLowerCase();
            if (strContent.includes(q)) {
              inContent = true;
            }
          }
          return inTitle || inContent;
        });

        if (matchingNotes.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No project notes found matching '${query || "all"}'.` }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: `Found ${matchingNotes.length} note(s)`, notes: matchingNotes }, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to search notes: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
