import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ResponsiveState, Orientation } from '@app/types/responsive';

const MOBILE_BREAKPOINT = 768;
const DEBOUNCE_MS = 100;

function getResponsiveState(): ResponsiveState {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const orientation: Orientation = w >= h ? 'landscape' : 'portrait';
  const isMobile = w < MOBILE_BREAKPOINT;
  const scaleFactor = Math.min(w / 1440, 1);
  return { viewportWidth: w, viewportHeight: h, orientation, scaleFactor, isMobile };
}

const ResponsiveContext = createContext<ResponsiveState>(getResponsiveState());

/**
 * Provides access to the current viewport and device responsive state.
 *
 * @returns The current ResponsiveState from context.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useResponsive(): ResponsiveState {
  return useContext(ResponsiveContext);
}

/**
 * Tracks viewport dimensions, orientation, and mobile status with 100ms debounced resize handling.
 * Provides responsive state to all descendants via React context.
 *
 * @param children - React children that consume responsive context.
 * @returns A context provider wrapping the children.
 */
export function ResponsiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ResponsiveState>(getResponsiveState);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setState(getResponsiveState());
      }, DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return <ResponsiveContext.Provider value={state}>{children}</ResponsiveContext.Provider>;
}
