import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    const token = authHeader.slice(7).trim();
    const accessSecret = process.env.JWT_ACCESS_SECRET;

    if (!accessSecret) {
      console.error('[JwtAuthGuard] JWT_ACCESS_SECRET environment variable is missing.');
      throw new InternalServerErrorException('Internal server configuration error.');
    }

    try {
      const payload = jwt.verify(token, accessSecret) as jwt.JwtPayload;

      if (!payload || !payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid token payload.');
      }

      request.userId = payload.sub;
      request.user = { userId: payload.sub, id: payload.sub }; // Compatibility for getMe expecting user.userId or user.id
      return true;
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired.');
      }
      throw new UnauthorizedException('Invalid access token.');
    }
  }
}
