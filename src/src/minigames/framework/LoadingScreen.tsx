import { useEffect } from 'react';

/** Props for the mini-game loading screen overlay. */
interface LoadingScreenProps {
  displayName: string;
  themeColor: string;
  visible: boolean;
}

/** CSS keyframes injected once for the loading bounce animation. */
const STYLE_ID = 'minigame-loading-styles';

/** Injects keyframe animations into the document head if not already present. */
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes loading-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Renders a full-screen overlay shown while a mini-game module is loading.
 * Displays the game name and a gentle bouncing indicator. Fades in/out
 * over 300ms based on the visible prop.
 *
 * @param props - Loading screen configuration.
 * @returns The loading overlay element.
 */
export function LoadingScreen({ displayName, themeColor, visible }: LoadingScreenProps) {
  useEffect(() => {
    ensureStyles();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(135deg, #1a1a2e 0%, ${themeColor} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 300ms ease',
      }}
    >
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.95)',
          fontSize: 28,
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          marginBottom: 32,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {displayName}
      </div>

      {/* Bouncing dots indicator */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.8)',
              animation: `loading-bounce 0.8s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
