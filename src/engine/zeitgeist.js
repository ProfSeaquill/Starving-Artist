// src/engine/zeitgeist.js
// Zeitgeist definitions + d6 mapping

export const ZEITGEISTS = [
  {
    id: 'ai_boom',
    roll: 1,
    name: 'AI Boom',
    text: 'Once per turn, convert 1 Inspiration into +1 Money / Food / Craft.'
  },
  {
    id: 'indie_wave',
    roll: 2,
    name: 'Indie Wave',
    text: 'Whenever you complete a Minor Work, gain +1 Craft.'
  },
  {
    id: 'wellness_culture',
    roll: 3,
    name: 'Wellness Culture',
    text: 'Downtime actions grant +1 extra of their stat (Practice/Sleep/Eat at Home).'
  },
  {
    id: 'gig_economy',
    roll: 4,
    name: 'Gig Economy',
    text: 'Whenever you Go To Work, gain +1 Money.'
  },
  {
    id: 'streaming_era',
    roll: 5,
    name: 'Streaming Era',
    text: 'After drawing a Social / Prof Dev / Pro card, refund +1 Time.'
  },
  {
    id: 'culture_war',
    roll: 6,
    name: 'Culture War',
    text: 'Whenever you Plant a Hit Piece, the target gains +1 extra Scandal.'
  }
];

export function getZeitgeistByRoll(roll) {
  const r = Number(roll);
  return ZEITGEISTS.find(z => z.roll === r) || null;
}
