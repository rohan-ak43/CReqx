import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../ui/Toast';
import cinemaBg from '../../assets/cinema-bg.jpg';

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AuthLayout({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div className="auth-page">
            {/* ── LEFT: Cinematic Visual Panel ─────────────────────── */}
            <div className="auth-visual" aria-hidden="true">
                <img
                    src={cinemaBg}
                    alt=""
                    className="auth-visual__img"
                />
                {/* Dark overlay so text reads well */}
                <div className="auth-visual__overlay" />

                {/* Brand copy */}
                <div className="auth-visual__content">
                    {/* Logo */}
                    <Link to="/" className="auth-visual__logo">
                        <Clapperboard className="auth-visual__logo-icon" />
                        <span className="auth-visual__logo-text">
                            C<span className="auth-visual__logo-accent">Reqx</span>
                        </span>
                    </Link>

                    {/* Tagline */}
                    <div className="auth-visual__tagline">
                        <h2 className="auth-visual__headline">
                            Discover your next<br />favorite movie.
                        </h2>
                        <p className="auth-visual__sub">
                            Personalized recommendations based on what you love to watch.
                        </p>
                    </div>

                    {/* Decorative film strip bar */}
                    <div className="auth-visual__strip" />
                </div>
            </div>

            {/* ── RIGHT: Form Panel ────────────────────────────────── */}
            <div className="auth-form-panel">
                <div className="auth-form-container">
                    {/* Mobile-only logo (hidden on desktop, shown on mobile since left panel is hidden) */}
                    <Link to="/" className="auth-form__mobile-logo">
                        <Clapperboard className="auth-form__mobile-logo-icon" />
                        <span className="auth-form__mobile-logo-text">
                            C<span className="auth-form__mobile-logo-accent">Reqx</span>
                        </span>
                    </Link>

                    {/* Heading */}
                    <div className="auth-form__header">
                        <h1 className="auth-form__title">{title}</h1>
                        <p className="auth-form__subtitle">{subtitle}</p>
                    </div>

                    {/* Form content slot */}
                    <div className="auth-form__body">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Social Auth Buttons (Google only) ────────────────────────────────────────

export function SocialAuthButtons() {
    const { signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [loadingGoogle, setLoadingGoogle] = useState(false);

    async function handleGoogle() {
        setLoadingGoogle(true);
        try {
            await signInWithGoogle();
            toast('Signed in with Google!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (
                code === 'auth/popup-closed-by-user' ||
                code === 'auth/cancelled-popup-request'
            ) {
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

    return (
        <div className="auth-social">
            {/* OR divider */}
            <div className="auth-divider">
                <span className="auth-divider__line" />
                <span className="auth-divider__label">OR</span>
                <span className="auth-divider__line" />
            </div>

            {/* Google button */}
            <button
                type="button"
                id="btn-google-signin"
                onClick={handleGoogle}
                disabled={loadingGoogle}
                className="auth-social__google"
            >
                {loadingGoogle ? (
                    <span className="auth-social__spinner" />
                ) : (
                    /* Real Google "G" SVG icon */
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086C16.6582 14.0518 17.64 11.8264 17.64 9.2045z"
                            fill="#4285F4"
                        />
                        <path
                            d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1805l-2.9086-2.2581c-.8064.54-1.8382.8591-3.0477.8591-2.3441 0-4.3282-1.5832-5.036-3.71H.957v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                            fill="#34A853"
                        />
                        <path
                            d="M3.964 10.71C3.7845 10.17 3.6818 9.5945 3.6818 9s.1027-1.17.2823-1.71V4.9582H.957A8.9965 8.9965 0 000 9c0 1.4518.3477 2.8227.957 4.0418L3.964 10.71z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.957 4.9582L3.964 7.29C4.6718 5.1632 6.6559 3.5795 9 3.5795z"
                            fill="#EA4335"
                        />
                    </svg>
                )}
                <span>{loadingGoogle ? 'Signing in…' : 'Continue with Google'}</span>
            </button>
        </div>
    );
}