export type RefreshResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  accessToken: string;
};

export type LoginResponse = RefreshResponse & {
  refreshToken: string;
};

export type RegisterResponse = RefreshResponse & {
  refreshToken: string;
};
