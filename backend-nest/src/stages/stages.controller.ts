import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StagesService } from './stages.service';
import { CreateStageDto, UpdateStageDto, ReorderStagesDto } from './stages.dto';

@Controller('projects/:projectId/stages')
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStage(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.stagesService.create(projectId, dto);
  }

  @Put('reorder')
  async reorderStages(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderStagesDto,
  ) {
    await this.stagesService.reorder(projectId, dto);
    return { success: true, message: 'Columns reordered successfully.' };
  }

  @Patch(':stageId')
  async updateStage(
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.stagesService.update(projectId, stageId, dto);
  }

  @Delete(':stageId')
  async deleteStage(
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
  ) {
    await this.stagesService.delete(projectId, stageId);
    return { success: true, message: 'Column removed successfully.' };
  }
}
