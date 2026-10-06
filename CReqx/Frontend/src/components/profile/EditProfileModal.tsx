import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../lib/firestoreService';
import { toast } from '../ui/Toast';

const ALL_GENRES = [
  'Action',
  'Sci-Fi',
  'Drama',
  'Thriller',
  'Comedy',
  'Romance',
  'Animation',
  'Horror',
  'Adventure',
  'Crime',
  'Fantasy',
  'Mystery',
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, profile, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Pre-fill form values when modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      setName(profile?.name ?? user?.displayName ?? '');
      setUsername(profile?.username ?? (user?.email?.split('@')[0] ?? ''));
      setBio(profile?.bio ?? '');
      setFavoriteGenres(profile?.favoriteGenres ?? []);
      setNameError('');
      setUsernameError('');
    }
  }, [isOpen, profile, user]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials =
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  const toggleGenre = (genre: string) => {
    setFavoriteGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let valid = true;
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError('');
    }

    if (!trimmedUsername) {
      setUsernameError('Username is required');
      valid = false;
    } else if (trimmedUsername.includes(' ')) {
      setUsernameError('Username cannot contain spaces');
      valid = false;
    } else {
      setUsernameError('');
    }

    if (!valid) return;

    if (!user) {
      toast('You must be signed in to edit your profile', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: trimmedName,
        username: trimmedUsername,
        bio: bio.trim(),
        favoriteGenres,
      });

      await refreshProfile();
      toast('Profile updated successfully.');
      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Failed to update profile:', err);
      toast('Unable to update your profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg rounded-2xl bg-void-900 border border-white/10 p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col z-10 my-auto"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit profile modal"
            className="absolute top-5 right-5 rounded-lg p-1.5 text-mist-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="mb-6 pr-8">
            <h2 className="font-display text-xl font-bold text-mist-100">Edit Profile</h2>
            <p className="mt-1 text-sm text-mist-400">Update your profile information</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4 rounded-xl bg-void-800/60 p-3.5 border border-white/5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ember-500 to-dusk-500 text-xl font-bold text-white ring-2 ring-white/10 shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-xs font-semibold text-mist-300">Avatar Preview</p>
                <p className="text-xs text-mist-500 mt-0.5">
                  Initials update automatically based on your name
                </p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="edit-name" className="block text-xs font-medium text-mist-300 mb-1.5">
                Name <span className="text-ember-400">*</span>
              </label>
              <div
                className={`flex items-center gap-2 rounded-xl bg-void-800/80 px-3.5 py-2.5 ring-1 ${
                  nameError ? 'ring-red-500/70' : 'ring-white/10 focus-within:ring-ember-500/80'
                } transition-all`}
              >
                <User className="h-4 w-4 text-mist-500 shrink-0" />
                <input
                  id="edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="Your full name"
                  className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                />
              </div>
              {nameError && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" /> {nameError}
                </p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="edit-username" className="block text-xs font-medium text-mist-300 mb-1.5">
                Username <span className="text-ember-400">*</span>
              </label>
              <div
                className={`flex items-center gap-2 rounded-xl bg-void-800/80 px-3.5 py-2.5 ring-1 ${
                  usernameError ? 'ring-red-500/70' : 'ring-white/10 focus-within:ring-ember-500/80'
                } transition-all`}
              >
                <span className="text-sm font-semibold text-mist-500 select-none">@</span>
                <input
                  id="edit-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameError) setUsernameError('');
                  }}
                  placeholder="username"
                  className="w-full bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
                />
              </div>
              {usernameError && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" /> {usernameError}
                </p>
              )}
            </div>

            {/* Readonly Email */}
            <div>
              <label htmlFor="edit-email" className="block text-xs font-medium text-mist-300 mb-1.5">
                Email address
              </label>
              <div className="flex items-center gap-2 rounded-xl bg-void-800/40 px-3.5 py-2.5 ring-1 ring-white/5 cursor-not-allowed opacity-75">
                <Mail className="h-4 w-4 text-mist-500 shrink-0" />
                <input
                  id="edit-email"
                  type="email"
                  value={profile?.email ?? user?.email ?? ''}
                  readOnly
                  disabled
                  className="w-full bg-transparent text-sm text-mist-400 cursor-not-allowed focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-mist-500">Email is managed by your account</p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="edit-bio" className="block text-xs font-medium text-mist-300 mb-1.5">
                Bio
              </label>
              <textarea
                id="edit-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a little about yourself..."
                className="w-full rounded-xl bg-void-800/80 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500 ring-1 ring-white/10 focus:ring-ember-500/80 focus:outline-none resize-none transition-all"
              />
            </div>

            {/* Genre Preferences */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-mist-300">
                  Genre Preferences
                </label>
                <span className="text-[11px] text-mist-500">
                  {favoriteGenres.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_GENRES.map((genre) => {
                  const selected = favoriteGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        selected
                          ? 'bg-ember-500 text-white ring-1 ring-ember-400 shadow-sm'
                          : 'bg-void-800 text-mist-400 hover:text-mist-100 hover:bg-void-700 ring-1 ring-white/10'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-mist-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-ember-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ember-500/25 hover:bg-ember-400 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
