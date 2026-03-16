import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VanityModule } from './vanity/vanity.module';
import { WorkersModule } from './workers/workers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { User } from './users/entities/user.entity';
import { VanityGeneration } from './vanity/entities/vanity-generation.entity';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: isProduction ? 'postgres' : 'sqlite',
      host: process.env.DATABASE_HOST || 'localhost',
      port: isProduction ? parseInt(process.env.DATABASE_PORT || '5432') : undefined,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: isProduction ? process.env.DATABASE_NAME : 'vanity.db',
      entities: [User, VanityGeneration],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    UsersModule,
    VanityModule,
    NotificationsModule,
    AdminModule,
    WorkersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
