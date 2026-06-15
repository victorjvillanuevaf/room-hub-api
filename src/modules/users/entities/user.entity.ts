import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../enum/user.enum';
import { Reservation } from '../../reservations/entities/reservation.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({
    default: UserRole.USER,
  })
  role!: UserRole;

  @OneToMany(() => Reservation, (reservation) => reservation.user)
  reservations!: Reservation[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
