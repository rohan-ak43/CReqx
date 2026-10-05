//CReqx/Frontend/src/pages/RecommendationEngine.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronRight, RefreshCw, Film, Disc, Clapperboard, Globe, Zap, Target, Moon, User, Heart, Users, Home, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tmdbService } from '../lib/tmdb';
import { MovieCard } from '../components/movie/MovieCard';
import { MovieGridSkeleton } from '../components/ui/LoadingSkeleton';
import type { DiscoverParams } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';
import { saveRecommendationHistory, getRecommendationHistory, type RecommendationHistoryDoc } from '../lib/firestoreService';

const questions = [
  {
    id: 'era',
    question: 'Preferred era?',
    options: [
      { value: 'classic', label: 'Classic (Pre-2000)', icon: Film },
      { value: 'modern', label: 'Modern (2000s)', icon: Disc },
      { value: 'recent', label: 'Recent (2015+)', icon: Clapperboard },
      { value: 'any', label: 'Any era', icon: Globe },
    ],
  },
  {
    id: 'length',
    question: 'How long is your evening?',
    options: [
      { value: 'short', label: 'Quick (<90 min)', icon: Zap },
      { value: 'medium', label: 'Standard (90–120 min)', icon: Target },
      { value: 'long', label: 'Epic (120+ min)', icon: Moon },
      { value: 'any', label: "Doesn't matter", icon: Star },
    ],
  },
  {
    id: 'company',
    question: "Who's watching with you?",
    options: [
      { value: 'solo', label: 'Just me', icon: User },
      { value: 'partner', label: 'Date night', icon: Heart },
      { value: 'friends', label: 'Friends', icon: Users },
      { value: 'family', label: 'Family', icon: Home },
    ],
  },
];

function answersToDiscoverParams(answers: Record<string, string>): DiscoverParams {
  const params: DiscoverParams = {
    sortBy: 'vote_average.desc',
    voteCountGte: 200,
  };

  // Era
  if (answers.era === 'classic') {
    params.primaryReleaseDateLte = '1999-12-31';
  } else if (answers.era === 'modern') {
    params.primaryReleaseDateGte = '2000-01-01';
    params.primaryReleaseDateLte = '2014-12-31';
  } else if (answers.era === 'recent') {
    params.primaryReleaseDateGte = '2015-01-01';
  }

  // Length
  if (answers.length === 'short') params.withRuntimeLte = 89;
  if (answers.length === 'medium') { params.withRuntimeGte = 90; params.withRuntimeLte = 120; }
  if (answers.length === 'long') params.withRuntimeGte = 121;

  // Company
  if (answers.company === 'partner') params.genreIds = [10749, 18]; // Romance, Drama
  if (answers.company === 'friends') params.genreIds = [35, 28, 53]; // Comedy, Action, Thriller
  if (answers.company === 'family') params.genreIds = [10751, 16, 12]; // Family, Animation, Adventure

  return params;
}

