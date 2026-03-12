import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum VanityNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export enum MatchType {
  PREFIX = 'prefix',
  SUFFIX = 'suffix',
  CONTAINS = 'contains',
}

export enum GenerationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('vanity_generations')
export class VanityGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.vanityGenerations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Generation parameters
  @Column({ type: 'varchar', nullable: true })
  prefix: string | null;

  @Column({ type: 'varchar', nullable: true })
  suffix: string | null;

  @Column({
    type: 'varchar',
    enum: MatchType,
    default: MatchType.PREFIX,
  })
  matchType: MatchType;

  @Column({
    type: 'varchar',
    enum: VanityNetwork,
    default: VanityNetwork.TESTNET,
  })
  network: VanityNetwork;

  // Results
  @Column({ type: 'varchar', nullable: true })
  generatedAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  rawAddress: string | null;

  @Column({ type: 'bigint', nullable: true })
  generatedSalt: number | null;

  // Status tracking
  @Column({
    type: 'varchar',
    enum: GenerationStatus,
    default: GenerationStatus.PENDING,
  })
  status: GenerationStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  // Deployment
  @Column({ type: 'boolean', default: false })
  isDeployed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deployedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deployerAddress: string | null;

  // Background job tracking
  @Column({ type: 'varchar', nullable: true })
  backgroundJobId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
