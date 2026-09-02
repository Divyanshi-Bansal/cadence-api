import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  UsePipes,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'nestjs-zod';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  userId: string;
}

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
@UsePipes(ZodValidationPipe)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  async getTaskComments(@Param('taskId') taskId: string) {
    const comments = await this.commentsService.getTaskComments(taskId);
    return { comments };
  }

  @Post()
  async createComment(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.commentsService.createComment(
      taskId,
      req.userId,
      dto,
    );
    return { comment };
  }

  @Patch(':commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCommentDto,
  ) {
    const comment = await this.commentsService.updateComment(
      commentId,
      req.userId,
      dto,
    );
    return { comment };
  }

  @Delete(':commentId')
  async deleteComment(
    @Param('commentId') commentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commentsService.deleteComment(commentId, req.userId);
  }
}
