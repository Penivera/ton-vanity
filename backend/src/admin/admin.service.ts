import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GenerationStatus, VanityGeneration } from '../vanity/entities/vanity-generation.entity';
import { getVanityQueue } from '../workers/queue';
import { VANITY_GENERATION_QUEUE } from '../workers/queue.constants';

type SupportedDatabase = 'postgres' | 'sqlite';

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  private readonly updatableGenerationStatuses = new Set<GenerationStatus>([
    GenerationStatus.PENDING,
    GenerationStatus.RUNNING,
    GenerationStatus.COMPLETED,
    GenerationStatus.FAILED,
    GenerationStatus.CANCELLED,
  ]);

  async getOverview() {
    return {
      databaseType: this.getDatabaseType(),
      tableCount: (await this.listTables()).length,
      now: new Date().toISOString(),
    };
  }

  async listTables(): Promise<string[]> {
    const dbType = this.getDatabaseType();

    if (dbType === 'postgres') {
      const rows = await this.dataSource.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name ASC`,
      );

      return rows.map((row: { table_name: string }) => row.table_name);
    }

    const rows = await this.dataSource.query(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name ASC`,
    );

    return rows.map((row: { name: string }) => row.name);
  }

  async getTableSchema(table: string) {
    this.ensureSafeIdentifier(table);
    await this.ensureTableExists(table);

    const dbType = this.getDatabaseType();
    if (dbType === 'postgres') {
      return this.dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position ASC`,
        [table],
      );
    }

    const quoted = this.quoteIdentifier(table);
    return this.dataSource.query(`PRAGMA table_info(${quoted})`);
  }

  async getTableRows(table: string, limit = 100, offset = 0) {
    this.ensureSafeIdentifier(table);
    await this.ensureTableExists(table);

    const clampedLimit = this.clamp(limit, 1, 500);
    const safeOffset = Math.max(0, offset);
    const quoted = this.quoteIdentifier(table);
    const dbType = this.getDatabaseType();

    if (dbType === 'postgres') {
      const rows = await this.dataSource.query(
        `SELECT * FROM ${quoted} ORDER BY 1 LIMIT $1 OFFSET $2`,
        [clampedLimit, safeOffset],
      );
      const countRows = await this.dataSource.query(`SELECT COUNT(*)::bigint AS count FROM ${quoted}`);

      return {
        table,
        limit: clampedLimit,
        offset: safeOffset,
        total: Number(countRows[0]?.count || 0),
        rows,
      };
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM ${quoted} ORDER BY 1 LIMIT ? OFFSET ?`,
      [clampedLimit, safeOffset],
    );
    const countRows = await this.dataSource.query(`SELECT COUNT(*) AS count FROM ${quoted}`);

    return {
      table,
      limit: clampedLimit,
      offset: safeOffset,
      total: Number(countRows[0]?.count || 0),
      rows,
    };
  }

  async updateGenerationStatus(
    id: string,
    status: GenerationStatus,
    options?: {
      errorMessage?: string;
      generatedAddress?: string;
      rawAddress?: string;
      generatedSalt?: number;
    },
  ) {
    if (!this.updatableGenerationStatuses.has(status)) {
      throw new BadRequestException(`Unsupported generation status: ${status}`);
    }

    const generationRepo = this.dataSource.getRepository(VanityGeneration);
    const generation = await generationRepo.findOne({ where: { id } });
    if (!generation) {
      throw new NotFoundException(`Generation not found: ${id}`);
    }

    generation.status = status;
    generation.errorMessage = options?.errorMessage ?? null;

    if (options?.generatedAddress) {
      generation.generatedAddress = options.generatedAddress;
    }
    if (options?.rawAddress) {
      generation.rawAddress = options.rawAddress;
    }
    if (typeof options?.generatedSalt === 'number' && Number.isFinite(options.generatedSalt)) {
      generation.generatedSalt = Math.floor(options.generatedSalt);
    }

    if (status === GenerationStatus.COMPLETED) {
      generation.completedAt = new Date();
    }

    if (status === GenerationStatus.PENDING || status === GenerationStatus.RUNNING) {
      generation.completedAt = null;
    }

    const saved = await generationRepo.save(generation);

    if (status === GenerationStatus.PENDING) {
      await this.enqueueGeneration(saved.id);
    }

    return saved;
  }

  async requeueGeneration(id: string) {
    const generationRepo = this.dataSource.getRepository(VanityGeneration);
    const generation = await generationRepo.findOne({ where: { id } });
    if (!generation) {
      throw new NotFoundException(`Generation not found: ${id}`);
    }

    generation.status = GenerationStatus.PENDING;
    generation.errorMessage = null;
    generation.completedAt = null;
    await generationRepo.save(generation);
    await this.enqueueGeneration(generation.id);

    return {
      generationId: generation.id,
      status: generation.status,
    };
  }

  async requeueFailedGenerations(limit = 25) {
    const cappedLimit = this.clamp(limit, 1, 500);
    const generationRepo = this.dataSource.getRepository(VanityGeneration);
    const failed = await generationRepo.find({
      where: { status: GenerationStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: cappedLimit,
    });

    for (const generation of failed) {
      generation.status = GenerationStatus.PENDING;
      generation.errorMessage = null;
      generation.completedAt = null;
      await generationRepo.save(generation);
      await this.enqueueGeneration(generation.id);
    }

    return {
      requested: cappedLimit,
      requeued: failed.length,
      generationIds: failed.map((item) => item.id),
    };
  }

  async deleteRows(table: string, values: Array<string | number>, primaryKey = 'id') {
    this.ensureSafeIdentifier(table);
    this.ensureSafeIdentifier(primaryKey);
    await this.ensureTableExists(table);
    this.ensureDeleteAllowed(table);

    if (!Array.isArray(values) || values.length === 0) {
      throw new BadRequestException('values must be a non-empty array');
    }

    const trimmedValues = values
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);

    if (trimmedValues.length === 0) {
      throw new BadRequestException('No valid values provided for deletion');
    }

    const quotedTable = this.quoteIdentifier(table);
    const quotedPk = this.quoteIdentifier(primaryKey);
    const dbType = this.getDatabaseType();

    const beforeRows = await this.dataSource.query(`SELECT COUNT(*) AS count FROM ${quotedTable}`);
    const beforeCount = Number(beforeRows[0]?.count || 0);

    if (dbType === 'postgres') {
      const placeholders = trimmedValues.map((_, index) => `$${index + 1}`).join(', ');
      await this.dataSource.query(
        `DELETE FROM ${quotedTable} WHERE ${quotedPk} IN (${placeholders})`,
        trimmedValues,
      );

      const afterRows = await this.dataSource.query(`SELECT COUNT(*) AS count FROM ${quotedTable}`);
      const afterCount = Number(afterRows[0]?.count || 0);

      return {
        table,
        primaryKey,
        deleted: Math.max(0, beforeCount - afterCount),
      };
    }

    const placeholders = trimmedValues.map(() => '?').join(', ');
    await this.dataSource.query(
      `DELETE FROM ${quotedTable} WHERE ${quotedPk} IN (${placeholders})`,
      trimmedValues,
    );
    const afterRows = await this.dataSource.query(`SELECT COUNT(*) AS count FROM ${quotedTable}`);
    const afterCount = Number(afterRows[0]?.count || 0);

    return {
      table,
      primaryKey,
      deleted: Math.max(0, beforeCount - afterCount),
    };
  }

  private getDatabaseType(): SupportedDatabase {
    const type = this.dataSource.options.type;
    if (type === 'postgres') {
      return 'postgres';
    }

    return 'sqlite';
  }

  private ensureSafeIdentifier(identifier: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new BadRequestException('Invalid table name format');
    }
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async ensureTableExists(table: string): Promise<void> {
    const tables = await this.listTables();
    if (!tables.includes(table)) {
      throw new NotFoundException(`Table not found: ${table}`);
    }
  }

  private ensureDeleteAllowed(table: string): void {
    const raw = process.env.ADMIN_DELETE_ALLOWLIST || 'vanity_generations';
    const allowlist = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (!allowlist.includes(table)) {
      throw new BadRequestException(`Table ${table} is not allowed for delete operations`);
    }
  }

  private async enqueueGeneration(generationId: string): Promise<void> {
    const attempts = Number(process.env.WORKER_JOB_ATTEMPTS || 3);
    const backoffMs = Number(process.env.WORKER_JOB_BACKOFF_MS || 5000);
    const queue = getVanityQueue();

    await queue.add(
      VANITY_GENERATION_QUEUE,
      { generationId },
      {
        jobId: generationId,
        attempts,
        backoff: {
          type: 'exponential',
          delay: backoffMs,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
