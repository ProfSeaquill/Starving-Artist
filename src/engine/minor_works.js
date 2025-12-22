// src/engine/minor_works.js

/**
 * Minor Works v0.2
 * ===============
 *
 * Design goals:
 * - Each art path has EXACTLY 3 Minor Works (Quick / Career / Spotlight)
 * - Works are multi-step (progress pips), not instant.
 * - Only ONE work may be in progress at a time.
 * - Career Builder grants a small per-turn passive after completion.
 * - Quick Win is a modern/platform piece and grants a Platform Bonus.
 * - Spotlight consumes Platform Bonus for extra money.
 *
 * NOTE: We keep this intentionally lightweight: no new "Fame" stat.
 */

export const MINOR_WORK_KINDS = {
  QUICK: 'quick',
  CAREER: 'career',
  SPOTLIGHT: 'spotlight'
};

// Global tuning knobs (can be moved to config later)
export const PLATFORM_BONUS_AMOUNT = 2;
export const DEFAULT_PROGRESS = {
  [MINOR_WORK_KINDS.QUICK]: 2,
  [MINOR_WORK_KINDS.CAREER]: 4,
  [MINOR_WORK_KINDS.SPOTLIGHT]: 5
};

/**
 * Normalize artPath strings so older saves (e.g. 'painter') still work.
 */
export function normalizeArtPath(artPath) {
  const p = (artPath || '').toLowerCase().trim();
  if (!p) return 'visual_artist';

  if (p === 'author' || p === 'writer') return 'author';
  if (p === 'musician' || p === 'music') return 'musician';
  if (p === 'actor' || p === 'performer') return 'actor';
  if (p === 'dancer' || p === 'dance') return 'dancer';
  if (p === 'filmmaker' || p === 'video' || p === 'creator') return 'filmmaker';

  // Legacy visual path labels
  if (p === 'painter' || p === 'artist' || p === 'visual') return 'visual_artist';

  return p;
}

function stat(stat, delta) {
  return { type: 'stat', stat, delta };
}

/**
 * Returns the 3 Minor Work templates for a given art path.
 *
 * Template shape:
 * {
 *   id, name,
 *   kind: 'quick'|'career'|'spotlight',
 *   progressTarget: number,
 *   // applied once on completion
 *   onCompleteEffects: StatEffect[],
 *   // applied at start of each turn after completion
 *   effectsPerTurn: StatEffect[],
 *   // UI tags
 *   isPlatform: boolean
 * }
 */
export function getMinorWorkTemplatesForArtPath(artPath) {
  const ap = normalizeArtPath(artPath);

  switch (ap) {
    case 'author':
      return [
        {
          id: 'mw_author_microfiction_thread',
          name: 'Microfiction Thread / Newsletter Post',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('inspiration', 2)],
          effectsPerTurn: []
        },
        {
          id: 'mw_author_short_story_submission',
          name: 'Short Story Submission',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('inspiration', 1)]
        },
        {
          id: 'mw_author_chapbook_release',
          name: 'Chapbook Release',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 6)],
          effectsPerTurn: []
        }
      ];

    case 'musician':
      return [
        {
          id: 'mw_music_tiktok_cover_loop',
          name: 'TikTok/IG Cover Loop',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('money', 3)],
          effectsPerTurn: []
        },
        {
          id: 'mw_music_ep_streaming_release',
          name: 'EP (Streaming Release)',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('craft', 1)]
        },
        {
          id: 'mw_music_paid_gig_or_viral_performance',
          name: 'Paid Gig / Viral Performance',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 8)],
          effectsPerTurn: []
        }
      ];

    case 'visual_artist':
      return [
        {
          id: 'mw_visual_speedpaint_reel',
          name: 'Speedpaint Reel / Carousel Post',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('craft', 2)],
          effectsPerTurn: []
        },
        {
          id: 'mw_visual_portfolio_piece_commission_ready',
          name: 'Portfolio Piece (Commission-Ready)',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('craft', 1)]
        },
        {
          id: 'mw_visual_limited_print_drop',
          name: 'Limited Print Drop',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 6)],
          effectsPerTurn: []
        }
      ];

    case 'filmmaker':
      return [
        {
          id: 'mw_film_short_form_reel',
          name: 'Short-Form Reel (30–60s)',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('inspiration', 2)],
          effectsPerTurn: []
        },
        {
          id: 'mw_film_short_film_youtube_premiere',
          name: 'Short Film (YouTube Premiere)',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('craft', 1)]
        },
        {
          id: 'mw_film_festival_cut_submission',
          name: 'Festival Cut + Submission',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 7)],
          effectsPerTurn: []
        }
      ];

    case 'actor':
      return [
        {
          id: 'mw_actor_self_tape_clip',
          name: 'Self-Tape Clip / TikTok Scene',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('craft', 2)],
          effectsPerTurn: []
        },
        {
          id: 'mw_actor_scene_study_tape',
          name: 'Scene Study Tape (Partner/Coach)',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('inspiration', 1)]
        },
        {
          id: 'mw_actor_showcase_booked_role',
          name: 'Showcase Night / Booked Role',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 7)],
          effectsPerTurn: []
        }
      ];

    case 'dancer':
      return [
        {
          id: 'mw_dance_instagram_reel_combo',
          name: 'Instagram Reel Combo',
          kind: MINOR_WORK_KINDS.QUICK,
          isPlatform: true,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.QUICK],
          onCompleteEffects: [stat('inspiration', 2)],
          effectsPerTurn: []
        },
        {
          id: 'mw_dance_choreo_routine_class',
          name: 'Choreo Routine (Class/Studio)',
          kind: MINOR_WORK_KINDS.CAREER,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.CAREER],
          onCompleteEffects: [],
          effectsPerTurn: [stat('craft', 1)]
        },
        {
          id: 'mw_dance_competition_set_paid_gig',
          name: 'Competition Set / Paid Stage Gig',
          kind: MINOR_WORK_KINDS.SPOTLIGHT,
          isPlatform: false,
          progressTarget: DEFAULT_PROGRESS[MINOR_WORK_KINDS.SPOTLIGHT],
          onCompleteEffects: [stat('money', 7)],
          effectsPerTurn: []
        }
      ];

    default:
      return getMinorWorkTemplatesForArtPath('visual_artist');
  }
}

export function formatStatEffects(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return '';
  return effects
    .filter((e) => e && e.type === 'stat' && typeof e.delta === 'number' && e.delta !== 0)
    .map((e) => {
      const sign = e.delta >= 0 ? '+' : '';
      return `${e.stat} ${sign}${e.delta}`;
    })
    .join(', ');
}
