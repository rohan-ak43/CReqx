/**
 * AuthContext — wraps Firebase Auth and exposes the current user
 * to the entire React tree.  Also bootstraps Firestore user profiles
 * on first sign-up / sign-in.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserProfile, getUserProfile, type FirestoreUserProfile } from '../lib/firestoreService';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Firebase Auth user object — null while loading or signed out. */
  user: User | null;
  /** Firestore profile (name, email, username). Null while loading. */
  profile: FirestoreUserProfile | null;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Refresh profile from Firestore (e.g. after profile edit). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const p = await getUserProfile(fbUser.uid);
          setProfile(p);
        } catch (err) {
          console.error('[AuthContext] Failed to load profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    const username = email.split('@')[0]; // simple default username
    await createUserProfile(uid, { name, email, username });
    const p = await getUserProfile(uid);
    setProfile(p);
  };

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    // Ensure profile exists (covers edge cases where doc was never created)
    const existing = await getUserProfile(credential.user.uid);
    if (!existing) {
      await createUserProfile(credential.user.uid, {
        name: credential.user.displayName ?? email.split('@')[0],
        email,
        username: email.split('@')[0],
      });
    }
    setProfile(existing ?? (await getUserProfile(credential.user.uid)));
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    } catch (err) {
      console.error('[AuthContext] refreshProfile failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
