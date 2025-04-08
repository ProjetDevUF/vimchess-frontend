export interface User {
  id?: string | number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  country: string;
  profilePicture?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface UserAuth {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  country: string;
  password: string;
}
