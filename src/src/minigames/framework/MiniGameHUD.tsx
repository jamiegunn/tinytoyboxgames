import { useEffect, useRef, useState } from 'react';

/** Props for the in-game HUD overlay. */
interface MiniGameHUDProps {
  score: number;
  streak: number;
  showScore: boolean;
  showProgressBar: boolean;
  /** Progress value from 0 to 1 for round-based games. */
  progress: number;
  onExit: () => void;
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
  `;
  document.head.appendChild(style);
}

/**
 * Renders the mini-game HUD overlay with exit button, score, combo indicator, and progress bar.
 * The container uses pointer-events: none so the game canvas remains interactive;
 * only the exit button receives pointer events.
 *
 * @param props - HUD configuration and callbacks.
 * @returns The HUD overlay element.
 */
export function MiniGameHUD({ score, streak, showScore, showProgressBar, progress, onExit }: MiniGameHUDProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const isFirstRender = useRef(true);

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
          top: 16,
          left: 16,
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

      {/* Score display -- top-right, shown only when showScore is true */}
      {showScore && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 16,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#5a4a3a',
              fontSize: 22,
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
              transition: 'opacity 0.3s ease',
              opacity: isFlashing ? 1 : 0.7,
            }}
          >
            <span style={{ fontSize: 20 }}>&#9733;</span>
            <span>{score}</span>
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
