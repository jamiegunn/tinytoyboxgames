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

  if (view === 'landing') {
    return (
      <ErrorBoundary>
        <LandingPage />
      </ErrorBoundary>
    );
  }

  if (view === 'notfound') {
    return (
      <ErrorBoundary>
        <NotFoundPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ResponsiveProvider>
        <AudioProvider>
          <SceneRouter>
            <SceneFrame>
              <UIOverlay />
              <MiniGameOverlay />
            </SceneFrame>
          </SceneRouter>
        </AudioProvider>
      </ResponsiveProvider>
    </ErrorBoundary>
  );
}
