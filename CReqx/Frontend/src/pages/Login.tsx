import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
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
    const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginValues>();

    async function onSubmit({ email, password }: LoginValues) {
        try {
            await signIn(email, password);
            toast('Welcome back!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
                setError('password', { message: 'Invalid email or password' });
            } else if (code === 'auth/too-many-requests') {
                toast('Too many attempts. Please wait and try again.', 'error');
            } else {
                toast('Sign-in failed. Please try again.', 'error');
            }
        }
    }

    return (
        <AuthLayout title="Welcome back" subtitle="Sign in to pick up your recommendations">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Field label="Email" error={errors.email?.message}>
                    <Mail className="h-4 w-4 text-mist-500" />
                    <input
                        type="email"
                        placeholder="you@email.com"
                        className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                        {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })}
                    />
                </Field>
                <Field label="Password" error={errors.password?.message}>
                    <Lock className="h-4 w-4 text-mist-500" />
                    <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                        {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                    />
                </Field>

                <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs text-mist-400 hover:text-mist-100">Forgot password?</Link>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ember-500/25 disabled:opacity-50"
                >
                    {isSubmitting ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <SocialAuthButtons />

            <p className="mt-6 text-center text-sm text-mist-500">
                New here? <Link to="/signup" className="font-medium text-ember-400 hover:text-ember-300">Create an account</Link>
            </p>
        </AuthLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-mist-400">{label}</span>
            <div className="flex items-center gap-2 rounded-xl bg-void-800/60 px-3 py-2.5 ring-1 ring-white/10 focus-within:ring-ember-500/60">
                {children}
            </div>
            {error && <span className="mt-1 block text-xs text-ember-400">{error}</span>}
        </label>
    );
}