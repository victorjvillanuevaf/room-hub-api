import { toSafeUser } from 'src/modules/users/utils/safe-user';
import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enum/user.enum';

describe('toSafeUser', () => {
  it('strips the password field from the user', () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      name: 'John Doe',
      role: UserRole.USER,
      reservations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const safeUser = toSafeUser(user);

    expect(safeUser).not.toHaveProperty('password');
    expect(safeUser).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'John Doe',
      role: UserRole.USER,
      reservations: [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });
});
