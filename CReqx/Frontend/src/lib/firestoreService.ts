/**
 * Firestore service layer.
 * All reads/writes to Firestore go through here.
 * Functions are keyed by the authenticated user's UID,
 * so one user can never touch another user's data.
 */
import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Movie } from '../data/mockData';

// ─── Type Definitions ──────────────────────────────────────────────────────────

export interface FirestoreUserProfile {
  name: string;
  email: string;
  username: string;
  bio?: string;
  favoriteGenres?: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface WatchedMovieDoc {
  movieId: string;
  title: string;
  watchedAt: Timestamp;
}

export interface WatchlistMovieDoc {
  movieId: string;
  title: string;
  poster: string;
  addedAt: Timestamp;
}

export interface RecommendationHistoryDoc {
  recommendedAt: Timestamp;
  movies: Array<{ id: string; title: string; poster: string; rating: number }>;
  answers?: Record<string, string>; // questionnaire answers used to derive recommendations
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function userRef(uid: string) {
  return doc(db, 'users', uid);
}

function watchedRef(uid: string, movieId: string) {
  return doc(db, 'users', uid, 'watchedMovies', movieId);
}

function watchlistRef(uid: string, movieId: string) {
  return doc(db, 'users', uid, 'watchlist', movieId);
}

function recommendationRef(uid: string, recommendationId: string) {
  return doc(db, 'users', uid, 'recommendationHistory', recommendationId);
}

// ─── User Profile ──────────────────────────────────────────────────────────────

/**
 * Creates or updates user profile document in Firestore.
 * Called on signup and on first login if profile doesn't exist.
 */
export async function createUserProfile(
  uid: string,
  data: { name: string; email: string; username: string }
): Promise<void> {
  await setDoc(
    userRef(uid),
    {
      name: data.name,
      email: data.email,
      username: data.username,
      createdAt: serverTimestamp(),
    },
    { merge: true } // won't overwrite createdAt on subsequent calls
  );
}

/** Update specific fields on a user's profile document in Firestore. */
export async function updateUserProfile(
  uid: string,
  data: {
    name: string;
    username: string;
    bio?: string;
    favoriteGenres?: string[];
  }
): Promise<void> {
  await setDoc(
    userRef(uid),
    {
      name: data.name.trim(),
      username: data.username.trim(),
      bio: (data.bio ?? '').trim(),
      favoriteGenres: data.favoriteGenres ?? [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Fetch a user's profile document. Returns null if not found. */
export async function getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as FirestoreUserProfile;
}

// ─── Watched Movies ────────────────────────────────────────────────────────────

/** Mark a movie as watched. Uses movieId as document key for idempotency. */
export async function addWatchedMovie(uid: string, movie: Movie): Promise<void> {
  await setDoc(watchedRef(uid, movie.id), {
    movieId: movie.id,
    title: movie.title,
    watchedAt: serverTimestamp(),
  });
}

/** Remove a movie from watch history. */
export async function removeWatchedMovie(uid: string, movieId: string): Promise<void> {
  await deleteDoc(watchedRef(uid, movieId));
}

/** Fetch all watched movies for a user, sorted newest first. */
export async function getWatchedMovies(uid: string): Promise<WatchedMovieDoc[]> {
  const col = collection(db, 'users', uid, 'watchedMovies');
  const q = query(col, orderBy('watchedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WatchedMovieDoc);
}

// ─── Watchlist (Favorites) ─────────────────────────────────────────────────────

/** Add a movie to the user's watchlist. */
export async function addToWatchlist(uid: string, movie: Movie): Promise<void> {
  await setDoc(watchlistRef(uid, movie.id), {
    movieId: movie.id,
    title: movie.title,
    poster: movie.poster,
    addedAt: serverTimestamp(),
  });
}

/** Remove a movie from the watchlist. */
export async function removeFromWatchlist(uid: string, movieId: string): Promise<void> {
  await deleteDoc(watchlistRef(uid, movieId));
}

/** Fetch all watchlist items, sorted by time added. */
export async function getWatchlist(uid: string): Promise<WatchlistMovieDoc[]> {
  const col = collection(db, 'users', uid, 'watchlist');
  const q = query(col, orderBy('addedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WatchlistMovieDoc);
}

// ─── Recommendation History ────────────────────────────────────────────────────

/**
 * Save a batch of recommendations.
 * recommendationId is a timestamp-based string for easy sorting.
 */
export async function saveRecommendationHistory(
  uid: string,
  movies: Movie[],
  answers?: Record<string, string>
): Promise<string> {
  const recommendationId = `rec_${Date.now()}`;
  await setDoc(recommendationRef(uid, recommendationId), {
    recommendedAt: serverTimestamp(),
    movies: movies.map((m) => ({
      id: m.id,
      title: m.title,
      poster: m.poster,
      rating: m.rating,
    })),
    answers: answers ?? {},
  });
  return recommendationId;
}

/** Fetch recommendation history, newest first, optionally limited. */
export async function getRecommendationHistory(
  uid: string,
  maxEntries = 20
): Promise<RecommendationHistoryDoc[]> {
  const col = collection(db, 'users', uid, 'recommendationHistory');
  const q = query(col, orderBy('recommendedAt', 'desc'), limit(maxEntries));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RecommendationHistoryDoc);
}
