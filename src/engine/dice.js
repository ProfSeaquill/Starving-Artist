// src/engine/dice.js

/**
 * Roll a single die with a given number of sides.
 * Returns an integer from 1..sides.
 */
export function rollDie(sides = 6) {
  return 1 + Math.floor(Math.random() * sides);
}

/**
 * Convenience: roll a d6.
 */
export function rollD6() {
  return rollDie(6);
}
