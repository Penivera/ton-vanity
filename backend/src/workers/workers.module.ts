import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { VanityModule } from '../vanity/vanity.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [VanityModule, NotificationsModule],
  providers: [WorkerService],
  controllers: [WorkerController],
})
export class WorkersModule {}
