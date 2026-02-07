import { useState, useEffect, createContext, useContext } from 'react';
import { AuthUser } from '../types/auction';
import { AuthService } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isInitialized: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Set initialized immediately so app loads instantly
    setIsInitialized(true);

    // Check auth in the background
    const initializeAuth = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        setUser(currentUser as AuthUser | null);
      } catch (error) {
        console.error('useAuth: Auth initialization error', error);
        setUser(null);
      }
    };

    initializeAuth();

    const { data: { subscription } } = AuthService.onAuthStateChange((user) => {
      setUser(user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await AuthService.signIn(email, password);
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await AuthService.signUp(email, password, name);

      // If signup requires confirmation, don't set user and throw the result
      if (result.requiresConfirmation) {
        throw new Error(`CONFIRMATION_REQUIRED:${result.message}`);
      }

      setUser(result);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AuthService.signOut();
      setUser(null);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    login,
    register,
    logout,
    isLoading,
    isInitialized
  };
}