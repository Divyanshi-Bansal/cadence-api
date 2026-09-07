import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerWorkflowPrompts(server: McpServer) {
  // 1. Sprint Planning Prompt
  server.prompt(
    "sprint_planning",
    "Template for conducting a sprint planning session on a Cadence project.",
    {
      projectName: z.string().describe("Name of the project to plan"),
      sprintGoal: z.string().describe("Main objective/goal for this sprint"),
    },
    ({ projectName, sprintGoal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are acting as an Agile Scrum Master for the project "${projectName}".
Sprint Goal: "${sprintGoal}".

Please perform the following actions:
1. List all active projects and query tasks in the Backlog stage for "${projectName}".
2. Evaluate task priorities, estimates, and dependencies relative to the Sprint Goal.
3. Propose a set of tasks to move into "To Do" for the upcoming sprint.
4. Highlight any high-risk tasks or missing subtasks that need to be created.`,
          },
        },
      ],
    })
  );

  // 2. Feature Breakdown Prompt
  server.prompt(
    "feature_breakdown",
    "Template for decomposing a raw feature specification into Cadence Agile tickets.",
    {
      featureName: z.string().describe("Name of the feature"),
      specification: z.string().describe("Detailed feature description or PRD"),
    },
    ({ featureName, specification }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are an expert Technical Lead breaking down a new feature "${featureName}" for implementation in Cadence.

Feature Specification:
"""
${specification}
"""

Please use the \`ai_generate_tickets\` tool to auto-generate structured technical tasks (Features, Tasks, Bugs, Subtasks) and preview or create them in the designated project.`,
          },
        },
      ],
    })
  );
}
