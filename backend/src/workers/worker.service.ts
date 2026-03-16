import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { TelegramNotificationService } from '../notifications/telegram-notification.service';
import { User } from '../users/entities/user.entity';
import { GenerationStatus, MatchType, VanityGeneration } from '../vanity/entities/vanity-generation.entity';
import { VanityService } from '../vanity/vanity.service';
import {
  DEFAULT_TARGET_ADDRESS_KIND,
  GenerationMetadata,
  TargetAddressKind,
} from '../vanity/types/generation-metadata';
import { runVanitySearch } from './vanity-search';
import { VANITY_GENERATION_QUEUE } from './queue.constants';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private isBusy = false;
  private currentGenerationId: string | null = null;
  private worker: Worker<{ generationId: string }> | null = null;

  constructor(
    private readonly vanityService: VanityService,
    private readonly telegramNotificationService: TelegramNotificationService,
  ) {}

  onModuleInit(): void {
    const shouldRunWorker = process.env.ENABLE_BULLMQ_WORKER === 'true';
    if (!shouldRunWorker) {
      this.logger.log('BullMQ worker disabled for this process');
      return;
    }

    this.worker = new Worker<{ generationId: string }>(
      VANITY_GENERATION_QUEUE,
      async (job: Job<{ generationId: string }>) => {
        await this.processById(job);
      },
      {
        connection: this.getRedisConnection(),
        concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Completed generation job ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      const id = job?.id || 'unknown';
      this.logger.error(`Generation job ${id} failed: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;
  }

  getCurrentState() {
    return {
      isBusy: this.isBusy,
      currentGenerationId: this.currentGenerationId,
      workerEnabled: process.env.ENABLE_BULLMQ_WORKER === 'true',
    };
  }

  private async processById(job: Job<{ generationId: string }>): Promise<void> {
    const generationId = job.data.generationId;
    const generation = await this.vanityService.getGenerationWithUser(generationId);
    if (!generation) {
      throw new Error(`Generation ${generationId} not found`);
    }

    this.isBusy = true;
    this.currentGenerationId = generation.id;

    try {
      await this.vanityService.updateStatus(generation.id, GenerationStatus.RUNNING);
      await this.processGeneration(generation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Generation failed for ${generation.id}: ${message}`);

      const totalAttempts = Number(job.opts.attempts || 1);
      const nextAttempt = job.attemptsMade + 1;
      const willRetry = nextAttempt < totalAttempts;

      if (willRetry) {
        await this.vanityService.updateStatus(generation.id, GenerationStatus.PENDING, `Retry ${nextAttempt}/${totalAttempts}: ${message}`);
      } else {
        await this.vanityService.updateStatus(generation.id, GenerationStatus.FAILED, message);
      }

      throw error;
    } finally {
      this.currentGenerationId = null;
      this.isBusy = false;
    }
  }

  private async processGeneration(generation: VanityGeneration): Promise<void> {
    const metadata = this.parseMetadata(generation.backgroundJobId);
    const targetKind = metadata.targetKind ?? DEFAULT_TARGET_ADDRESS_KIND;

    if (targetKind !== TargetAddressKind.TOKEN && !metadata.targetAddress) {
      throw new Error('Missing target address in generation metadata');
    }

    const result = await runVanitySearch({
      pattern: generation.prefix || generation.suffix || '',
      matchType: generation.matchType as MatchType,
      targetAddress: metadata.targetAddress,
      targetKind,
      tokenConfig: metadata.tokenConfig,
      network: generation.network,
    });

    await this.vanityService.saveResult(generation.id, {
      address: result.address,
      rawAddress: result.rawAddress,
      salt: result.salt,
    });

    const owner = (generation as VanityGeneration & { user?: User }).user;
    if (owner?.telegramId) {
      await this.telegramNotificationService.sendGenerationComplete({
        telegramId: owner.telegramId,
        pattern: generation.prefix || generation.suffix || '',
        matchType: generation.matchType,
        address: result.address,
        attempts: result.attempts,
      });
    }
  }

  private parseMetadata(raw: string | null): Partial<GenerationMetadata> {
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GenerationMetadata>;
      return {
        ...parsed,
        targetKind: parsed.targetKind ?? DEFAULT_TARGET_ADDRESS_KIND,
      };
    } catch {
      return {};
    }
  }

  private getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && redisUrl.trim().length > 0) {
      return { url: redisUrl };
    }

    return {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }
}
