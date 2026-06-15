import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoOverlappingReservations1718400000000 implements MigrationInterface {
  name = 'AddNoOverlappingReservations1718400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    await queryRunner.query(`
      ALTER TABLE reservations
      ADD CONSTRAINT no_overlapping_reservations
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status = 'ACTIVE');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations
      DROP CONSTRAINT IF EXISTS no_overlapping_reservations;
    `);
  }
}
