import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { ProjectRoleGuard } from '../auth/guards/project-role.guard';
import {
  CreateProjectDto,
  UpdateProjectDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './projects.dto';

// Stub for checkCanCreateProject (simulate subscription check)
const checkCanCreateProject = async (userId: string) => true;

@UseGuards(JwtAuthGuard)
@UsePipes(ZodValidationPipe)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async getAllProjects(@Req() req: Request) {
    return this.projectsService.getAllForUser(req.userId!);
  }

  @Get(':projectId')
  async getProjectById(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const project = await this.projectsService.getById(projectId, req.userId!);
    if (!project) {
      throw new NotFoundException('Project not found or access denied.');
    }
    return project;
  }

  @Post()
  async createProject(
    @Body() body: CreateProjectDto,
    @Req() req: Request,
  ) {
    const canCreate = await checkCanCreateProject(req.userId!);
    if (!canCreate) {
      throw new ForbiddenException({
        error: 'LIMIT_REACHED',
        message: 'You have reached your project limit. Please upgrade your plan.',
      });
    }

    return this.projectsService.create(body, req.userId!);
  }

  // @UseGuards(ProjectRoleGuard)
  @Put(':projectId')
  async updateProject(
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, body);
  }

  // @UseGuards(ProjectRoleGuard)
  @Delete(':projectId')
  async deleteProject(@Param('projectId') projectId: string) {
    await this.projectsService.delete(projectId);
    return { success: true, message: 'Project deactivated successfully.' };
  }

  @Get(':projectId/members')
  async getProjectMembers(@Param('projectId') projectId: string) {
    return this.projectsService.getMembers(projectId);
  }

  // @UseGuards(ProjectRoleGuard)
  @Post(':projectId/members')
  async inviteMember(
    @Param('projectId') projectId: string,
    @Body() body: InviteMemberDto,
  ) {
    return this.projectsService.inviteMember(projectId, body.email, body.role);
  }

  // @UseGuards(ProjectRoleGuard)
  @Put(':projectId/members/:userId')
  async updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.projectsService.updateMemberRole(projectId, userId, body.role);
  }

  // @UseGuards(ProjectRoleGuard)
  @Delete(':projectId/members/:userId')
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    await this.projectsService.removeMember(projectId, userId);
    return { success: true, message: 'Member removed from the project successfully.' };
  }

  @Get(':projectId/notes')
  async getProjectNotes(@Param('projectId') projectId: string) {
    return this.projectsService.getProjectNotes(projectId);
  }

  // @UseGuards(ProjectRoleGuard)
  @Delete(':projectId/notes/:noteId')
  async deleteProjectNote(@Param('noteId') noteId: string) {
    return this.projectsService.deleteProjectNote(noteId);
  }
}
