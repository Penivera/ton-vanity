import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VanityGeneration } from '../../vanity/entities/vanity-generation.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  telegramId: number;

  @Column({ type: 'varchar', nullable: true })
  username: string;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar', nullable: true })
  lastName: string;

  @Column({ type: 'varchar', nullable: true })
  photoUrl: string;

  @OneToMany(() => VanityGeneration, (generation) => generation.user, {
    cascade: true,
    eager: false,
  })
  vanityGenerations: VanityGeneration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
