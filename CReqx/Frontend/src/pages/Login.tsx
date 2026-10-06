import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout, SocialAuthButtons } from '../components/auth/AuthLayout';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';

interface LoginValues {
    email: string;
    password: string;
}

export function Login() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<LoginValues>();

    async function onSubmit({ email, password }: LoginValues) {
        try {
            await signIn(email, password);
            toast('Welcome back!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (
                code === 'auth/invalid-credential' ||
                code === 'auth/wrong-password' ||
                code === 'auth/user-not-found'
            ) {
                setError('password', { message: 'Invalid email or password' });
            } else if (code === 'auth/too-many-requests') {
                toast('Too many attempts. Please wait and try again.', 'error');
            } else {
                toast('Sign-in failed. Please try again.', 'error');
            }
        }
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to continue discovering movies you'll love."
        >
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Email field */}
                <Field
                    label="Email address"
                    htmlFor="login-email"
                    error={errors.email?.message}
                >
                    <Mail className="auth-input__icon" aria-hidden="true" />
                    <input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        autoComplete="email"
                        className="auth-input__field"
                        {...register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: /^\S+@\S+\.\S+$/,
                                message: 'Enter a valid email',
                            },
                        })}
                    />
                </Field>

                {/* Password field */}
                <Field
                    label="Password"
                    htmlFor="login-password"
                    error={errors.password?.message}
                >
                    <Lock className="auth-input__icon" aria-hidden="true" />
                    <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="auth-input__field"
                        {...register('password', {
                            required: 'Password is required',
                            minLength: { value: 6, message: 'At least 6 characters' },
                        })}
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        className="auth-input__toggle"
                    >
                        {showPassword ? (
                            <EyeOff className="auth-input__toggle-icon" />
                        ) : (
                            <Eye className="auth-input__toggle-icon" />
                        )}
                    </button>
                </Field>

                {/* Forgot password */}
                <div className="auth-forgot">
                    <Link to="/forgot-password" className="auth-forgot__link" id="forgot-password-link">
                        Forgot password?
                    </Link>
                </div>

                {/* Primary submit button */}
                <button
                    type="submit"
                    id="btn-login-submit"
                    disabled={isSubmitting}
                    className="auth-btn-primary"
                >
                    {isSubmitting ? (
                        <>
                            <span className="auth-social__spinner" />
                            Signing in…
                        </>
                    ) : (
                        'Sign in'
                    )}
                </button>
            </form>

            <SocialAuthButtons />

            <p className="auth-signup-prompt">
                Don't have an account?{' '}
                <Link to="/signup" className="auth-signup-prompt__link" id="link-create-account">
                    Create an account
                </Link>
            </p>
        </AuthLayout>
    );
}

// ─── Shared Field component ────────────────────────────────────────────────────

function Field({
    label,
    htmlFor,
    error,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="auth-field">
            <label htmlFor={htmlFor} className="auth-field__label">
                {label}
            </label>
            <div className={`auth-input${error ? ' auth-input--error' : ''}`}>
                {children}
            </div>
            {error && (
                <span role="alert" className="auth-field__error">
                    {error}
                </span>
            )}
        </div>
    );
}