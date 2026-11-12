import { Controller, Get } from '@nestjs/common';
import { createHealthResponse, type HealthResponse } from './health';

@Controller('api/v1')
export class AppController {
  @Get('health')
  health(): HealthResponse {
    return createHealthResponse();
  }
}
