import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@app/components/ErrorBoundary';
import { ResponsiveProvider } from '@app/components/ResponsiveProvider';
import { AudioProvider } from '@app/components/AudioProvider';
import { SceneRouter } from '@app/components/SceneRouter';
import { SceneFrame } from '@app/components/SceneFrame';
import { UIOverlay } from '@app/components/UIOverlay';
import { MiniGameOverlay } from '@app/components/MiniGameOverlay';
import { LandingPage } from '@app/components/LandingPage';
import { NotFoundPage } from '@app/components/NotFoundPage';
import { isSceneId } from '@app/scenes/sceneCatalog';

/** Determines the top-level view from the current URL hash. */
type AppView = 'landing' | 'app' | 'notfound';

/**
 * Inspects the URL hash and returns which top-level view to render.
 * Empty hash → landing page. Valid scene hash → 3D app. Anything else → 404.
 *
 * @returns The current AppView.
 */
function resolveView(): AppView {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return 'landing';
  const firstSegment = hash.split('/')[0];
  if (isSceneId(firstSegment)) return 'app';
  return 'notfound';
}

/**
 * Renders the top-level application shell.
 * Shows the marketing landing page when the URL has no hash,
 * the 3D Three.js app for valid routes, or a 404 page for invalid ones.
 *
 * WHY `AudioProvider` WRAPS ALL THREE VIEWS AND NOT JUST THE 3D ONE. A browser
 * will not start audio until the user has touched the page, so the provider arms
 * a `pointerdown` listener and builds its `AudioContext` on the first gesture it
 * sees. While it was mounted only on the scene branch, the ONE gesture that
 * matters — the tap on "Open the Toybox" — happened on the landing page, where no
 * listener existed yet. The child arrived in a room with the audio still locked
 * and the room stayed silent until they happened to touch the screen again.
 *
 * MEASURED (`.probe/render/audio-unlock.mjs`, iPhone 13 viewport, touch
 * emulation, no autoplay override): landing -> tap the call to action -> wait
 * eight seconds gave `AudioContext` count 0 and **0 oscillators**. One tap
 * anywhere inside the room produced a running context and **156 oscillators** in
 * the same instant. The audio system was never broken; it was never given a
 * gesture. Serving the app at the site root made this universal — before that,
 * anyone deep-linking to a scene skipped the landing page and got sound.
 *
 * THE LEAK THIS DOES NOT REINTRODUCE. `AudioProvider`'s teardown closes its
 * context, and its comment explains why: mounted per-route, every Play -> Back
 * cycle built another one, and Chrome caps a document at six. Hoisting it here
 * removes that cycle rather than papering over it — the provider now mounts once
 * for the session and its close runs when the page goes away. One context, built
 * on the first touch of the visit, whichever view the visitor is on.
 *
 * @returns The landing page, 404 page, or the full 3D component tree.
 */
export function App() {
  const [view, setView] = useState<AppView>(resolveView);

  useEffect(() => {
    function onRouteChange() {
      setView(resolveView());
    }
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AudioProvider>
        {view === 'landing' ? (
          <LandingPage />
        ) : view === 'notfound' ? (
          <NotFoundPage />
        ) : (
          <ResponsiveProvider>
            <SceneRouter>
              <SceneFrame>
                <UIOverlay />
                <MiniGameOverlay />
              </SceneFrame>
            </SceneRouter>
          </ResponsiveProvider>
        )}
      </AudioProvider>
    </ErrorBoundary>
  );
}
