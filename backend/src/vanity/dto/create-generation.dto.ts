import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MatchType, VanityNetwork } from '../entities/vanity-generation.entity';
import { TargetAddressKind } from '../types/generation-metadata';

export class CreateGenerationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9]+$/)
  pattern: string;

  @IsEnum(MatchType)
  matchType: MatchType;

  @ValidateIf((dto: CreateGenerationDto) => (dto.targetKind ?? TargetAddressKind.CONTRACT) !== TargetAddressKind.TOKEN)
  @IsString()
  @IsNotEmpty()
  targetAddress: string;

  @IsOptional()
  @IsEnum(TargetAddressKind)
  targetKind?: TargetAddressKind;

  @ValidateIf((dto: CreateGenerationDto) => dto.targetKind === TargetAddressKind.TOKEN)
  @IsString()
  @IsNotEmpty()
  tokenMasterCodeBoc?: string;

  @ValidateIf((dto: CreateGenerationDto) => dto.targetKind === TargetAddressKind.TOKEN)
  @IsString()
  @IsNotEmpty()
  tokenWalletCodeBoc?: string;

  @ValidateIf((dto: CreateGenerationDto) => dto.targetKind === TargetAddressKind.TOKEN)
  @IsString()
  @IsNotEmpty()
  tokenAdminAddress?: string;

  @IsOptional()
  @IsString()
  tokenContentCellBoc?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  tokenTotalSupply?: string;

  @IsOptional()
  @IsEnum(VanityNetwork)
  network?: VanityNetwork;
}
