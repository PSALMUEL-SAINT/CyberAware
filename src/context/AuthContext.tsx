import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, LoginCredentials, RegisterPayload, AuthResult } from '../types/auth';
import {
  getStoredUser,
  getStoredToken,
  loginUser,
  loginWithDemo,
  registerUser,
  checkCurrentUser,
  logoutUser,
  clearAuthSession,
  fetchDemoUsers
} from '../services/authApi';
import { DEFAULT_DEMO_USER } from '../utils/assessmentAttempts';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'forgot';
  demoUsers: AuthUser[];
  openAuthModal: (mode?: 'login' | 'register' | 'forgot') => void;
  closeAuthModal: () => void;
  login: (credentials: LoginCredentials) => Promise<AuthResult>;
  register: (payload: RegisterPayload) => Promise<AuthResult>;
  demoLogin: (userId: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser() || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [demoUsers, setDemoUsers] = useState<AuthUser[]>([]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const [verifiedUser, availableDemoUsers] = await Promise.all([
          checkCurrentUser(),
          fetchDemoUsers()
        ]);

        if (mounted) {
          if (verifiedUser) {
            setUser(verifiedUser);
          } else {
            // When no authenticated session exists, user is null. Never default automatically.
            clearAuthSession();
            setUser(null);
          }
          if (availableDemoUsers.length > 0) {
            setDemoUsers(availableDemoUsers);
          }
        }
      } catch (err) {
        if (mounted) {
          clearAuthSession();
          setUser(null);
        }
        console.warn('Auth initialization checked with no active session', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();
    return () => { mounted = false; };
  }, []);

  const openAuthModal = (mode: 'login' | 'register' | 'forgot' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const login = async (credentials: LoginCredentials): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await loginUser(credentials);
      if (res.success && res.user) {
        setUser(res.user);
        closeAuthModal();
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await registerUser(payload);
      if (res.success && res.user) {
        setUser(res.user);
        closeAuthModal();
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (userId: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await loginWithDemo(userId);
      if (res.success && res.user) {
        setUser(res.user);
        closeAuthModal();
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const switchUser = async (userId: string): Promise<void> => {
    await demoLogin(userId);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout request completed with local cleanup', err);
    } finally {
      clearAuthSession();
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        demoUsers,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        demoLogin,
        logout,
        switchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
