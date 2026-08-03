import type { CSSProperties } from 'react';
import { useNavigation } from './SceneRouter';
import { useAudio } from './AudioProvider';
import { useResponsive } from './ResponsiveProvider';
import { SCENE_CATALOG, type SceneDefinition } from '@app/scenes/sceneCatalog';
import { resolveStageRect, resolveChromeBand, MIN_CHROME_BAND } from '@app/utils/scene/stageRect';

/**
 * The smallest a control is ever drawn, in CSS pixels.
 *
 * A three-year-old's fingertip contact patch is larger than an adult's pointing
 * finger, not smaller, and they aim worse. Every platform guideline floors touch
 * targets around 44px; this sits above that and never scales below it, which is
 * the point of having a floor rather than a percentage.
 */
const MIN_CONTROL = 56;

/** The largest, so a 4K window does not draw a mute button the size of a plate. */
const MAX_CONTROL = 88;

/** Padding inside the chrome band, as a fraction of the control size. */
const GAP_RATIO = 0.35;

/**
 * The HUD: back, recenter, mute, and the transition spinner.
 *
 * WHERE THESE SIT, AND WHY IT MOVED
 * ---------------------------------
 * They used to be pinned to the viewport corners at a fixed 16px inset with
 * fixed 48-56px diameters, floating on top of the scene. Two things were wrong
 * with that. On a phone the buttons covered scene the child was meant to be able
 * to touch, and at any size they stayed the same number of PIXELS — so on a
 * large display they shrank relative to everything else, and on a small one they
 * ate a larger share of a frame that was already too small.
 *
 * The stage is letterboxed now (see utils/scene/stageRect), so on any viewport
 * outside the 1.0–1.4 band there is a chrome band with nothing in it. That is
 * where these belong: off the scene entirely, sized from the band rather than
 * from a constant. When the viewport is inside the band there is no chrome, and
 * they fall back to floating over the top corners as before — but still scaled.
 *
 * @returns A fixed-position overlay div with pointer-events passthrough.
 */
export function UIOverlay() {
  const { currentScene, isTransitioning, navigateTo } = useNavigation();
  const { isMuted, toggleMute, playSound } = useAudio();
  const { viewportWidth, viewportHeight } = useResponsive();

  const sceneDefinition: SceneDefinition = SCENE_CATALOG[currentScene];
  const backTarget = sceneDefinition.backTarget ?? 'playroom';

  const stage = resolveStageRect(viewportWidth, viewportHeight);
  const measured = resolveChromeBand(viewportWidth, viewportHeight);

  // A BAND TOO THIN TO HOLD A CONTROL IS NOT A BAND. On a viewport small enough
  // that the stage cannot give up `MIN_CHROME_BAND` without leaving the aspect
  // band the framings are solved for, the aspect wins and what is left over is a
  // sliver. Laying the row out in a sliver puts oversized buttons half on the
  // scene, which is worse than the float this replaced. So below the floor the
  // HUD floats over the stage corner, exactly as it does when the viewport is
  // inside the band and there is no chrome at all.
  const usable = Math.max(measured.below, measured.beside) >= MIN_CHROME_BAND;
  const band = usable ? measured : { below: 0, beside: 0 };
  const inBand = band.below > 0 || band.beside > 0;

  // Size from whichever band exists. The 0.55 leaves room for the gap above and
  // below the row; without it a control exactly as tall as the band touches both
  // edges and reads as a bar rather than a button.
  const bandExtent = band.below > 0 ? band.below : band.beside;
  const control = inBand
    ? Math.min(MAX_CONTROL, Math.max(MIN_CONTROL, bandExtent * 0.55))
    : Math.min(MAX_CONTROL, Math.max(MIN_CONTROL, Math.min(viewportWidth, viewportHeight) * 0.09));
  const gap = control * GAP_RATIO;

  const round = (size: number) => ({
    pointerEvents: 'auto' as const,
    width: size,
    height: size,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#5a4a3a',
    fontSize: size * 0.42,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    flex: '0 0 auto',
  });

  // Below the stage when the band is under it, beside the stage when the band is
  // at the sides, and floating over the stage top when there is no band at all.
  const rowStyle: CSSProperties =
    band.below > 0
      ? {
          position: 'absolute',
          left: 0,
          right: 0,
          top: stage.height,
          height: band.below,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxSizing: 'border-box',
        }
      : band.beside > 0
        ? {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: band.beside,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap,
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            boxSizing: 'border-box',
          }
        : {
            position: 'absolute',
            left: `calc(${gap}px + env(safe-area-inset-left, 0px))`,
            top: `calc(${gap}px + env(safe-area-inset-top, 0px))`,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap,
          };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
      <div style={rowStyle}>
        {/* Back — hidden in the hub, which is where back would go nowhere. */}
        {currentScene !== 'playroom' && (
          <button
            onClick={() => {
              playSound('sfx_shared_button_press');
              navigateTo(backTarget);
            }}
            aria-label={`Back to ${SCENE_CATALOG[backTarget].displayName.toLowerCase()}`}
            style={round(control)}
          >
            &#8592;
          </button>
        )}

        <button
          onClick={() => {
            playSound('sfx_shared_button_press');
            window.dispatchEvent(new Event('camera:recenter'));
          }}
          aria-label="Recenter camera"
          style={round(control * 0.86)}
        >
          &#8962;
        </button>

        <button
          onClick={() => {
            playSound('sfx_shared_button_press');
            toggleMute();
          }}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          style={round(control * 0.86)}
        >
          {isMuted ? '\u{1F507}' : '\u{1F50A}'}
        </button>
      </div>

      {/* Loading indicator, centred on the STAGE rather than the viewport — with
          a chrome band below, the viewport centre is not the middle of the
          picture and the spinner reads as hanging low. */}
      {isTransitioning && (
        <div
          style={{
            position: 'absolute',
            top: stage.offsetY + stage.height / 2,
            left: stage.offsetX + stage.width / 2,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: control * 0.86,
              height: control * 0.86,
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
