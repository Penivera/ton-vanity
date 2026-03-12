import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { VanityService } from './vanity.service';

@Controller('vanity')
@UseGuards(JwtAuthGuard)
export class VanityController {
  constructor(private readonly vanityService: VanityService) {}

  @Post('generate')
  async create(@Req() req: Request, @Body() dto: CreateGenerationDto) {
    const user = req.user as { id: string };
    const generation = await this.vanityService.createGeneration(user.id, dto);

    return {
      generationId: generation.id,
      status: generation.status,
      createdAt: generation.createdAt,
    };
  }

  @Get('generations')
  async list(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.vanityService.listForUser(user.id);
  }

  @Get('generations/:id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.vanityService.getForUser(user.id, id);
  }
}
