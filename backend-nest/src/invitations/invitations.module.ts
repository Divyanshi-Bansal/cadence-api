import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { SubscriptionService } from './subscription.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    SubscriptionService
  ],
})
export class InvitationsModule {}
