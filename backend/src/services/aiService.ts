import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface GeneratedTask {
  title: string;
  description: string;
  issueType: 'Feature' | 'Task' | 'Bug';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedMinutes: number;
  tags?: string[];
  subtasks?: GeneratedTask[];
}

export const aiService = {
  async generateTicketsFromBrief(brief: string): Promise<GeneratedTask[]> {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment variables.');
    }

    const taskSchemaProperties = {
      title: {
        type: SchemaType.STRING,
        description: 'A concise and clear title for the Agile ticket.'
      },
      description: {
        type: SchemaType.STRING,
        description: 'A detailed description of the task, including acceptance criteria if applicable.'
      },
      issueType: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: ['Feature', 'Task', 'Bug'],
        description: 'The type of the ticket.'
      },
      priority: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        description: 'The priority of the ticket.'
      },
      estimatedMinutes: {
        type: SchemaType.INTEGER,
        description: 'Estimated time to complete the task in minutes.'
      },
      tags: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: 'List of tags to assign to the task (e.g. Operational, Backend, Frontend).'
      }
    };

    const taskSchema: any = {
      type: SchemaType.OBJECT,
      properties: { ...taskSchemaProperties },
      required: ['title', 'description', 'issueType', 'priority', 'estimatedMinutes', 'tags']
    };

    taskSchema.properties.subtasks = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: taskSchemaProperties,
        required: ['title', 'description', 'issueType', 'priority', 'estimatedMinutes', 'tags']
      },
      description: 'Optional list of subtasks if this is a large task that should be broken down.'
    };

    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash'];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: SchemaType.ARRAY,
              items: taskSchema
            }
          }
        });

        const prompt = `You are an expert Technical Product Manager and Tech Lead. I will provide you with a project brief or requirements document. 
Your task is to break it down into highly technical, actionable Agile tickets (Features, Tasks, and Bugs) tailored for real-world developers.

IMPORTANT INSTRUCTIONS:
1. Clear and Concise: Write titles that are simple, direct, and easy to understand at a glance (e.g., "Add Google OAuth Login" instead of "Implement Federated Identity Authentication via Google OAuth 2.0"). 
2. Concise Descriptions: Keep descriptions brief and to the point. Focus on the *what* and *why*. Provide high-level technical guidance only if absolutely necessary.
3. Acceptance Criteria: Include a short, bulleted list of 2-4 clear, testable acceptance criteria. Do not over-explain.
4. Tags: Assign relevant tags to each task (e.g., "Frontend", "Backend", "Database", "DevOps", "Security", "Design"). A task can have multiple tags.
5. Subtasks: If a task is large or complex (e.g., an entire feature), break it down into smaller, focused subtasks using the "subtasks" array. Parent tasks should act as Epics/Features, while subtasks should be the actionable development units. Subtasks cannot have their own subtasks.
6. Comprehensive Scope: Do not just generate tasks for explicitly mentioned examples. If the prompt implies a broader scope, generate tasks for the entire implied scope.

Project Brief:
"""
${brief}
"""`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);
        return parsed as GeneratedTask[];
      } catch (err: any) {
        console.warn(`[aiService] Model ${modelName} failed or rate limited:`, err?.message || err);
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to generate tickets due to AI rate limits or unavailable models.');
  }
};
