import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { prisma } from '../lib/prisma';
import { taskRepository } from '../repositories/taskRepository';
import { userRepository } from '../repositories/userRepository';
import { aiService } from './aiService';
import { stageService } from './stageService';
import { checkCanInviteMember } from './subscriptionService';
import { sendInvitationEmail } from '../lib/email';
import { formatUser } from '../lib/userFormat';
import { Priority } from '@prisma/client';
import crypto from 'crypto';

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
                  description: 'Move a single task to a different stage (e.g., Backlog -> In progress).',
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
                  name: 'bulk_move_tasks',
                  description: 'Move multiple tasks from one stage to another simultaneously (optionally filtered by priority).',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      sourceStageNameOrId: { type: SchemaType.STRING, description: 'Source stage name (e.g. Backlog)' },
                      targetStageNameOrId: { type: SchemaType.STRING, description: 'Target stage name (e.g. To Do)' },
                      priorityFilter: { type: SchemaType.STRING, description: 'Optional priority filter (HIGH, URGENT, MEDIUM, LOW)' },
                    },
                    required: ['sourceStageNameOrId', 'targetStageNameOrId'],
                  },
                },
                {
                  name: 'bulk_assign_tasks',
                  description: 'Assign multiple tasks in a stage or priority level to a project team member.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      assigneeNameOrEmail: { type: SchemaType.STRING, description: 'Name or email of team member to assign' },
                      stageNameOrId: { type: SchemaType.STRING, description: 'Optional target stage filter (e.g. In Progress)' },
                      priorityFilter: { type: SchemaType.STRING, description: 'Optional priority filter (e.g. HIGH)' },
                    },
                    required: ['assigneeNameOrEmail'],
                  },
                },
                {
                  name: 'get_team_workload',
                  description: 'Analyze member workload, open task counts, assigned priorities, and capacity reports for team members across stages.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      memberNameOrEmail: { type: SchemaType.STRING, description: 'Optional name or email of team member to filter workload for' },
                    },
                  },
                },
                {
                  name: 'get_overdue_tasks',
                  description: 'Find overdue tasks or tasks approaching due dates across all stages.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'create_note',
                  description: 'Create a project wiki note or documentation document (e.g. API guidelines, setup guides).',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING, description: 'Note title' },
                      content: { type: SchemaType.STRING, description: 'Detailed note content text' },
                    },
                    required: ['title', 'content'],
                  },
                },
                {
                  name: 'search_notes',
                  description: 'Search project documentation notes by title or content keywords.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      query: { type: SchemaType.STRING, description: 'Optional search keyword' },
                    },
                  },
                },
                {
                  name: 'create_stage',
                  description: 'Create a new Kanban board stage/column for the project.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      name: { type: SchemaType.STRING, description: 'New column stage name (e.g. Code Review, QA & Testing)' },
                    },
                    required: ['name'],
                  },
                },
                {
                  name: 'rename_stage',
                  description: 'Rename an existing Kanban board stage/column.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      oldStageNameOrId: { type: SchemaType.STRING, description: 'Current stage name or ID' },
                      newStageName: { type: SchemaType.STRING, description: 'New stage name' },
                    },
                    required: ['oldStageNameOrId', 'newStageName'],
                  },
                },
                {
                  name: 'delete_stage',
                  description: 'Delete an empty Kanban board stage/column from the project.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      stageNameOrId: { type: SchemaType.STRING, description: 'Stage name or ID to delete' },
                    },
                    required: ['stageNameOrId'],
                  },
                },
                {
                  name: 'invite_member',
                  description: 'Invite a new team member to the project via email with a specified role (MEMBER, ADMIN, VIEWER).',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                      email: { type: SchemaType.STRING, description: 'Email address of the invitee' },
                      role: {
                        type: SchemaType.STRING,
                        format: 'enum',
                        enum: ['MEMBER', 'ADMIN', 'VIEWER'],
                        description: 'Project role (MEMBER, ADMIN, VIEWER)',
                      },
                    },
                    required: ['email'],
                  },
                },
                {
                  name: 'list_members',
                  description: 'List all current team members and their roles in the project.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: {},
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
1. You have FULL PERMISSIONS to perform ANY task action, team query, documentation command, column stage action, or member invitation requested by the user:
   - To change priority, due date, duration, title, or description ➔ call \`update_task\` function.
   - To assign or reassign a task ➔ call \`assign_task\` function.
   - To move a single task between stages ➔ call \`update_task_stage\` function.
   - To move multiple tasks at once ➔ call \`bulk_move_tasks\` function.
   - To assign multiple tasks at once ➔ call \`bulk_assign_tasks\` function.
   - To analyze team workload or capacity ➔ call \`get_team_workload\` function.
   - To find overdue tasks ➔ call \`get_overdue_tasks\` function.
   - To create a project note or wiki doc ➔ call \`create_note\` function.
   - To search project notes or docs ➔ call \`search_notes\` function.
   - To create a new board column/stage ➔ call \`create_stage\` function.
   - To rename a board column/stage ➔ call \`rename_stage\` function.
   - To delete an empty board column/stage ➔ call \`delete_stage\` function.
   - To invite a team member via email ➔ call \`invite_member\` function.
   - To list current team members and roles ➔ call \`list_members\` function.
   - To add a subtask under a task ➔ call \`create_subtask\` function.
   - To delete a task ➔ call \`delete_task\` function.
   - To add a comment or reply to a comment ➔ call \`add_comment\` function.
2. NEVER deny or refuse requests. ALWAYS execute the matching tool call for the user's prompt.
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
    } else if (call.name === 'bulk_move_tasks') {
      const sourceStage = project.stages.find(
        (s) => s.name.toLowerCase() === args.sourceStageNameOrId.toLowerCase() || s.id === args.sourceStageNameOrId
      );
      const targetStage = project.stages.find(
        (s) => s.name.toLowerCase() === args.targetStageNameOrId.toLowerCase() || s.id === args.targetStageNameOrId
      );

      if (!sourceStage) {
        actionResultText = `Source stage '${args.sourceStageNameOrId}' not found. Available stages: ${project.stages.map((s) => s.name).join(', ')}`;
      } else if (!targetStage) {
        actionResultText = `Target stage '${args.targetStageNameOrId}' not found. Available stages: ${project.stages.map((s) => s.name).join(', ')}`;
      } else {
        const matchingTasks = project.tasks.filter((t) => {
          let match = t.stageId === sourceStage.id;
          if (args.priorityFilter) {
            match = match && t.priority.toUpperCase() === args.priorityFilter.toUpperCase();
          }
          return match;
        });

        if (matchingTasks.length === 0) {
          const pFilterNotice = args.priorityFilter ? ` with ${args.priorityFilter} priority` : '';
          actionResultText = `No tasks found in stage '${sourceStage.name}'${pFilterNotice} to move.`;
        } else {
          const movedTasks = [];
          for (const t of matchingTasks) {
            const updated = await taskRepository.update(t.id, { stageId: targetStage.id });
            movedTasks.push(updated);
          }
          const pFilterNotice = args.priorityFilter ? ` (${args.priorityFilter} priority)` : '';
          actionResultText = `Successfully moved ${movedTasks.length} task(s)${pFilterNotice} from stage '${sourceStage.name}' to '${targetStage.name}'.`;
          executedData = movedTasks;
        }
      }
    } else if (call.name === 'bulk_assign_tasks') {
      const query = (args.assigneeNameOrEmail || '').toLowerCase();
      const matched = project.members.find((m: any) => {
        const clean = formatUser(m.user);
        const uName = (clean.name || '').toLowerCase();
        const uEmail = (clean.email || '').toLowerCase();
        return uName.includes(query) || uEmail.includes(query);
      });

      if (!matched) {
        actionResultText = `Team member '${args.assigneeNameOrEmail}' not found in project.`;
      } else {
        const cleanMatched = formatUser(matched.user);
        let targetStageId: string | null = null;
        if (args.stageNameOrId) {
          const stg = project.stages.find(
            (s) => s.name.toLowerCase() === args.stageNameOrId.toLowerCase() || s.id === args.stageNameOrId
          );
          if (stg) targetStageId = stg.id;
        }

        const matchingTasks = project.tasks.filter((t) => {
          let match = true;
          if (targetStageId) {
            match = match && t.stageId === targetStageId;
          }
          if (args.priorityFilter) {
            match = match && t.priority.toUpperCase() === args.priorityFilter.toUpperCase();
          }
          return match;
        });

        if (matchingTasks.length === 0) {
          actionResultText = `No matching tasks found to assign to ${cleanMatched.name || cleanMatched.email}.`;
        } else {
          const assignedTasks = [];
          for (const t of matchingTasks) {
            const updated = await taskRepository.update(t.id, { assigneeIds: [matched.userId] });
            assignedTasks.push(updated);
          }
          const memberName = cleanMatched.name || cleanMatched.email || 'Team Member';
          actionResultText = `Successfully assigned ${assignedTasks.length} task(s) to ${memberName}.`;
          executedData = assignedTasks;
        }
      }
    } else if (call.name === 'get_team_workload') {
      const query = (args.memberNameOrEmail || '').toLowerCase();
      const membersReport: any[] = [];

      for (const m of project.members) {
        const clean = formatUser((m as any).user);
        const mName = clean.name || clean.email || 'Team Member';
        const mEmail = clean.email || '';

        if (query && !mName.toLowerCase().includes(query) && !mEmail.toLowerCase().includes(query)) {
          continue;
        }

        const assignedTasks = project.tasks.filter((t: any) =>
          t.assignees.some((a: any) => a.userId === m.userId)
        );

        const openTasks = assignedTasks.filter((t: any) => !t.stage.isDoneStage);
        const urgentCount = openTasks.filter((t: any) => t.priority === 'URGENT').length;
        const highCount = openTasks.filter((t: any) => t.priority === 'HIGH').length;
        const mediumCount = openTasks.filter((t: any) => t.priority === 'MEDIUM').length;
        const lowCount = openTasks.filter((t: any) => t.priority === 'LOW').length;
        const totalEstMinutes = openTasks.reduce((acc: number, t: any) => acc + (t.estimatedMinutes || 0), 0);

        membersReport.push({
          member: mName,
          email: mEmail,
          role: m.role,
          totalAssigned: assignedTasks.length,
          totalOpenTasks: openTasks.length,
          priorities: { URGENT: urgentCount, HIGH: highCount, MEDIUM: mediumCount, LOW: lowCount },
          totalEstimatedHours: (totalEstMinutes / 60).toFixed(1),
        });
      }

      if (membersReport.length === 0) {
        actionResultText = `No workload data found for member matching '${args.memberNameOrEmail}'.`;
      } else {
        actionResultText = `Team Workload Report: ${JSON.stringify(membersReport)}`;
        executedData = membersReport;
      }
    } else if (call.name === 'get_overdue_tasks') {
      const now = new Date();
      const overdue = project.tasks
        .filter((t: any) => {
          if (!t.dueDate) return false;
          if (t.stage.isDoneStage) return false;
          return new Date(t.dueDate) < now;
        })
        .map((t: any) => ({
          issueKey: t.issueKey,
          title: t.title,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
          priority: t.priority,
          stage: t.stage.name,
          assignees: t.assignees.map((a: any) => formatUser(a.user).name || formatUser(a.user).email),
        }));

      if (overdue.length === 0) {
        actionResultText = `Great news! There are currently 0 overdue tasks in this project.`;
      } else {
        actionResultText = `Found ${overdue.length} overdue task(s): ${JSON.stringify(overdue)}`;
      }
      executedData = overdue;
    } else if (call.name === 'create_note') {
      const note = await prisma.note.create({
        data: {
          projectId,
          userId,
          title: args.title,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: args.content }] }],
          },
        },
        include: { user: true },
      });
      actionResultText = `Project note '${note.title}' successfully created.`;
      executedData = note;
    } else if (call.name === 'search_notes') {
      const notes = await prisma.note.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        include: { user: true },
      });

      const query = (args.query || '').toLowerCase();
      const matchingNotes = notes
        .filter((n: any) => {
          if (!query) return true;
          const titleMatch = n.title.toLowerCase().includes(query);
          const contentStr = JSON.stringify(n.content || {}).toLowerCase();
          return titleMatch || contentStr.includes(query);
        })
        .map((n: any) => {
          let plainContent = '';
          try {
            const parsed = typeof n.content === 'string' ? JSON.parse(n.content) : n.content;
            plainContent = parsed?.content?.[0]?.content?.[0]?.text || JSON.stringify(parsed);
          } catch {
            plainContent = String(n.content || '');
          }
          return {
            id: n.id,
            title: n.title,
            contentSnippet: plainContent.slice(0, 200),
            author: formatUser(n.user).name || formatUser(n.user).email,
            updatedAt: n.updatedAt.toISOString().split('T')[0],
          };
        });

      if (matchingNotes.length === 0) {
        actionResultText = `No project notes found matching '${args.query || 'all'}'.`;
      } else {
        actionResultText = `Found ${matchingNotes.length} note(s): ${JSON.stringify(matchingNotes)}`;
        executedData = matchingNotes;
      }
    } else if (call.name === 'create_stage') {
      const newStage = await stageService.create(projectId, args.name);
      actionResultText = `Board column '${newStage.name}' successfully created.`;
      executedData = newStage;
    } else if (call.name === 'rename_stage') {
      const targetStage = project.stages.find(
        (s) => s.name.toLowerCase() === args.oldStageNameOrId.toLowerCase() || s.id === args.oldStageNameOrId
      );
      if (!targetStage) {
        actionResultText = `Column '${args.oldStageNameOrId}' not found. Available columns: ${project.stages.map((s) => s.name).join(', ')}`;
      } else {
        const updated = await stageService.update(projectId, targetStage.id, { name: args.newStageName });
        actionResultText = `Board column '${targetStage.name}' successfully renamed to '${updated.name}'.`;
        executedData = updated;
      }
    } else if (call.name === 'delete_stage') {
      const targetStage = project.stages.find(
        (s) => s.name.toLowerCase() === args.stageNameOrId.toLowerCase() || s.id === args.stageNameOrId
      );
      if (!targetStage) {
        actionResultText = `Column '${args.stageNameOrId}' not found. Available columns: ${project.stages.map((s) => s.name).join(', ')}`;
      } else {
        const tasksInStage = project.tasks.filter((t) => t.stageId === targetStage.id);
        if (tasksInStage.length > 0) {
          actionResultText = `Cannot delete column '${targetStage.name}' because it contains ${tasksInStage.length} active task(s). Please move the tasks to another column first.`;
        } else {
          await stageService.delete(projectId, targetStage.id);
          actionResultText = `Board column '${targetStage.name}' successfully deleted.`;
          executedData = { deletedStageId: targetStage.id };
        }
      }
    } else if (call.name === 'invite_member') {
      const inviter = await prisma.user.findUnique({ where: { id: userId } });
      const inviterMember = project.members.find((m: any) => m.userId === userId);
      const isOwnerOrAdmin = inviterMember ? (inviterMember.role === 'OWNER' || inviterMember.role === 'ADMIN') : false;

      if (!isOwnerOrAdmin) {
        actionResultText = `Only project Owners and Admins can invite new members.`;
      } else {
        const canInvite = await checkCanInviteMember(projectId, userId);
        if (!canInvite) {
          actionResultText = `Project member limit reached. Please upgrade your plan to invite more members.`;
        } else {
          const inviteEmail = args.email.trim();
          const existingUser = await userRepository.findByEmail(inviteEmail);
          if (existingUser) {
            const existingMember = project.members.find((m: any) => m.userId === existingUser.id);
            if (existingMember) {
              actionResultText = `User '${inviteEmail}' is already a member of this project.`;
            }
          }

          if (!actionResultText) {
            const existingInvite = await prisma.invitation.findFirst({
              where: { projectId, email: inviteEmail, status: 'PENDING' },
            });

            if (existingInvite) {
              actionResultText = `A pending invitation already exists for '${inviteEmail}'.`;
            } else {
              const token = crypto.randomBytes(32).toString('hex');
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 7);

              const invRole = args.role || 'MEMBER';
              const invitation = await prisma.invitation.create({
                data: {
                  email: inviteEmail,
                  projectId,
                  role: invRole,
                  invitedById: userId,
                  token,
                  expiresAt,
                  status: 'PENDING',
                },
              });

              const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
              const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;
              const cleanInviter = inviter ? formatUser(inviter) : { name: '', email: '' };
              const inviterName = cleanInviter.name || 'A team member';

              try {
                await sendInvitationEmail(inviteEmail, inviterName, project.name, inviteLink);
              } catch (e) {
                console.error('[mcpChatService] sendInvitationEmail error:', e);
              }

              actionResultText = `Invitation successfully created and sent to '${inviteEmail}' as ${invRole}.`;
              executedData = invitation;
            }
          }
        }
      }
    } else if (call.name === 'list_members') {
      const membersList = project.members.map((m: any) => {
        const clean = formatUser(m.user);
        return {
          userId: m.userId,
          name: clean.name || 'Team Member',
          email: clean.email || '',
          role: m.role,
        };
      });
      actionResultText = `Project Team Members: ${JSON.stringify(membersList)}`;
      executedData = membersList;
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
