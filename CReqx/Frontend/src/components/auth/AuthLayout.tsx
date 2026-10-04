import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../ui/Toast';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-6 py-16">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <img
                    src="https://picsum.photos/seed/auth-backdrop/1600/1000"
                    alt=""
                    className="h-full w-full object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-void-950/60 via-void-950/90 to-void-950" />
            </div>

            <div className="glass w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/40">
                <Link to="/" className="mb-6 flex items-center justify-center gap-2">
                    <Clapperboard className="h-6 w-6 text-ember-500" />
                    <span className="font-display text-lg font-bold text-mist-100">
                        CR<span className="text-ember-500">eqx</span>
                    </span>
                </Link>
                <h1 className="text-center font-display text-xl font-bold text-mist-100">{title}</h1>
                <p className="mt-1 text-center text-sm text-mist-500">{subtitle}</p>
                <div className="mt-6">{children}</div>
            </div>
        </div>
    );
}

export function SocialAuthButtons() {
    const { signInWithGoogle, signInWithGitHub } = useAuth();
    const navigate = useNavigate();
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [loadingGitHub, setLoadingGitHub] = useState(false);

    async function handleGoogle() {
        setLoadingGoogle(true);
        try {
            await signInWithGoogle();
            toast('Signed in with Google!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
                // User closed the popup — no toast needed
            } else if (code === 'auth/popup-blocked') {
                toast('Popup was blocked. Please allow popups for this site.', 'error');
            } else {
                toast('Google sign-in failed. Please try again.', 'error');
            }
        } finally {
            setLoadingGoogle(false);
        }
    }

    async function handleGitHub() {
        setLoadingGitHub(true);
        try {
            await signInWithGitHub();
            toast('Signed in with GitHub!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
                // User closed the popup — no toast needed
            } else if (code === 'auth/popup-blocked') {
                toast('Popup was blocked. Please allow popups for this site.', 'error');
            } else if (code === 'auth/account-exists-with-different-credential') {
                toast('An account already exists with this email using a different sign-in method.', 'error');
            } else {
                toast('GitHub sign-in failed. Please try again.', 'error');
            }
        } finally {
            setLoadingGitHub(false);
        }
    }

    return (
        <div className="mt-4 grid grid-cols-2 gap-3">
            <button
                type="button"
                onClick={handleGoogle}
                disabled={loadingGoogle || loadingGitHub}
                className="rounded-full bg-void-800 py-2.5 text-xs font-semibold text-mist-100 ring-1 ring-white/10 hover:ring-white/20 disabled:opacity-50"
            >
                {loadingGoogle ? 'Signing in…' : 'Continue with Google'}
            </button>
            <button
                type="button"
                onClick={handleGitHub}
                disabled={loadingGoogle || loadingGitHub}
                className="rounded-full bg-void-800 py-2.5 text-xs font-semibold text-mist-100 ring-1 ring-white/10 hover:ring-white/20 disabled:opacity-50"
            >
                {loadingGitHub ? 'Signing in…' : 'Continue with GitHub'}
            </button>
        </div>
    );
}