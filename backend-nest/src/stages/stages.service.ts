import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageDto, UpdateStageDto, ReorderStagesDto } from './stages.dto';

@Injectable()
export class StagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateStageDto) {
    const agg = await this.prisma.boardStage.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const maxOrder = agg._max.order ?? -1;
    const newOrder = maxOrder + 1;

    return this.prisma.boardStage.create({
      data: {
        projectId,
        name: dto.name,
        order: newOrder,
      },
    });
  }

  async update(projectId: string, stageId: string, dto: UpdateStageDto) {
    const stage = await this.prisma.boardStage.findUnique({
      where: { id: stageId },
    });
    
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Column not found in this project.');
    }
    
    return this.prisma.boardStage.update({
      where: { id: stageId },
      data: dto,
    });
  }

  async delete(projectId: string, stageId: string) {
    const stage = await this.prisma.boardStage.findUnique({
      where: { id: stageId },
    });
    
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Column not found in this project.');
    }
    
    return this.prisma.boardStage.delete({
      where: { id: stageId },
    });
  }

  async reorder(projectId: string, dto: ReorderStagesDto) {
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

    return this.prisma.$transaction(
      dto.stages.map((so) =>
        this.prisma.boardStage.update({
          where: { id: so.id, projectId },
          data: { order: so.order },
        }),
      ),
    );
  }
}
