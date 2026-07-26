import { useEffect, useRef, useState } from 'react';
import { BADGES_PER_CROWN, MAX_CROWNS, PIPS_PER_BADGE, tallyScore } from './scoreDisplay';

/** Props for the in-game HUD overlay. */
interface MiniGameHUDProps {
  score: number;
  streak: number;
  /**
   * The game's `difficultyRamp.start`, used to size one pip. Passed rather than
   * the whole manifest so the HUD stays a dumb presentational component.
   */
  rampStart: number;
  showScore: boolean;
  showProgressBar: boolean;
  /** Progress value from 0 to 1 for round-based games. */
  progress: number;
  onExit: () => void;
  /** Whether audio is globally muted. */
  isMuted: boolean;
  /** Toggles the global mute state. */
  onToggleMute: () => void;
}

/** CSS keyframes injected once for HUD animations. */
const STYLE_ID = 'minigame-hud-styles';

/** Injects keyframe animations into the document head if not already present. */
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes hud-exit-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    @keyframes hud-score-flash {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
    @keyframes hud-pip-pop {
      0% { transform: scale(0.2); opacity: 0; }
      60% { transform: scale(1.35); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/** Palette for the counting display — warm, high-contrast on any game sky. */
const PIP_FILLED = '#FFD34D';
const PIP_EMPTY = 'rgba(255, 255, 255, 0.28)';
const PIP_STROKE = 'rgba(90, 74, 58, 0.85)';

/**
 * Draws one tier of the counting display: `filled` of `slots` round tokens.
 *
 * Tokens are circles, not glyphs — nothing here requires reading. The most
 * recently filled token pops so the child's eye is drawn to the change.
 *
 * @param props - Tier geometry and fill state.
 * @returns A row of tokens.
 */
function TokenRow({ slots, filled, size, popKey }: { slots: number; filled: number; size: number; popKey: number }) {
  return (
    <div style={{ display: 'flex', gap: Math.max(2, size * 0.22), justifyContent: 'flex-end' }}>
      {Array.from({ length: slots }, (_, i) => {
        const isFilled = i < filled;
        const isNewest = isFilled && i === filled - 1;
        return (
          <span
            // Remounting the newest token on every score change restarts the
            // pop animation; a stable key would play it only once.
            key={isNewest ? `${i}-${popKey}` : i}
            style={{
              display: 'inline-block',
              width: size,
              height: size,
              borderRadius: '50%',
              background: isFilled ? PIP_FILLED : PIP_EMPTY,
              border: `2px solid ${PIP_STROKE}`,
              boxShadow: isFilled ? `0 0 ${size * 0.4}px rgba(255, 211, 77, 0.85)` : 'none',
              animation: isNewest ? 'hud-pip-pop 260ms ease-out' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Renders the mini-game HUD overlay with exit button, score, combo indicator, and progress bar.
 * The container uses pointer-events: none so the game canvas remains interactive;
 * only the exit button receives pointer events.
 *
 * @param props - HUD configuration and callbacks.
 * @returns The HUD overlay element.
 */
export function MiniGameHUD({ score, streak, rampStart, showScore, showProgressBar, progress, onExit, isMuted, onToggleMute }: MiniGameHUDProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const isFirstRender = useRef(true);
  const tally = tallyScore(score, rampStart);

  useEffect(() => {
    ensureStyles();
  }, []);

  // Flash briefly when score changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const onTimer = requestAnimationFrame(() => setIsFlashing(true));
    const offTimer = setTimeout(() => setIsFlashing(false), 300);
    return () => {
      cancelAnimationFrame(onTimer);
      clearTimeout(offTimer);
    };
  }, [score]);

  // Compute combo ring count (1-4) based on multiplier tiers
  const comboLevel = streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Exit button -- top-left, 56x56px white circle with left arrow */}
      <button
        onClick={onExit}
        aria-label="Exit mini-game"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: 'calc(16px + env(safe-area-inset-left, 0px))',
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.85)',
          color: '#5a4a3a',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          animation: 'hud-exit-pulse 2s ease-in-out infinite',
        }}
      >
        &#8592;
      </button>

      {/* Mute button -- next to exit, so parents can silence a game without leaving it */}
      <button
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={isMuted}
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 'calc(20px + env(safe-area-inset-top, 0px))',
          left: 'calc(88px + env(safe-area-inset-left, 0px))',
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.7)',
          color: '#5a4a3a',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        {isMuted ? <span>&#128263;</span> : <span>&#128266;</span>}
      </button>

      {/* Score display -- top-right, shown only when showScore is true */}
      {showScore && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(16px + env(safe-area-inset-top, 0px))',
            right: 'calc(16px + env(safe-area-inset-right, 0px))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
          }}
        >
          {/*
            The counting display. No numerals: the player is three or four and
            cannot read them, so the score is told in tokens that fill a row —
            pips collapse into badges, badges into crowns. See scoreDisplay.ts.
          */}
          <div
            aria-label={`Score ${score}`}
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 16,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 5,
              transition: 'opacity 0.3s ease',
              opacity: isFlashing ? 1 : 0.82,
            }}
          >
            {tally.crowns > 0 && <TokenRow slots={Math.min(MAX_CROWNS, Math.max(1, tally.crowns))} filled={tally.crowns} size={18} popKey={score} />}
            {(tally.crowns > 0 || tally.badges > 0) && <TokenRow slots={BADGES_PER_CROWN} filled={tally.badges} size={12} popKey={score} />}
            <TokenRow slots={PIPS_PER_BADGE} filled={tally.pips} size={16} popKey={score} />
          </div>

          {/* Combo indicator -- shown below score when streak >= 3 */}
          {comboLevel > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 3,
                justifyContent: 'flex-end',
                paddingRight: 8,
              }}
            >
              {Array.from({ length: comboLevel }, (_, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid #5a4a3a',
                    background: 'rgba(255, 220, 100, 0.8)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress bar -- bottom center, shown only when showProgressBar is true */}
      {showProgressBar && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            maxWidth: 400,
            height: 10,
            borderRadius: 5,
            background: 'rgba(255, 255, 255, 0.3)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
              height: '100%',
              borderRadius: 5,
              background: 'rgba(255, 255, 255, 0.85)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}
