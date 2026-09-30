import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';

interface Values {
    email: string;
}

export function ForgotPassword() {
    const [sent, setSent] = useState(false);
    const { resetPassword } = useAuth();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>();

    async function onSubmit({ email }: Values) {
        try {
            await resetPassword(email);
            setSent(true);
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? '';
            if (code === 'auth/user-not-found') {
                // Security: don't reveal whether email exists — show success anyway
                setSent(true);
            } else {
                toast('Failed to send reset link. Please try again.', 'error');
            }
        }
    }

    return (
        <AuthLayout title="Reset your password" subtitle="We'll send a reset link to your email">
            {sent ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-dusk-400" />
                    <p className="text-sm text-mist-300">Check your inbox for a link to reset your password.</p>
                    <Link to="/login" className="text-sm font-medium text-ember-400 hover:text-ember-300">Back to sign in</Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium text-mist-400">Email</span>
                        <div className="flex items-center gap-2 rounded-xl bg-void-800/60 px-3 py-2.5 ring-1 ring-white/10 focus-within:ring-ember-500/60">
                            <Mail className="h-4 w-4 text-mist-500" />
                            <input
                                type="email"
                                placeholder="you@email.com"
                                className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                                {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })}
                            />
                        </div>
                        {errors.email && <span className="mt-1 block text-xs text-ember-400">{errors.email.message}</span>}
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ember-500/25 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Sending…' : 'Send reset link'}
                    </button>

                    <p className="text-center text-sm text-mist-500">
                        <Link to="/login" className="font-medium text-ember-400 hover:text-ember-300">Back to sign in</Link>
                    </p>
                </form>
            )}
        </AuthLayout>
    );
}