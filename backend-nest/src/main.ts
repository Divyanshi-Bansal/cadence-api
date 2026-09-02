import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  
  app.use(cookieParser());
  
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  app.enableCors({
    origin: [frontendUrl, "http://localhost:3000"],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4001);
}
bootstrap();
