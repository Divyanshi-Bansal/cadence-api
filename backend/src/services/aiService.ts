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

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: taskSchema
        }
      }
    });

    const prompt = `You are an expert technical product manager. I will provide you with a project brief or requirements document. 
Your task is to break it down into actionable Agile tickets (Features, Tasks, and Bugs).
Ensure that the tasks cover the key functionalities described in the brief.

IMPORTANT INSTRUCTIONS:
1. Assign relevant tags to each task. Tags could be "Operational", "Backend", "Frontend", etc. A task can have multiple tags (e.g., ["Frontend", "Backend"]).
2. If a task is large or complex, break it down into smaller subtasks using the "subtasks" array field. Subtasks have the same structure as parent tasks, but they cannot have their own subtasks.

Project Brief:
"""
${brief}
"""`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    try {
      const parsed = JSON.parse(text);
      return parsed as GeneratedTask[];
    } catch (err) {
      console.error('Failed to parse Gemini response as JSON', err);
      throw new Error('Failed to generate tickets due to invalid AI response format.');
    }
  }
};
