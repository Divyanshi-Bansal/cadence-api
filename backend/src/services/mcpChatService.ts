import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { prisma } from '../lib/prisma';
import { taskRepository } from '../repositories/taskRepository';
import { aiService } from './aiService';
import { formatUser } from '../lib/userFormat';
import { Priority } from '@prisma/client';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

function convertToMinutes(val: number, unit?: string): number {
  const u = (unit || 'h').toLowerCase();
  if (u === 'm') return Math.round(val);
  if (u === 'd') return Math.round(val * 8 * 60); // 8h workday
  if (u === 'w') return Math.round(val * 5 * 8 * 60); // 5d workweek
  return Math.round(val * 60); // default hours
}

export interface InAppAiChatResult {
  reply: string;
  actionExecuted?: string;
  data?: any;
}

export const mcpChatService = {
  async processUserMessage(
    projectId: string,
    userId: string,
    userMessage: string
  ): Promise<InAppAiChatResult> {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing from environment variables.');
    }

    // 1. Fetch project context (stages, issue types, prefix, task list, members)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        issueTypes: true,
        members: { include: { user: true } },
        tasks: {
          take: 50,
          orderBy: { updatedAt: 'desc' },
          include: { stage: true, assignees: { include: { user: true } } },
        },
      },
    });

    if (!project) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const priorityWeight: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const stagesSummary = project.stages.map((s) => ({ id: s.id, name: s.name, isDoneStage: s.isDoneStage }));
    const membersSummary = project.members.map((m: any) => {
      const clean = formatUser(m.user);
      return {
        userId: m.userId,
        name: clean.name || '',
        email: clean.email || '',
        role: m.role,
      };
    });
    const tasksSummary = project.tasks
      .slice()
      .sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0))
      .map((t) => {
        const assigneesClean = t.assignees.map((a: any) => {
          const clean = formatUser(a.user);
          return clean.name || clean.email || '';
        });
        return {
          id: t.id,
          issueKey: t.issueKey,
          title: t.title,
          priority: t.priority,
          stage: t.stage.name,
          stageId: t.stageId,
          dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
          estimatedMinutes: t.estimatedMinutes,
          assignees: assigneesClean,
        };
      });

    // 2. Define Gemini tools using model candidate list
    const candidateChatModels = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash'];
    let model = genAI.getGenerativeModel({ model: candidateChatModels[0] });

    for (const mName of candidateChatModels) {
      try {
        model = genAI.getGenerativeModel({
          model: mName,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'create_task',
                  description: 'Create a new task or ticket in the project with title, priority, stage, description, due date, duration, or assignee.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING, description: 'Task title' },
                      description: { type: SchemaType.STRING, description: 'Detailed task description' },
                      priority: {
                        type: SchemaType.STRING,
                        format: 'enum',
                        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                        description: 'Priority level (LOW, MEDIUM, HIGH, URGENT)',
                      },
                      stageNameOrId: { type: SchemaType.STRING, description: 'Target stage name (e.g. Backlog, To Do, In Progress, Done)' },
                      assigneeNameOrEmail: { type: SchemaType.STRING, description: 'Name or email of team member to assign task to' },
                      dueDate: { type: SchemaType.STRING, description: 'Due date in YYYY-MM-DD or ISO format' },
                      estimateValue: { type: SchemaType.NUMBER, description: 'Time estimate number (e.g. 4)' },
                      estimateUnit: { type: SchemaType.STRING, description: 'Time estimate unit (m=minutes, h=hours, d=days, w=weeks)' },
                    },
                    required: ['title'],
                  },
                },
                {
                  name: 'update_task',
                  description: 'Update attributes of an existing task/ticket (change priority, due date, duration estimate, title, description, or stage).',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      taskIdOrKey: { type: SchemaType.STRING, description: 'Task ID or issue key (e.g. CAD-15)' },
                      priority: {
                        type: SchemaType.STRING,
                        format: 'enum',
                        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                        description: 'New priority level (LOW, MEDIUM, HIGH, URGENT)',
                      },
                      title: { type: SchemaType.STRING, description: 'New task title' },
                      description: { type: SchemaType.STRING, description: 'New task description' },
                      dueDate: { type: SchemaType.STRING, description: 'New due date in YYYY-MM-DD format' },
                      estimateValue: { type: SchemaType.NUMBER, description: 'New time estimate number (e.g. 4)' },
                      estimateUnit: { type: SchemaType.STRING, description: 'New time estimate unit (m, h, d, w)' },
                      stageNameOrId: { type: SchemaType.STRING, description: 'New stage name or ID' },
                    },
                    required: ['taskIdOrKey'],
                  },
                },
                {
                  name: 'assign_task',
                  description: 'Assign or reassign an existing task/ticket to a project team member by name or email.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      taskIdOrKey: { type: SchemaType.STRING, description: 'Task ID or issue key (e.g. CAD-15)' },
                      assigneeNameOrEmail: { type: SchemaType.STRING, description: 'Name or email of team member to assign' },
                    },
                    required: ['taskIdOrKey', 'assigneeNameOrEmail'],
                  },
                },
                {
                  name: 'update_task_stage',
                  description: 'Move a task to a different stage (e.g., Backlog -> In progress).',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      taskIdOrKey: { type: SchemaType.STRING, description: 'Task ID or issue key (e.g. CAD-1)' },
                      targetStageNameOrId: { type: SchemaType.STRING, description: 'Target stage name or ID' },
                    },
                    required: ['taskIdOrKey', 'targetStageNameOrId'],
                  },
                },
                {
                  name: 'create_subtask',
                  description: 'Add a subtask under a parent task/ticket.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      parentTaskIdOrKey: { type: SchemaType.STRING, description: 'Parent task ID or issue key (e.g. CAD-15)' },
                      title: { type: SchemaType.STRING, description: 'Subtask title' },
                      priority: {
                        type: SchemaType.STRING,
                        format: 'enum',
                        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                        description: 'Priority level',
                      },
                      estimateValue: { type: SchemaType.NUMBER, description: 'Time estimate number' },
                      estimateUnit: { type: SchemaType.STRING, description: 'm, h, d, or w' },
                    },
                    required: ['parentTaskIdOrKey', 'title'],
                  },
                },
                {
                  name: 'delete_task',
                  description: 'Delete a task or ticket from the project.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      taskIdOrKey: { type: SchemaType.STRING, description: 'Task ID or issue key (e.g. CAD-15)' },
                    },
                    required: ['taskIdOrKey'],
                  },
                },
                {
                  name: 'add_comment',
                  description: 'Add a comment or reply to a specific comment on a task/ticket.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      taskIdOrKey: { type: SchemaType.STRING, description: 'Task ID or issue key (e.g. CAD-15)' },
                      content: { type: SchemaType.STRING, description: 'Comment text content' },
                      parentCommentId: { type: SchemaType.STRING, description: 'ID of parent comment if replying to a comment' },
                    },
                    required: ['taskIdOrKey', 'content'],
                  },
                },
                {
                  name: 'search_tasks',
                  description: 'Search tasks by title, key, or priority across all stages.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      query: { type: SchemaType.STRING, description: 'Search term' },
                      priority: { type: SchemaType.STRING, description: 'Filter by priority level (HIGH, URGENT, MEDIUM, LOW)' },
                    },
                  },
                },
                {
                  name: 'ai_generate_tickets',
                  description: 'Auto-decompose a feature brief into actionable task tickets.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      brief: { type: SchemaType.STRING, description: 'Feature description' },
                    },
                    required: ['brief'],
                  },
                },
              ],
            },
          ],
        });
        break;
      } catch (err) {
        // try next candidate
      }
    }

    const systemPrompt = `You are Cadence AI Assistant, an expert Agile Copilot embedded inside the Cadence Web UI for Project "${project.name}" (Prefix: ${project.taskPrefix}).
Available Stages: ${JSON.stringify(stagesSummary)}
Project Members: ${JSON.stringify(membersSummary)}
Tasks (Sorted High to Low Priority): ${JSON.stringify(tasksSummary)}

CRITICAL RULES:
1. You have FULL PERMISSIONS to perform ANY task action requested by the user:
   - To change priority, due date, duration, title, or description ➔ call \`update_task\` function.
   - To assign or reassign a task ➔ call \`assign_task\` function.
   - To move task between stages ➔ call \`update_task_stage\` function.
   - To add a subtask under a task ➔ call \`create_subtask\` function.
   - To delete a task ➔ call \`delete_task\` function.
   - To add a comment or reply to a comment ➔ call \`add_comment\` function.
2. NEVER deny or refuse task modifications. ALWAYS execute the matching tool call for the user's request.
3. When searching or summarizing tasks:
   - If no tasks match a search or filter (e.g. 0 high/urgent priority tasks found), state clearly: "There are currently no High or Urgent priority tasks found across any of the available stages."
   - List tasks under each stage strictly in descending priority order (URGENT -> HIGH -> MEDIUM -> LOW). Format priorities as [HIGH], [MEDIUM], [LOW], [URGENT].
4. Always refer to team members by their real names or emails, NEVER output raw internal IDs or encrypted strings.
5. Always be concise, professional, and clear.`;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: `Understood! I am Cadence AI Copilot for project "${project.name}". How can I help you today?` }] },
      ],
    });

    const response = await chat.sendMessage(userMessage);
    const functionCalls = response.response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      return {
        reply: response.response.text(),
      };
    }

    // Process function call
    const call = functionCalls[0];
    const args: any = call.args;
    let actionResultText = '';
    let executedData: any = null;

    if (call.name === 'create_task') {
      const defaultStage = project.stages[0];
      let targetStageId = defaultStage.id;
      let targetStageName = defaultStage.name;

      if (args.stageNameOrId) {
        const found = project.stages.find(
          (s) => s.name.toLowerCase() === args.stageNameOrId.toLowerCase() || s.id === args.stageNameOrId
        );
        if (found) {
          targetStageId = found.id;
          targetStageName = found.name;
        }
      }

      let assigneeIds: string[] = [];
      let assignedMemberName: string | null = null;

      if (args.assigneeNameOrEmail) {
        const query = args.assigneeNameOrEmail.toLowerCase();
        const matched = project.members.find((m: any) => {
          const clean = formatUser(m.user);
          const uName = (clean.name || '').toLowerCase();
          const uEmail = (clean.email || '').toLowerCase();
          return uName.includes(query) || uEmail.includes(query);
        });
        if (matched) {
          const clean = formatUser(matched.user);
          assigneeIds = [matched.userId];
          assignedMemberName = clean.name || clean.email || 'Team Member';
        }
      }

      let dueDateParsed: Date | undefined = undefined;
      if (args.dueDate) {
        const d = new Date(args.dueDate);
        if (!isNaN(d.getTime())) dueDateParsed = d;
      }

      let estimatedMinutes: number | undefined = undefined;
      if (args.estimateValue !== undefined) {
        estimatedMinutes = convertToMinutes(args.estimateValue, args.estimateUnit);
      }

      const created = await taskRepository.create({
        projectId,
        stageId: targetStageId,
        title: args.title,
        description: args.description
          ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: args.description }] }] }
          : undefined,
        priority: (args.priority as Priority) || 'MEDIUM',
        reporterId: userId,
        assigneeIds,
        dueDate: dueDateParsed,
        estimatedMinutes,
      });

      const assigneeNotice = assignedMemberName
        ? ` and assigned to ${assignedMemberName}`
        : args.assigneeNameOrEmail
        ? ` (Member '${args.assigneeNameOrEmail}' not found)`
        : '';

      actionResultText = `Task '${created.title}' (${created.issueKey}) created in stage '${targetStageName}' with ${created.priority} priority${assigneeNotice}.`;
      executedData = created;
    } else if (call.name === 'update_task') {
      const targetTask = project.tasks.find(
        (t) => t.id === args.taskIdOrKey || t.issueKey?.toLowerCase() === args.taskIdOrKey.toLowerCase()
      );

      if (!targetTask) {
        actionResultText = `Task '${args.taskIdOrKey}' not found in project.`;
      } else {
        const updateData: any = {};
        const changesList: string[] = [];

        if (args.priority) {
          updateData.priority = args.priority as Priority;
          changesList.push(`priority to ${args.priority}`);
        }

        if (args.title) {
          updateData.title = args.title;
          changesList.push(`title to '${args.title}'`);
        }

        if (args.description) {
          updateData.description = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: args.description }] }],
          };
          changesList.push('description updated');
        }

        if (args.dueDate) {
          const d = new Date(args.dueDate);
          if (!isNaN(d.getTime())) {
            updateData.dueDate = d;
            changesList.push(`due date to ${d.toLocaleDateString()}`);
          }
        }

        if (args.estimateValue !== undefined) {
          const calculatedMinutes = convertToMinutes(args.estimateValue, args.estimateUnit);
          updateData.estimatedMinutes = calculatedMinutes;
          changesList.push(`time duration to ${args.estimateValue}${args.estimateUnit || 'h'}`);
        }

        if (args.stageNameOrId) {
          const foundStage = project.stages.find(
            (s) => s.name.toLowerCase() === args.stageNameOrId.toLowerCase() || s.id === args.stageNameOrId
          );
          if (foundStage) {
            updateData.stageId = foundStage.id;
            changesList.push(`stage to '${foundStage.name}'`);
          }
        }

        if (Object.keys(updateData).length === 0) {
          actionResultText = `No valid attribute fields specified to update on task '${targetTask.issueKey}'.`;
        } else {
          const updated = await taskRepository.update(targetTask.id, updateData);
          actionResultText = `Task '${targetTask.title}' (${targetTask.issueKey}) updated: ${changesList.join(', ')}.`;
          executedData = updated;
        }
      }
    } else if (call.name === 'assign_task') {
      const targetTask = project.tasks.find(
        (t) => t.id === args.taskIdOrKey || t.issueKey?.toLowerCase() === args.taskIdOrKey.toLowerCase()
      );

      if (!targetTask) {
        actionResultText = `Task '${args.taskIdOrKey}' not found in project.`;
      } else {
        const query = (args.assigneeNameOrEmail || '').toLowerCase();
        const matched = project.members.find((m: any) => {
          const clean = formatUser(m.user);
          const uName = (clean.name || '').toLowerCase();
          const uEmail = (clean.email || '').toLowerCase();
          return uName.includes(query) || uEmail.includes(query);
        });

        if (!matched) {
          const availableNames = project.members
            .map((m: any) => {
              const clean = formatUser(m.user);
              return clean.name || clean.email;
            })
            .filter(Boolean)
            .join(', ');
          actionResultText = `Team member '${args.assigneeNameOrEmail}' not found. Available members in this project: ${availableNames}`;
        } else {
          const cleanMatched = formatUser(matched.user);
          const updated = await taskRepository.update(targetTask.id, {
            assigneeIds: [matched.userId],
          });
          const memberName = cleanMatched.name || cleanMatched.email || 'Team Member';
          actionResultText = `Task '${targetTask.title}' (${targetTask.issueKey}) successfully assigned to ${memberName}.`;
          executedData = updated;
        }
      }
    } else if (call.name === 'update_task_stage') {
      const targetTask = project.tasks.find(
        (t) => t.id === args.taskIdOrKey || t.issueKey?.toLowerCase() === args.taskIdOrKey.toLowerCase()
      );

      if (!targetTask) {
        actionResultText = `Task '${args.taskIdOrKey}' not found.`;
      } else {
        const targetStage = project.stages.find(
          (s) => s.name.toLowerCase() === args.targetStageNameOrId.toLowerCase() || s.id === args.targetStageNameOrId
        );

        if (!targetStage) {
          actionResultText = `Stage '${args.targetStageNameOrId}' not found. Available stages: ${project.stages.map((s) => s.name).join(', ')}`;
        } else {
          const updated = await taskRepository.update(targetTask.id, { stageId: targetStage.id });
          actionResultText = `Task '${targetTask.title}' (${targetTask.issueKey}) moved to stage '${targetStage.name}'.`;
          executedData = updated;
        }
      }
    } else if (call.name === 'create_subtask') {
      const parentTask = project.tasks.find(
        (t) => t.id === args.parentTaskIdOrKey || t.issueKey?.toLowerCase() === args.parentTaskIdOrKey.toLowerCase()
      );

      if (!parentTask) {
        actionResultText = `Parent task '${args.parentTaskIdOrKey}' not found.`;
      } else {
        let estimatedMinutes: number | undefined = undefined;
        if (args.estimateValue !== undefined) {
          estimatedMinutes = convertToMinutes(args.estimateValue, args.estimateUnit);
        }

        const createdSubtask = await taskRepository.create({
          projectId,
          stageId: parentTask.stageId,
          title: args.title,
          parentTaskId: parentTask.id,
          priority: (args.priority as Priority) || parentTask.priority,
          estimatedMinutes,
          reporterId: userId,
        });

        actionResultText = `Subtask '${createdSubtask.title}' (${createdSubtask.issueKey}) created under parent task '${parentTask.issueKey}'.`;
        executedData = createdSubtask;
      }
    } else if (call.name === 'delete_task') {
      const targetTask = project.tasks.find(
        (t) => t.id === args.taskIdOrKey || t.issueKey?.toLowerCase() === args.taskIdOrKey.toLowerCase()
      );

      if (!targetTask) {
        actionResultText = `Task '${args.taskIdOrKey}' not found.`;
      } else {
        await taskRepository.delete(targetTask.id);
        actionResultText = `Task '${targetTask.title}' (${targetTask.issueKey}) deleted from project.`;
        executedData = { deletedTaskId: targetTask.id };
      }
    } else if (call.name === 'add_comment') {
      const targetTask = project.tasks.find(
        (t) => t.id === args.taskIdOrKey || t.issueKey?.toLowerCase() === args.taskIdOrKey.toLowerCase()
      );

      if (!targetTask) {
        actionResultText = `Task '${args.taskIdOrKey}' not found.`;
      } else {
        const comment = await prisma.comment.create({
          data: {
            taskId: targetTask.id,
            userId,
            replyToId: args.parentCommentId || undefined,
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: args.content }] }] },
          },
          include: { user: true },
        });
        const replyNote = args.parentCommentId ? ' (reply)' : '';
        actionResultText = `Comment${replyNote} added to task '${targetTask.title}' (${targetTask.issueKey}).`;
        executedData = comment;
      }
    } else if (call.name === 'search_tasks') {
      const matches = project.tasks.filter((t) => {
        let match = true;
        if (args.query) {
          const q = args.query.toLowerCase();
          match = t.title.toLowerCase().includes(q) || (t.issueKey ? t.issueKey.toLowerCase().includes(q) : false);
        }
        if (args.priority) {
          match = match && t.priority === args.priority;
        }
        if (!args.priority && userMessage.toLowerCase().includes("high")) {
          match = match && (t.priority === "HIGH" || t.priority === "URGENT");
        }
        return match;
      });

      if (matches.length === 0) {
        actionResultText = `There are currently no High or Urgent priority tasks found across any of the available stages.`;
      } else {
        const prioritySort: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const sortedMatches = matches.slice().sort((a, b) => (prioritySort[b.priority] || 0) - (prioritySort[a.priority] || 0));
        actionResultText = `Found ${sortedMatches.length} tasks: ${JSON.stringify(sortedMatches.map(t => ({ issueKey: t.issueKey, title: t.title, priority: t.priority, stage: t.stage.name })))}`;
      }
      executedData = matches;
    } else if (call.name === 'ai_generate_tickets') {
      try {
        const generated = await aiService.generateTicketsFromBrief(args.brief);
        const defaultStage = project.stages[0];
        const createdTasks = [];

        for (const t of generated) {
          const created = await taskRepository.create({
            projectId,
            stageId: defaultStage.id,
            title: t.title,
            description: t.description
              ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t.description }] }] }
              : undefined,
            priority: (t.priority as Priority) || 'MEDIUM',
            reporterId: userId,
          });
          createdTasks.push(created);
        }
        actionResultText = `Generated and created ${createdTasks.length} tickets in ${defaultStage.name}.`;
        executedData = createdTasks;
      } catch (genErr: any) {
        console.error('[mcpChatService] Error in ai_generate_tickets:', genErr);
        actionResultText = `Unable to generate tickets automatically at this moment due to Gemini API rate limits. Please try again in a few seconds.`;
      }
    }

    // Follow up to summarize the execution result for the user
    const followUpRes = await chat.sendMessage(
      `[ActionResult]: ${actionResultText}. Summarize this explicitly for the user in 1 short sentence.`
    );

    return {
      reply: followUpRes.response.text(),
      actionExecuted: call.name,
      data: executedData,
    };
  },
};
