<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Starving Artist Prototype</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111;
      color: #eee;
      margin: 0;
      padding: 0;
    }
    header {
      padding: 12px 16px;
      background: #222;
      border-bottom: 1px solid #333;
    }
    main {
      display: grid;
      grid-template-columns: minmax(260px, 320px) 1fr;
      gap: 16px;
      padding: 16px;
    }
    .panel {
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
      background: #181818;
    }
    h1, h2, h3 {
      margin: 0 0 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      font-size: 14px;
    }
    .label {
      color: #aaa;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .value {
      font-weight: 600;
    }
    .stage-name {
      font-size: 18px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 11px;
      border: 1px solid #555;
      margin-left: 4px;
    }
    .badge.pro { border-color: #f5c842; color: #f5c842; }
    .badge.amateur { border-color: #42c0f5; color: #42c0f5; }
    .badge.dreamer { border-color: #9b59b6; color: #9b59b6; }
    .badge.home { border-color: #7f8c8d; color: #7f8c8d; }

    .controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 6px;
      margin-top: 8px;
    }
    button {
      background: #333;
      color: #eee;
      border-radius: 6px;
      border: 1px solid #444;
      padding: 6px 8px;
      font-size: 13px;
      cursor: pointer;
    }
    button:hover { background: #444; }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    select {
      background: #222;
      color: #eee;
      border-radius: 4px;
      border: 1px solid #444;
      padding: 4px;
      font-size: 13px;
    }
    .section-title {
      margin-top: 8px;
      font-size: 13px;
      text-transform: uppercase;
      color: #aaa;
      letter-spacing: 0.08em;
    }
    .log {
      font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      max-height: 200px;
      overflow-y: auto;
      background: #101010;
      border-radius: 6px;
      padding: 6px;
      border: 1px solid #333;
      white-space: pre-wrap;
    }
    .game-over {
      margin-top: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      background: #3e1b1b;
      border: 1px solid #a33;
      color: #fdd;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Starving Artist – Prototype</h1>
  </header>
  <main>
    <!-- Left: Stats & stage info -->
    <section class="panel">
      <h2>Artist</h2>
      <div class="stats-grid">
        <div class="label">Turn</div>
        <div class="value" id="turn"></div>

        <div class="label">Art Path</div>
        <div class="value" id="artPath"></div>

        <div class="label">Stage</div>
        <div class="value">
          <span id="stageName" class="stage-name"></span>
          <span id="stageBadge" class="badge"></span>
        </div>

        <div class="label">Money</div>
        <div class="value" id="statMoney"></div>

        <div class="label">Food</div>
        <div class="value" id="statFood"></div>

        <div class="label">Inspiration</div>
        <div class="value" id="statInspiration"></div>

        <div class="label">Craft</div>
        <div class="value" id="statCraft"></div>

        <div class="label">Time (this turn)</div>
        <div class="value" id="statTime"></div>

        <div class="label">Minor Works</div>
        <div class="value" id="minorWorksCount"></div>

        <div class="label">Portfolio</div>
        <div class="value" id="portfolioStatus"></div>

        <div class="label">Masterwork</div>
        <div class="value" id="masterworkProgress"></div>
      </div>

      <div class="section-title">Job</div>
      <div id="jobInfo"></div>

      <div class="section-title">Culture</div>
      <div id="cultureInfo"></div>

      <div id="gameOverBanner" class="game-over" style="display:none;"></div>
    </section>

    <!-- Right: Controls & log -->
    <section class="panel">
      <h2>Actions</h2>

      <div class="section-title">Turn</div>
      <div class="controls-grid">
        <button id="startTurnBtn">Start Turn</button>
        <button id="rollTimeBtn">Roll Time</button>
        <button id="endTurnBtn">End Turn</button>
      </div>

      <div class="section-title">Home</div>
      <div class="controls-grid">
        <button id="drawHomeBtn">Draw Home Card</button>
        <button id="attemptLeaveHomeBtn">Attempt Leave Home</button>
      </div>

      <div class="section-title">Dreamer</div>
      <div class="controls-grid">
        <button id="attendSocialBtn">Attend Social Event</button>
        <button id="skipSocialBtn">Skip Social Event</button>
        <button id="attemptAdvanceDreamerBtn">Try to Go Amateur</button>
      </div>

      <div class="section-title">Amateur</div>
      <div class="controls-grid">
        <select id="jobSelect">
          <option value="">Select Job…</option>
        </select>
        <button id="chooseJobBtn">Choose Job</button>
        <button id="goToWorkBtn">Go to Work</button>
        <button id="takeProfDevBtn">Pro Dev (Skip Work)</button>
        <button id="startMinorWorkBtn">Start Minor Work (Test)</button>
        <button id="compilePortfolioBtn">Compile Portfolio</button>
        <button id="attemptAdvanceProBtn">Try to Go Pro</button>
      </div>

      <div class="section-title">Pro</div>
      <div class="controls-grid">
        <button id="workMasterworkBtn">Work on Masterwork</button>
        <button id="drawProCardBtn">Draw Pro Card</button>
        <button id="proMaintenanceBtn">Pro Maintenance Check</button>
      </div>

      <div class="section-title">Last Card / Rolls</div>
      <div id="cardInfo"></div>

      <div class="section-title">Minor Works</div>
      <div id="minorWorksList"></div>

      <div class="section-title">Debug Log</div>
      <div id="debugLog" class="log"></div>
    </section>
  </main>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
