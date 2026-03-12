import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VanityGeneration } from './entities/vanity-generation.entity';
import { VanityService } from './vanity.service';
import { VanityController } from './vanity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VanityGeneration])],
  providers: [VanityService],
  controllers: [VanityController],
  exports: [VanityService],
})
export class VanityModule {}
