import { useNavigation } from './SceneRouter';
import { useAudio } from './AudioProvider';
import { SCENE_CATALOG, type SceneDefinition } from '@app/scenes/sceneCatalog';

/**
 * Renders the fixed-position HUD overlay with back button, audio toggle, and loading spinner.
 * The back button is hidden when the current scene is the playroom and follows
 * each scene's catalog `backTarget` (defaulting to the playroom) elsewhere.
 *
 * @returns A fixed-position overlay div with pointer-events passthrough.
 */
export function UIOverlay() {
  const { currentScene, isTransitioning, navigateTo } = useNavigation();
  const { isMuted, toggleMute, playSound } = useAudio();

  const sceneDefinition: SceneDefinition = SCENE_CATALOG[currentScene];
  const backTarget = sceneDefinition.backTarget ?? 'playroom';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Back button — hidden in hub */}
      {currentScene !== 'playroom' && (
        <button
          onClick={() => {
            playSound('sfx_shared_button_press');
            navigateTo(backTarget);
          }}
          aria-label={`Back to ${SCENE_CATALOG[backTarget].displayName.toLowerCase()}`}
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          &#8592;
        </button>
      )}

      {/* Recenter camera button */}
      <button
        onClick={() => {
          playSound('sfx_shared_button_press');
          window.dispatchEvent(new Event('camera:recenter'));
        }}
        aria-label="Recenter camera"
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: currentScene !== 'playroom' ? 'calc(80px + env(safe-area-inset-left, 0px))' : 'calc(16px + env(safe-area-inset-left, 0px))',
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.85)',
          color: '#5a4a3a',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        &#8962;
      </button>

      {/* Audio toggle */}
      <button
        onClick={() => {
          playSound('sfx_shared_button_press');
          toggleMute();
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        style={{
          pointerEvents: 'auto',
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.85)',
          color: '#5a4a3a',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        {isMuted ? '\u{1F507}' : '\u{1F50A}'}
      </button>

      {/* Loading indicator */}
      {isTransitioning && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: '4px solid rgba(255,255,255,0.3)',
              borderTopColor: 'rgba(255,255,255,0.9)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
