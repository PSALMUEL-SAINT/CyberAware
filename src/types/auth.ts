export type UserRole = 
  | 'Student / Learner' 
  | 'Security Practitioner' 
  | 'Security Evaluator' 
  | 'Educator / Mentor';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarColor?: string;
  isDemo?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  role?: UserRole;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  message?: string;
}

export interface PasswordResetPayload {
  email: string;
  newPassword?: string;
  verificationCode?: string;
}
