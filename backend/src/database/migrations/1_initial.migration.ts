import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class InitialMigration implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isSqlite = queryRunner.connection.options.type === 'sqlite';

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: isSqlite ? 'varchar' : 'uuid',
            isPrimary: true,
            default: isSqlite ? undefined : 'gen_random_uuid()',
          },
          {
            name: 'telegramId',
            type: 'bigint',
            isUnique: true,
          },
          {
            name: 'username',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'firstName',
            type: 'varchar',
          },
          {
            name: 'lastName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'photoUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create vanity_generations table
    await queryRunner.createTable(
      new Table({
        name: 'vanity_generations',
        columns: [
          {
            name: 'id',
            type: isSqlite ? 'varchar' : 'uuid',
            isPrimary: true,
            default: isSqlite ? undefined : 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: isSqlite ? 'varchar' : 'uuid',
          },
          {
            name: 'prefix',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'suffix',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'matchType',
            type: 'varchar',
            default: "'prefix'",
          },
          {
            name: 'network',
            type: 'varchar',
            default: "'testnet'",
          },
          {
            name: 'generatedAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'rawAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'generatedSalt',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'pending'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isDeployed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deployedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deployerAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'backgroundJobId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'vanity_generations',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('vanity_generations');
    if (!table) {
      return;
    }
    const foreignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('vanity_generations', foreignKey);
    }

    // Drop tables
    await queryRunner.dropTable('vanity_generations', true);
    await queryRunner.dropTable('users', true);
  }
}
