import { User } from '../entities/user.entity';
import { SafeUser } from '../types/user.type';

export const toSafeUser = (user: User): SafeUser => {
  const { password, ...safe } = user;
  void password;
  return safe;
};
