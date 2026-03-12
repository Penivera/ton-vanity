import { Controller, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { VanityService } from '../vanity/vanity.service';

@Controller('workers')
export class WorkerController {
  constructor(
    private readonly workerService: WorkerService,
    private readonly vanityService: VanityService,
  ) {}

  @Get('status')
  async getStatus() {
    const queue = await this.vanityService.countByStatus();
    const runtime = this.workerService.getCurrentState();

    return {
      runtime,
      queue,
      timestamp: new Date().toISOString(),
    };
  }
}
