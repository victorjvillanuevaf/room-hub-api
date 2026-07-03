import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { CreateUserRequest, SafeUser } from '../types/user.type';
import { toSafeUser } from '../utils/safe-user';
import { PaginatedResponse } from 'src/common/types/paginated-response';
import { GetUserDto } from '../dto/get-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async create({
    email,
    password,
    name,
    role,
  }: CreateUserRequest): Promise<User> {
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const user = this.repo.create({ email, password: hashed, name, role });
    return this.repo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAllPaginated({
    page,
    limit,
    sortBy,
    sortOrder,
  }: GetUserDto): Promise<PaginatedResponse<SafeUser>> {
    const normalizedPage = Math.max(page, 1);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);

    const [users, total] = await this.repo.findAndCount({
      order: { [sortBy]: sortOrder },
      take: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
    });

    return {
      data: users.map((user) => toSafeUser(user)),
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }
}
