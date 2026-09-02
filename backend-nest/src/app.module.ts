import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { StagesModule } from './stages/stages.module';
import { StripeModule } from './stripe/stripe.module';
import { CommentsModule } from './comments/comments.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ApikeysModule } from './apikeys/apikeys.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    StagesModule,
    StripeModule,
    CommentsModule,
    InvitationsModule,
    ApikeysModule,
    AiModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
