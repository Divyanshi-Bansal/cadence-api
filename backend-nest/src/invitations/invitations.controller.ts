import { Controller, Post, Body, Req, Get, Param, Delete, UseGuards, UsePipes } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';

@Controller('invitations')
@UsePipes(ZodValidationPipe)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createInvitation(@Req() req: Request, @Body() createInvitationDto: CreateInvitationDto) {
    return this.invitationsService.createInvitation(req.userId!, createInvitationDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyInvitations(@Req() req: Request) {
    return this.invitationsService.getMyInvitations(req.userId!);
  }

  @Get('project/:projectId')
  @UseGuards(JwtAuthGuard)
  async getProjectInvitations(@Req() req: Request, @Param('projectId') projectId: string) {
    return this.invitationsService.getProjectInvitations(req.userId!, projectId);
  }

  @Get(':token')
  async getInvitation(@Param('token') token: string) {
    return this.invitationsService.getInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(@Req() req: Request, @Param('token') token: string) {
    return this.invitationsService.acceptInvitation(req.userId!, token);
  }

  @Post(':token/decline')
  @UseGuards(JwtAuthGuard)
  async declineInvitation(@Req() req: Request, @Param('token') token: string) {
    return this.invitationsService.declineInvitation(req.userId!, token);
  }

  @Delete(':invitationId')
  @UseGuards(JwtAuthGuard)
  async revokeInvitation(@Req() req: Request, @Param('invitationId') invitationId: string) {
    return this.invitationsService.revokeInvitation(req.userId!, invitationId);
  }
}
