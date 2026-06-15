import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId!: string;

  @ManyToOne(() => Building, (building) => building.rooms, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @Column()
  name!: string;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @OneToMany(() => Reservation, (reservation) => reservation.room)
  reservations!: Reservation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
