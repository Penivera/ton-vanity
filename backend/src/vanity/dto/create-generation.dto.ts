import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MatchType, VanityNetwork } from '../entities/vanity-generation.entity';

export class CreateGenerationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9]+$/)
  pattern: string;

  @IsEnum(MatchType)
  matchType: MatchType;

  @IsString()
  targetAddress: string;

  @IsOptional()
  @IsEnum(VanityNetwork)
  network?: VanityNetwork;
}