export function RecommendationEngine() {
  const { user } = useAuth();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [finalParams, setFinalParams] = useState<DiscoverParams | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});

  // UI state for recommendation history panel
  const [showHistory, setShowHistory] = useState(false);

  const current = questions[step];
  const progress = (step / questions.length) * 100;

  // ── Fetch recommendations from TMDB (unchanged ML logic) ───────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', finalParams],
    queryFn: () => tmdbService.discover({ ...finalParams!, page: 1 }),
    enabled: showResults && !!finalParams,
    staleTime: 5 * 60 * 1000,
  });

  const results = data?.movies ?? [];

  // ── Save to Firestore once results arrive ─────────────────────────────────
  const [savedThisSession, setSavedThisSession] = useState(false);
  if (showResults && !isLoading && results.length > 0 && user && !savedThisSession) {
    setSavedThisSession(true);
    saveRecommendationHistory(user.uid, results.slice(0, 9), savedAnswers).catch((e) =>
      console.error('[RecommendationEngine] saveRecommendationHistory:', e)
    );
  }

  // ── Fetch past recommendation history ─────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['recommendation-history', user?.uid],
    queryFn: () => getRecommendationHistory(user!.uid, 10),
    enabled: showHistory && !!user,
    staleTime: 2 * 60 * 1000,
  });

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [current.id]: value };
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setSavedAnswers(newAnswers);
      setFinalParams(answersToDiscoverParams(newAnswers));
      setShowResults(true);
      setSavedThisSession(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setStep(0);
    setShowResults(false);
    setFinalParams(null);
    setSavedThisSession(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      {/* History toggle — only visible when signed in */}
      {user && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-void-800 px-4 py-2 text-sm text-mist-400 hover:text-mist-100 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Hide history' : 'Past recommendations'}
          </button>
        </div>
      )}

      {/* ── Past Recommendations Panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            key="rec-history"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-10"
          >
            <div className="glass rounded-2xl p-6">
              <h2 className="font-display text-lg font-bold text-mist-100 mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-dusk-400" /> Past Recommendations
              </h2>

              {historyLoading ? (
                <p className="text-sm text-mist-500">Loading…</p>
              ) : !historyData || historyData.length === 0 ? (
                <p className="text-sm text-mist-500">No recommendation history yet.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {historyData.map((rec: RecommendationHistoryDoc, idx: number) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-void-800/40 p-4">
                      <p className="mb-2 text-xs text-mist-500">
                        {rec.recommendedAt?.toDate?.()?.toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        }) ?? '—'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rec.movies.slice(0, 5).map((m) => (
                          <Link
                            key={m.id}
                            to={`/movies/${m.id}`}
                            className="flex items-center gap-2 rounded-lg bg-void-700 px-2.5 py-1.5 text-xs font-medium text-mist-200 hover:text-ember-300 transition-colors"
                          >
                            {m.title}
                          </Link>
                        ))}
                        {rec.movies.length > 5 && (
                          <span className="flex items-center rounded-lg bg-void-700 px-2.5 py-1.5 text-xs text-mist-500">
                            +{rec.movies.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Questionnaire / Results ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            {/* Progress */}
            <div className="mb-10">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-mist-500">Question {step + 1} of {questions.length}</span>
                <span className="flex items-center gap-1.5 text-ember-400 font-semibold">
                  Recommendation Engine
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-void-700 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-ember-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            <h1 className="font-display text-3xl font-bold text-mist-100 mb-8">{current.question}</h1>

            <div className="grid grid-cols-2 gap-3">
              {current.options.map(opt => (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAnswer(opt.value)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-void-800/60 p-6 text-center hover:border-ember-500/40 hover:bg-ember-500/5 transition-all"
                >
                  <opt.icon className="h-8 w-8 mb-2" />
                  <span className="text-sm font-semibold text-mist-100">{opt.label}</span>
                </motion.button>
              ))}
            </div>

            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="mt-6 text-sm text-mist-500 hover:text-mist-100 transition-colors"
              >
                ← Back
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold text-mist-100">Your Picks</h1>
                <p className="mt-1 text-mist-500">
                  {isLoading ? 'Finding the perfect matches…' : `${results.length} perfect matches for you`}
                </p>
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-void-800 px-4 py-2 text-sm text-mist-400 hover:text-mist-100 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Start over
              </button>
            </div>

            {/* Saved indicator */}
            {user && !isLoading && results.length > 0 && (
              <p className="mb-4 text-xs text-dusk-400 flex items-center gap-1">
                <History className="h-3 w-3" /> Saved to your recommendation history
              </p>
            )}

            {isLoading ? (
              <MovieGridSkeleton count={6} />
            ) : (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {results.slice(0, 9).map((movie, i) => (
                  <motion.div
                    key={movie.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <MovieCard movie={movie} />
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mt-10 text-center">
              <Link
                to="/movies"
                className="inline-flex items-center gap-2 text-sm font-medium text-ember-400 hover:text-ember-300 transition-colors"
              >
                Browse all movies <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}