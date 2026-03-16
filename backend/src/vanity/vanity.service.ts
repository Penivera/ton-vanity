import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateGenerationDto } from './dto/create-generation.dto';
import {
  VanityGeneration,
  MatchType,
  VanityNetwork,
  GenerationStatus,
} from './entities/vanity-generation.entity';
import { DEFAULT_TARGET_ADDRESS_KIND, TargetAddressKind } from './types/generation-metadata';
import { getVanityQueue } from '../workers/queue';
import { VANITY_GENERATION_QUEUE } from '../workers/queue.constants';

@Injectable()
export class VanityService {
  constructor(
    @InjectRepository(VanityGeneration)
    private generationRepository: Repository<VanityGeneration>,
  ) {}

  async createGeneration(userId: string, dto: CreateGenerationDto): Promise<VanityGeneration> {
    const generation = new VanityGeneration();
    generation.userId = userId;
    generation.prefix = dto.matchType === MatchType.SUFFIX ? null : dto.pattern;
    generation.suffix = dto.matchType === MatchType.SUFFIX ? dto.pattern : null;
    generation.matchType = dto.matchType;
    generation.network = dto.network ?? VanityNetwork.TESTNET;
    generation.status = GenerationStatus.PENDING;
    const targetKind = dto.targetKind ?? DEFAULT_TARGET_ADDRESS_KIND;
    generation.backgroundJobId = JSON.stringify({
      targetAddress: dto.targetAddress,
      targetKind,
      tokenConfig:
        targetKind === TargetAddressKind.TOKEN
          ? {
              tokenMasterCodeBoc: dto.tokenMasterCodeBoc,
              tokenWalletCodeBoc: dto.tokenWalletCodeBoc,
              tokenAdminAddress: dto.tokenAdminAddress,
              tokenContentCellBoc: dto.tokenContentCellBoc,
              tokenTotalSupply: dto.tokenTotalSupply,
            }
          : undefined,
    });
    generation.isDeployed = false;

    const saved = await this.generationRepository.save(generation);

    const queue = getVanityQueue();
    const attempts = Number(process.env.WORKER_JOB_ATTEMPTS || 3);
    const backoffMs = Number(process.env.WORKER_JOB_BACKOFF_MS || 5000);
    await queue.add(
      VANITY_GENERATION_QUEUE,
      { generationId: saved.id },
      {
        jobId: saved.id,
        attempts,
        backoff: {
          type: 'exponential',
          delay: backoffMs,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    return saved;
  }

  async listForUser(userId: string): Promise<VanityGeneration[]> {
    return this.generationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getForUser(userId: string, generationId: string): Promise<VanityGeneration> {
    const generation = await this.generationRepository.findOne({ where: { id: generationId, userId } });
    if (!generation) {
      throw new NotFoundException('Generation not found');
    }
    return generation;
  }

  async findNextPending(): Promise<VanityGeneration | null> {
    return this.generationRepository.findOne({
      where: { status: GenerationStatus.PENDING },
      order: { createdAt: 'ASC' },
      relations: ['user'],
    });
  }

  async updateStatus(id: string, status: GenerationStatus, errorMessage?: string): Promise<void> {
    await this.generationRepository.update(
      { id },
      {
        status,
        errorMessage: errorMessage ?? null,
        completedAt: status === GenerationStatus.COMPLETED ? new Date() : null,
      },
    );
  }

  async saveResult(id: string, result: { address: string; rawAddress: string; salt: string }): Promise<void> {
    await this.generationRepository.update(
      { id },
      {
        status: GenerationStatus.COMPLETED,
        generatedAddress: result.address,
        rawAddress: result.rawAddress,
        generatedSalt: Number(result.salt),
        completedAt: new Date(),
        errorMessage: null,
      },
    );
  }

  async countByStatus(): Promise<Record<string, number>> {
    const statuses = Object.values(GenerationStatus);
    const out: Record<string, number> = {};

    for (const status of statuses) {
      out[status] = await this.generationRepository.count({ where: { status } });
    }

    return out;
  }

  async getGeneration(id: string): Promise<VanityGeneration | null> {
    return this.generationRepository.findOne({ where: { id } });
  }

  async getGenerationWithUser(id: string): Promise<VanityGeneration | null> {
    return this.generationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async updateGenerationStatus(
    id: string,
    status: GenerationStatus,
    data?: {
      address?: string;
      rawAddress?: string;
      salt?: number;
      errorMessage?: string;
      jobId?: string;
    },
  ): Promise<VanityGeneration> {
    const generation = await this.getGeneration(id);
    if (!generation) {
      throw new BadRequestException('Generation not found');
    }

    generation.status = status;

    if (data) {
      if (data.address) generation.generatedAddress = data.address;
      if (data.rawAddress) generation.rawAddress = data.rawAddress;
      if (data.salt) generation.generatedSalt = data.salt;
      if (data.errorMessage) generation.errorMessage = data.errorMessage;
      if (data.jobId) generation.backgroundJobId = data.jobId;
    }

    if (status === GenerationStatus.COMPLETED) {
      generation.completedAt = new Date();
    }

    return this.generationRepository.save(generation);
  }

  async cancelGeneration(id: string): Promise<VanityGeneration> {
    return this.updateGenerationStatus(id, GenerationStatus.CANCELLED);
  }

  async markDeployed(id: string, deployerAddress: string): Promise<VanityGeneration> {
    const generation = await this.getGeneration(id);
    if (!generation) {
      throw new BadRequestException('Generation not found');
    }

    generation.isDeployed = true;
    generation.deployedAt = new Date();
    generation.deployerAddress = deployerAddress;

    return this.generationRepository.save(generation);
  }

  async getPendingGenerations(): Promise<VanityGeneration[]> {
    return this.generationRepository.find({
      where: { status: GenerationStatus.PENDING },
    });
  }

  async getRunningGenerations(): Promise<VanityGeneration[]> {
    return this.generationRepository.find({
      where: { status: GenerationStatus.RUNNING },
    });
  }
}
