import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private isBusy = false;
  private currentGenerationId: string | null = null;

  constructor(
    private readonly vanityService: VanityService,
    private readonly telegramNotificationService: TelegramNotificationService,
  ) {}

  onModuleInit(): void {
    setInterval(() => {
      void this.tick();
    }, 1500);
  }

  getCurrentState() {
    return {
      isBusy: this.isBusy,
      currentGenerationId: this.currentGenerationId,
    };
  }

  private async tick(): Promise<void> {
    if (this.isBusy) {
      return;
    }

    const next = await this.vanityService.findNextPending();
    if (!next) {
      return;
    }

    this.isBusy = true;
    this.currentGenerationId = next.id;

    try {
      await this.vanityService.updateStatus(next.id, GenerationStatus.RUNNING);
      await this.processGeneration(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Generation failed for ${next.id}: ${message}`);
      await this.vanityService.updateStatus(next.id, GenerationStatus.FAILED, message);
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
}
