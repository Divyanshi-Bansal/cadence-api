import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageDto, UpdateStageDto, ReorderStagesDto } from './stages.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(projectId: string, dto: CreateStageDto, userId?: string) {
    const agg = await this.prisma.boardStage.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const maxOrder = agg._max.order ?? -1;
    const newOrder = maxOrder + 1;

    const stage = await this.prisma.boardStage.create({
      data: {
        projectId,
        name: dto.name,
        order: newOrder,
      },
    });

    this.eventsGateway.broadcastToProject(projectId, 'stage:changed', {
      action: 'CREATE',
      stageId: stage.id,
      stage,
      userId,
    });

    return stage;
  }

  async update(projectId: string, stageId: string, dto: UpdateStageDto, userId?: string) {
    const stage = await this.prisma.boardStage.findUnique({
      where: { id: stageId },
    });
    
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Column not found in this project.');
    }
    
    const updatedStage = await this.prisma.boardStage.update({
      where: { id: stageId },
      data: dto,
    });

    this.eventsGateway.broadcastToProject(projectId, 'stage:changed', {
      action: 'UPDATE',
      stageId: updatedStage.id,
      stage: updatedStage,
      userId,
    });

    return updatedStage;
  }

  async delete(projectId: string, stageId: string, userId?: string) {
    const stage = await this.prisma.boardStage.findUnique({
      where: { id: stageId },
    });
    
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Column not found in this project.');
    }
    
    const result = await this.prisma.boardStage.delete({
      where: { id: stageId },
    });

    this.eventsGateway.broadcastToProject(projectId, 'stage:changed', {
      action: 'DELETE',
      stageId,
      userId,
    });

    return result;
  }

  async reorder(projectId: string, dto: ReorderStagesDto, userId?: string) {
    for (const item of dto.stages) {
      const stage = await this.prisma.boardStage.findUnique({
        where: { id: item.id },
      });
      if (!stage || stage.projectId !== projectId) {
        throw new BadRequestException(
          `Column with ID ${item.id} does not belong to this project.`,
        );
      }
    }

    const result = await this.prisma.$transaction(
      dto.stages.map((so) =>
        this.prisma.boardStage.update({
          where: { id: so.id, projectId },
          data: { order: so.order },
        }),
      ),
    );

    this.eventsGateway.broadcastToProject(projectId, 'stage:changed', {
      action: 'REORDER',
      stages: dto.stages,
      userId,
    });

    return result;
  }
}

