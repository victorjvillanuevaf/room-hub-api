import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitializeSchema1718300000000 implements MigrationInterface {
  name = 'InitializeSchema1718300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar NOT NULL UNIQUE,
        password varchar NOT NULL,
        name varchar,
        role varchar NOT NULL DEFAULT 'user',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS buildings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar NOT NULL,
        address varchar NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        building_id uuid NOT NULL,
        name varchar NOT NULL,
        capacity integer NOT NULL,
        image_url varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_rooms_building_id
          FOREIGN KEY (building_id) REFERENCES buildings(id)
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'reservations_status_enum'
        ) THEN
          CREATE TYPE reservations_status_enum AS ENUM ('ACTIVE', 'CANCELLED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id uuid NOT NULL,
        user_id uuid NOT NULL,
        start_at timestamptz NOT NULL,
        end_at timestamptz NOT NULL,
        status reservations_status_enum NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_reservations_room_id
          FOREIGN KEY (room_id) REFERENCES rooms(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_reservations_user_id
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rooms_building_id ON rooms(building_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON reservations(room_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reservations_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reservations_room_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rooms_building_id;`);

    await queryRunner.query(`DROP TABLE IF EXISTS reservations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms;`);
    await queryRunner.query(`DROP TABLE IF EXISTS buildings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);

    await queryRunner.query(`DROP TYPE IF EXISTS reservations_status_enum;`);
  }
}
