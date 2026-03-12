import { DataSource } from 'typeorm';
import { DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { VanityGeneration } from '../vanity/entities/vanity-generation.entity';
import { InitialMigration } from './migrations/1_initial.migration';

const isProduction = process.env.NODE_ENV === 'production';

const dataSourceOptions: DataSourceOptions = isProduction
  ? {
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME || 'vanity',
      entities: [User, VanityGeneration],
      migrations: [InitialMigration],
      synchronize: false,
      logging: false,
    }
  : {
      type: 'sqlite',
      database: process.env.SQLITE_DB_PATH || 'vanity.db',
      entities: [User, VanityGeneration],
      migrations: [InitialMigration],
      synchronize: true,
      logging: true,
    };

export const AppDataSource = new DataSource(dataSourceOptions);
