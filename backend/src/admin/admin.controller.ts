import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { GenerationStatus } from '../vanity/entities/vanity-generation.entity';

@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('tables')
  async getTables() {
    const tables = await this.adminService.listTables();
    return { tables, count: tables.length };
  }

  @Get('tables/:table/schema')
  async getTableSchema(@Param('table') table: string) {
    const columns = await this.adminService.getTableSchema(table);
    return { table, columns };
  }

  @Get('tables/:table/rows')
  async getTableRows(
    @Param('table') table: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 100;
    const offset = Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : 0;

    return this.adminService.getTableRows(table, limit, offset);
  }

  @Post('generations/:id/status')
  async updateGenerationStatus(
    @Param('id') id: string,
    @Body('status') status: GenerationStatus,
    @Body('errorMessage') errorMessage?: string,
    @Body('generatedAddress') generatedAddress?: string,
    @Body('rawAddress') rawAddress?: string,
    @Body('generatedSalt') generatedSalt?: number,
  ) {
    return this.adminService.updateGenerationStatus(id, status, {
      errorMessage,
      generatedAddress,
      rawAddress,
      generatedSalt,
    });
  }

  @Post('generations/:id/requeue')
  async requeueGeneration(@Param('id') id: string) {
    return this.adminService.requeueGeneration(id);
  }

  @Post('generations/requeue-failed')
  async requeueFailed(@Body('limit') limitRaw?: number) {
    const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 25;
    return this.adminService.requeueFailedGenerations(limit);
  }

  @Delete('tables/:table/rows')
  async deleteRows(
    @Param('table') table: string,
    @Body('values') values: Array<string | number>,
    @Body('primaryKey') primaryKey?: string,
  ) {
    return this.adminService.deleteRows(table, values, primaryKey);
  }
}
