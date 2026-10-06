import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Clock, Star, Settings, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/ui/Toast';
import { EditProfileModal } from '../components/profile/EditProfileModal';

const GENRES = ['Action', 'Sci-Fi', 'Drama', 'Thriller', 'Comedy', 'Romance', 'Animation', 'Horror'];

export function Profile() {
  const { favorites, history } = useAppStore();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const displayName  = profile?.name  ?? user?.displayName ?? 'Guest';
  const displayEmail = profile?.email ?? user?.email       ?? '';
  const displayBio   = profile?.bio && profile.bio.trim().length > 0 ? profile.bio : 'Movie enthusiast';
  const initials     = displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  const topGenres = (() => {
    const counts: Record<string, number> = {};
    [...favorites, ...history.map((h) => h.movie)].forEach((m) => {
      m.genres.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
  })();

  // Derived favorite genres: user explicitly selected or top watched/favorited genres
  const selectedGenres = profile?.favoriteGenres ?? [];
  const primaryTopGenre = selectedGenres.length > 0 ? selectedGenres[0] : (topGenres[0] ?? '—');

  async function handleSignOut() {
    try {
      await signOut();
      toast('Signed out successfully');
      navigate('/login');
    } catch {
      toast('Failed to sign out', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mb-8 rounded-3xl p-8"
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-ember-500 to-dusk-500 text-3xl font-bold text-white ring-4 ring-void-800">
              {initials}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-display text-2xl font-bold text-mist-100">{displayName}</h1>
            <p className="text-sm text-mist-500">{displayEmail}</p>
            {profile?.username && (
              <p className="mt-0.5 text-sm text-mist-400 font-medium">@{profile.username}</p>
            )}
            <p className="mt-1.5 text-sm text-mist-300 leading-relaxed max-w-md">{displayBio}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
              <div className="text-center">
                <p className="text-xl font-bold font-display text-mist-100">{history.length}</p>
                <p className="text-xs text-mist-500">Watched</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-display text-mist-100">{favorites.length}</p>
                <p className="text-xs text-mist-500">Watchlist</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-display text-mist-100">{primaryTopGenre}</p>
                <p className="text-xs text-mist-500">Top Genre</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              id="btn-edit-profile"
              className="flex items-center justify-center gap-2 rounded-full bg-void-700 px-4 py-2 text-sm font-medium text-mist-300 ring-1 ring-white/10 hover:bg-void-600 hover:text-white transition-all cursor-pointer"
            >
              <Settings className="h-4 w-4" /> Edit Profile
            </button>
            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 rounded-full bg-ember-500/10 px-4 py-2 text-sm font-medium text-ember-400 ring-1 ring-ember-500/20 hover:bg-ember-500/20 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            )}
            {!user && (
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-full bg-ember-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-ember-400"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Genre Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass mb-6 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-mist-100">Genre Preferences</h2>
          <button
            onClick={() => setIsEditOpen(true)}
            className="text-xs text-ember-400 hover:text-ember-300 transition-colors font-medium"
          >
            Edit Preferences
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const isSelected = selectedGenres.includes(g);
            const isTop = topGenres.includes(g);
            const active = isSelected || isTop;

            return (
              <span
                key={g}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-ember-500 text-white shadow-lg shadow-ember-500/20 ring-1 ring-ember-400'
                    : 'bg-void-800 text-mist-400 ring-1 ring-white/10'
                }`}
              >
                {g} {active && '★'}
              </span>
            );
          })}
        </div>
        {selectedGenres.length === 0 && topGenres.length === 0 && (
          <p className="mt-3 text-xs text-mist-500">
            Click "Edit Profile" to choose your favorite genres, or watch movies to discover them.
          </p>
        )}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        {[
          { icon: Heart, label: 'Watchlist', count: favorites.length, to: '/favorites', color: 'text-ember-400' },
          { icon: Clock, label: 'Watch History', count: history.length, to: '/history', color: 'text-dusk-400' },
          { icon: Star, label: 'Dashboard', count: null, to: '/dashboard', color: 'text-gilt-400' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="glass flex flex-col gap-2 rounded-2xl p-5 hover:ring-1 hover:ring-white/10 transition-all card-lift"
          >
            <item.icon className={`mb-2 h-8 w-8 ${item.color}`} />
            <p className="font-display font-semibold text-mist-100">{item.label}</p>
            {item.count !== null && (
              <p className="text-sm text-mist-500">{item.count} items</p>
            )}
          </Link>
        ))}
      </motion.div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </div>
  );
}