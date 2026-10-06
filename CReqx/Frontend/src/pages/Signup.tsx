import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { AuthLayout, SocialAuthButtons } from '../components/auth/AuthLayout';
import { toast } from '../components/ui/Toast';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface SignupValues {
    name: string;
    email: string;
    password: string;
}

function strengthOf(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0-4
}

const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const colors = ['bg-void-600', 'bg-ember-500', 'bg-gilt-400', 'bg-dusk-500', 'bg-emerald-400'];

export function Signup() {
    const navigate = useNavigate();
    const { signUp } = useAuth();
    const [password, setPassword] = useState('');
    const strength = useMemo(() => strengthOf(password), [password]);
    const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<SignupValues>();

    async function onSubmit({ name, email, password }: SignupValues) {
        try {
            await signUp(email, password, name);
            toast('Account created — welcome to CReqx!');
            navigate('/');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/email-already-in-use') {
                setError('email', { message: 'An account with this email already exists' });
            } else if (code === 'auth/weak-password') {
                setError('password', { message: 'Password is too weak' });
            } else {
                toast('Sign-up failed. Please try again.', 'error');
            }
        }
    }

    return (
        <AuthLayout title="Create your account" subtitle="Get recommendations tuned to your taste from day one">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Field label="Name" error={errors.name?.message}>
                    <User className="h-4 w-4 text-mist-500" />
                    <input
                        placeholder="Your name"
                        className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                        {...register('name', { required: 'Name is required' })}
                    />
                </Field>
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
                        {...register('password', {
                            required: 'Password is required',
                            minLength: { value: 8, message: 'At least 8 characters' },
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
                        })}
                    />
                </Field>

                {password.length > 0 && (
                    <div>
                        <div className="flex gap-1">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className={cn('h-1.5 flex-1 rounded-full', i < strength ? colors[strength] : 'bg-void-700')} />
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-mist-500">{labels[strength]}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ember-500/25 disabled:opacity-50"
                >
                    {isSubmitting ? 'Creating account…' : 'Create account'}
                </button>
            </form>

            <SocialAuthButtons />

            <p className="mt-6 text-center text-sm text-mist-500">
                Already have an account? <Link to="/login" className="font-medium text-ember-400 hover:text-ember-300">Sign in</Link>
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