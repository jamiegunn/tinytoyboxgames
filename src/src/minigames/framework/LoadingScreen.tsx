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
      {/*
        The game's emblem, not its name. This card used to render `displayName`
        at 28px bold — text held in front of a child who cannot read, in a
        product whose whole premise is that nothing requires reading. The name
        survives as the accessible label; the child gets a shape and a colour.
      */}
      <div
        role="img"
        aria-label={displayName}
        style={{
          width: 108,
          height: 108,
          marginBottom: 32,
          borderRadius: 28,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: `0 6px 26px rgba(0, 0, 0, 0.3), inset 0 0 0 5px ${themeColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'loading-bounce 1.6s ease-in-out infinite',
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: themeColor,
            boxShadow: `0 0 22px ${themeColor}`,
          }}
        />
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
