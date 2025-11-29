// src/main.js
import { createInitialGame } from './engine/state.js';
import { applyAction } from './engine/rules.js';
import { ActionTypes } from './engine/actions.js';
// import { render } from './ui/render.js'; // once you have it

let gameState = createInitialGame();

// helper for UI
function dispatch(action) {
  gameState = applyAction(gameState, action);
  console.log('New state:', gameState);
  // render(gameState); // later
}

// Example: one full "Home turn" flow:
// 1) dispatch({ type: START_TURN })
// 2) dispatch({ type: DRAW_HOME_CARD })
// 3) dispatch({ type: ATTEMPT_LEAVE_HOME })
// 4) dispatch({ type: END_TURN })
