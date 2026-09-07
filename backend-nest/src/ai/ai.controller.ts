import { Controller, Post, Body, Param, Req, Res } from '@nestjs/common';
import { AiService } from './ai.service';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const generateSchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters long."),
});
export class GenerateDto extends createZodDto(generateSchema) {}

const chatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty."),
});
export class ChatDto extends createZodDto(chatSchema) {}

const taskSchemaDef: z.ZodType<any> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    issueType: z.string(), // Name of issue type
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    estimatedMinutes: z.number().optional().nullable(),
    tags: z.array(z.string()).optional(),
    subtasks: z.array(taskSchemaDef).optional()
  })
);

const bulkCreateSchema = z.object({
  tasks: z.array(taskSchemaDef).min(1)
});
export class BulkCreateDto extends createZodDto(bulkCreateSchema) {}

@Controller('projects/:projectId')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ai-chat')
  async inAppAiChat(@Param('projectId') projectId: string, @Req() req: any, @Body() body: ChatDto, @Res() res: any) {
    try {
      const userId = req.user?.id || req.userId || process.env.CADENCE_USER_ID || '';
      const result = await this.aiService.processUserMessage(projectId, userId, (body as any).message);
      res.json(result);
    } catch (err: any) {
      console.error('[aiController] inAppAiChat Error:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.issues });
        return;
      }
      res.status(500).json({
        error: 'AI Assistant temporarily unavailable. Please check backend server configuration.',
        reply: 'Sorry, I am temporarily unable to process your request. Please ensure the backend server and Gemini API key are configured correctly.'
      });
    }
  }

  @Post('ai-generate')
  async generateTickets(@Body() body: GenerateDto, @Res() res: any) {
    try {
      const generatedTasks = await this.aiService.generateTicketsFromBrief((body as any).brief);
      res.json(generatedTasks);
    } catch (err: any) {
      console.error('[aiController] generateTickets:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.issues });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to generate tickets' });
    }
  }

  @Post('tasks/bulk')
  async bulkCreateTasks(@Param('projectId') projectId: string, @Req() req: any, @Body() body: BulkCreateDto, @Res() res: any) {
    try {
      const reporterId = req.user?.id || req.userId || process.env.CADENCE_USER_ID || '';
      const created = await this.aiService.bulkCreateTasks(projectId, reporterId, (body as any).tasks);
      res.status(201).json(created);
    } catch (err: any) {
      console.error('[aiController] bulkCreateTasks:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.issues });
        return;
      }
      res.status(err.statusCode || 500).json({ error: err.message || 'Failed to bulk create tickets' });
    }
  }
}
