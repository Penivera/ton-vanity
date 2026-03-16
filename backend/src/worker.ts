import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrapWorker() {
  process.env.ENABLE_BULLMQ_WORKER = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  console.log('BullMQ worker started');

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

bootstrapWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
