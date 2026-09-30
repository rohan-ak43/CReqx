/**
 * useAppStore — in-memory store for favorites (watchlist) and watch history.
 *
 * When a Firebase-authenticated user is present (via useAuth), all mutations
 * are mirrored to Firestore in the background.  Reads are hydrated from
 * Firestore once on mount so data persists across page refreshes.
 *
 * If the user is not signed in, the store works exactly as before — purely
 * in-memory — so existing un-auth'd functionality is untouched.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Movie } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  addWatchedMovie,
  getWatchedMovies,
} from '../lib/firestoreService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  movie: Movie;
  watchedAt: Date;
}

interface AppStore {
  favorites: Movie[];
  history: HistoryEntry[];
  /** True while initial Firestore data is loading. */
  hydrating: boolean;
  toggleFavorite: (movie: Movie) => void;
  isFavorite: (id: string) => boolean;
  addHistory: (movie: Movie) => void;
  clearHistory: () => void;
}

const AppContext = createContext<AppStore | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [hydrating, setHydrating] = useState(false);

  // ── Hydrate from Firestore when user signs in ──────────────────────────────
  useEffect(() => {
    if (!user) {
      // Signed out — clear persisted state
      setFavorites([]);
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHydrating(true);

    (async () => {
      try {
        const [watchlistDocs, watchedDocs] = await Promise.all([
          getWatchlist(user.uid),
          getWatchedMovies(user.uid),
        ]);

        if (cancelled) return;

        // Convert Firestore docs to in-memory Movie stubs.
        // We only persist the minimal fields needed for the lists;
        // detailed fields will be fetched by MovieDetails as needed.
        const favMovies: Movie[] = watchlistDocs.map((d) => ({
          id:               d.movieId,
          title:            d.title,
          poster:           d.poster,
          backdrop:         '',
          genres:           [],
          genreIds:         [],
          rating:           0,
          voteCount:        0,
          year:             0,
          releaseDate:      '',
          runtime:          0,
          synopsis:         '',
          director:         '',
          writers:          [],
          cast:             [],
          budget:           '',
          revenue:          '',
          language:         '',
          originalLanguage: '',
          popularity:       0,
          mood:             [],
          streamingOn:      [],
        }));

        const histEntries: HistoryEntry[] = watchedDocs.map((d) => ({
          movie: {
            id:               d.movieId,
            title:            d.title,
            poster:           '',
            backdrop:         '',
            genres:           [],
            genreIds:         [],
            rating:           0,
            voteCount:        0,
            year:             0,
            releaseDate:      '',
            runtime:          0,
            synopsis:         '',
            director:         '',
            writers:          [],
            cast:             [],
            budget:           '',
            revenue:          '',
            language:         '',
            originalLanguage: '',
            popularity:       0,
            mood:             [],
            streamingOn:      [],
          },
          watchedAt: d.watchedAt?.toDate?.() ?? new Date(),
        }));

        setFavorites(favMovies);
        setHistory(histEntries);
      } catch (err) {
        // Non-fatal — degrade gracefully; user still sees in-memory data
        console.error('[AppStore] Firestore hydration failed:', err);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback((movie: Movie) => {
    setFavorites((prev) => {
      const exists = prev.some((m) => m.id === movie.id);
      const next = exists
        ? prev.filter((m) => m.id !== movie.id)
        : [...prev, movie];

      // Mirror to Firestore in background (non-blocking)
      if (user) {
        if (exists) {
          removeFromWatchlist(user.uid, movie.id).catch((e) =>
            console.error('[AppStore] removeFromWatchlist:', e)
          );
        } else {
          addToWatchlist(user.uid, movie).catch((e) =>
            console.error('[AppStore] addToWatchlist:', e)
          );
        }
      }

      return next;
    });
  }, [user]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((m) => m.id === id),
    [favorites]
  );

  const addHistory = useCallback((movie: Movie) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.movie.id !== movie.id);
      const next = [{ movie, watchedAt: new Date() }, ...filtered];

      // Mirror to Firestore in background
      if (user) {
        addWatchedMovie(user.uid, movie).catch((e) =>
          console.error('[AppStore] addWatchedMovie:', e)
        );
      }

      return next;
    });
  }, [user]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    // Note: Firestore history is intentionally not bulk-deleted here —
    // this matches the original behaviour of only clearing in-memory state.
  }, []);

  return (
    <AppContext.Provider
      value={{ favorites, history, hydrating, toggleFavorite, isFavorite, addHistory, clearHistory }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}
