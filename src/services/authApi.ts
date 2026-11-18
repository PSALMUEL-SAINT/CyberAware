import { AuthUser, LoginCredentials, RegisterPayload, AuthResult, PasswordResetPayload } from '../types/auth';
import { evaluatePasswordEntropy, type PasswordStrengthResult } from '../utils/passwordStrength';

export const AUTH_TOKEN_KEY = 'cyberaware_auth_token_v1';
export const AUTH_USER_KEY = 'cyberaware_auth_user_v1';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(user: AuthUser, token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to save auth session to localStorage', err);
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (err) {
    console.warn('Failed to clear auth session', err);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function fetchDemoUsers(): Promise<AuthUser[]> {
  try {
    const res = await fetch('/api/auth/demo-users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.users || [];
  } catch (err) {
    console.warn('Failed to fetch demo users from backend, using fallbacks', err);
    return [
      {
        id: 'destinyivienagbor2005@gmail.com',
        email: 'destinyivienagbor2005@gmail.com',
        name: 'Destiny (Primary Learner)',
        role: 'Student / Learner',
        isDemo: true
      },
      {
        id: 'judge.security@codesprint.org',
        email: 'judge.security@codesprint.org',
        name: 'CodeSprint Security Judge',
        role: 'Security Evaluator',
        isDemo: true
      },
      {
        id: 'alex.student@cyberaware.edu',
        email: 'alex.student@cyberaware.edu',
        name: 'Alex Rivera (Peer Learner)',
        role: 'Student / Learner',
        isDemo: true
      }
    ];
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    if (data.user && data.token) {
      saveAuthSession(data.user, data.token);
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      message: data.message
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during login' };
  }
}

export async function loginWithDemo(userId: string): Promise<AuthResult> {
  try {
    const res = await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Demo login failed' };
    }

    if (data.user && data.token) {
      saveAuthSession(data.user, data.token);
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      message: data.message
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during demo login' };
  }
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResult> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    if (data.user && data.token) {
      saveAuthSession(data.user, data.token);
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      message: data.message
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during registration' };
  }
}

export async function checkCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredToken();
  const storedUser = getStoredUser();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
    } else if (res.status === 401 || res.status === 403) {
      clearAuthSession();
      return null;
    }
    // For 500/502/503 during server reload, retain stored session
    return storedUser;
  } catch {
    return storedUser;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (err) {
    console.warn('Logout API call failed, clearing local state', err);
  } finally {
    clearAuthSession();
  }
}

export async function resetPasswordRequest(payload: PasswordResetPayload): Promise<{ success: boolean; message?: string; error?: string; step?: string; simulatedCode?: string }> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Password reset failed' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during reset request' };
  }
}

export function evaluatePasswordClient(password: string): PasswordStrengthResult {
  return evaluatePasswordEntropy(password);
}
