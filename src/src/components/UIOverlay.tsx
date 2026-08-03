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

/**
 * The largest, so a 4K window does not draw a mute button the size of a plate.
 *
 * Raised from 88 after looking at a phone render. On a 393x852 screen the chrome
 * band is 459px tall and the controls were 88px, which left three small circles
 * floating in the middle of a large dark rectangle — the band read as something
 * unfinished rather than as part of the app. The band is the only place the HUD
 * lives on a phone; the controls should look like they belong to it.
 */
const MAX_CONTROL = 132;

/** Padding inside the chrome band, as a fraction of the control size. */
const GAP_RATIO = 0.35;

/** The chrome band's own surface — warm, so it reads as part of the toybox. */
const BAND_COLOR = '#2b211a';

/** The lip where the band meets the picture. */
const BAND_EDGE = '#4a382b';

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
  // The row has to fit ACROSS the band as well as within it, and a first pass at
  // this only sized on the band's depth. On a 393-wide phone that produced 132px
  // controls in a row 450px wide: the back and mute buttons were sliced off by
  // the screen edges. Two buttons in the hub, three everywhere else.
  const buttonCount = currentScene === 'playroom' ? 2 : 3;
  // n controls and n-1 gaps, where a gap is GAP_RATIO of a control, plus an edge
  // margin of one gap either side: (n + (n + 1) * GAP_RATIO) * control <= span.
  const spanFor = (span: number): number => span / (buttonCount + (buttonCount + 1) * GAP_RATIO);

  const bandExtent = band.below > 0 ? band.below : band.beside;
  const acrossLimit = band.below > 0 ? spanFor(viewportWidth) : band.beside > 0 ? band.beside * 0.72 : spanFor(viewportWidth);
  const control = inBand
    ? Math.min(MAX_CONTROL, acrossLimit, Math.max(MIN_CONTROL, bandExtent * 0.42))
    : Math.min(MAX_CONTROL, acrossLimit, Math.max(MIN_CONTROL, Math.min(viewportWidth, viewportHeight) * 0.09));
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

  // THE BAND IS A SURFACE, NOT A GAP. Without this the leftover viewport is
  // whatever `html { background }` happens to be — on a phone that is 54% of the
  // screen in flat near-black, which reads as the page failing to load rather
  // than as a frame around the picture. A warm panel with a lip along the edge
  // it meets the scene at says the same space is deliberate.
  //
  // TWO strips when the band is at the sides, not one full-width panel. The
  // first version of this used `width: '100%'` for the beside case and painted
  // the entire viewport — scene included — in band colour. It rendered as a
  // completely blank brown screen on an ultrawide, and every measurement in the
  // repo still passed, because nothing measures what is on top of the canvas.
  const lip = `${Math.max(2, control * 0.045)}px solid ${BAND_EDGE}`;
  const bandSurfaces: CSSProperties[] =
    band.below > 0
      ? [{ position: 'absolute', left: 0, right: 0, top: stage.height, bottom: 0, background: BAND_COLOR, borderTop: lip }]
      : band.beside > 0
        ? [
            { position: 'absolute', left: 0, top: 0, bottom: 0, width: band.beside, background: BAND_COLOR, borderRight: lip },
            { position: 'absolute', right: 0, top: 0, bottom: 0, width: band.beside, background: BAND_COLOR, borderLeft: lip },
          ]
        : [];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
      {bandSurfaces.map((surface, index) => (
        <div key={index} style={surface} />
      ))}
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
