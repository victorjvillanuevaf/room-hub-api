import { User } from '../entities/user.entity';
import { UserRole } from '../enum/user.enum';

export type CreateUserRequest = {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
};

export type SafeUser = Omit<User, 'password'>;

export type PaginatedUsersResponse = {
  data: SafeUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
