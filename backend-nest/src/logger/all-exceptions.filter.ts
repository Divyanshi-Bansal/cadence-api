import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message || 'Internal server error';

    const stack = (exception as Error)?.stack;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: typeof message === 'object' ? message : { message },
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - Error: ${JSON.stringify(message)}`,
        stack,
      );

      // Report 500+ server errors to Sentry
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(exception, {
          tags: {
            path: request.url,
            method: request.method,
          },
          extra: {
            statusCode: status,
            body: request.body,
          },
        });
      }
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - Client Warning: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
