export interface User {
  uid: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  country: string;
  elo: number;
  connected: boolean;
  password?: string;
  role: {
    id: number;
    role: string;
  };
  roleId: number;
  createdAt: string;
  updatedAt: string;
  refreshToken?: string;
  losses: number;
  wins: number;
  draws: number;
  resetToken: string | null;
}

export interface UserAuth {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceId: string;
}

export interface RegisterCredentials {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  country: string;
  password: string;
}
