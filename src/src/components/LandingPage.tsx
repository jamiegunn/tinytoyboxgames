import { useEffect, useRef } from 'react';
import './LandingPage.css';

/**
 * Marketing landing page for Tiny Toybox.
 * Renders a playful, storybook-style page with floating toy shapes,
 * feature highlights, scene previews, safe-space trust banner, and a CTA
 * that links to the playroom.
 *
 * @returns The full landing page React element.
 */
export function LandingPage() {
  const featuresRef = useRef<HTMLDivElement>(null);
  const worldsRef = useRef<HTMLDivElement>(null);
  const bottomCtaRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for scroll-triggered reveals
  useEffect(() => {
    const targets = [featuresRef.current, worldsRef.current, bottomCtaRef.current].filter(Boolean) as HTMLElement[];
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-reveal--visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root">
      {/* ── Hero ─────────────────────────────────── */}
      <section className="landing-hero">
        {/* Floating CSS toy shapes */}
        <div className="landing-shapes">
          <div className="landing-shape landing-shape--star" />
          <div className="landing-shape landing-shape--circle1" />
          <div className="landing-shape landing-shape--triangle" />
          <div className="landing-shape landing-shape--circle2" />
          <div className="landing-shape landing-shape--square" />
          <div className="landing-shape landing-shape--diamond" />
          <div className="landing-shape landing-shape--dot1" />
          <div className="landing-shape landing-shape--dot2" />
          <div className="landing-shape landing-shape--dot3" />
        </div>

        <div className="landing-hero-content">
          <span className="landing-badge">Ages 3 &ndash; 6</span>

          <h1 className="landing-title">
            Tiny
            <br />
            Toybox
          </h1>

          <p className="landing-subtitle">Where every tap sparks wonder</p>

          <p className="landing-description">
            A magical 3D toybox playground in the browser. Explore the Playroom, open active toyboxes into Nature and Pirate Cove, and try the mini-games
            included in the current build &mdash; no install required.
          </p>

          <a href="/#/playroom" className="landing-cta">
            Open the Toybox <span className="landing-cta-arrow">&rarr;</span>
          </a>

          <p className="landing-parent-note">&#128104;&#8205;&#128103; Designed for play with a parent or guardian</p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section className="landing-features">
        <div ref={featuresRef} className="landing-reveal">
          <h2 className="landing-features-title">Built for Little Explorers</h2>
          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#127912;</div>
              <div className="landing-feature-name">Tap-Friendly Design</div>
              <div className="landing-feature-desc">
                Every surface responds to touch. No reading required &mdash; icons and animations guide the way. Designed so even 3-year-olds can play
                independently.
              </div>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#127760;</div>
              <div className="landing-feature-name">Playable Scenes Today</div>
              <div className="landing-feature-desc">
                The current build includes Playroom and Kitchen landing scenes, plus Nature and Pirate Cove toybox scenes &mdash; each a handcrafted 3D diorama
                filled with surprises and friendly characters.
              </div>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#127918;</div>
              <div className="landing-feature-name">Mini-Games in the Build</div>
              <div className="landing-feature-desc">
                Pop bubbles, catch fireflies, swim with friendly sharks, and fire cannonballs. More mini-games are planned as the toybox grows.
              </div>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#128155;</div>
              <div className="landing-feature-name">No-Fail Play</div>
              <div className="landing-feature-desc">
                No timers, no punishment, no game-over screens. Every interaction is positive. Children play at their own pace with gentle encouragement.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Safe Space Trust Banner ────────────────── */}
      <section className="landing-safe">
        <div className="landing-safe-inner">
          <div className="landing-safe-shield">&#128737;&#65039;</div>
          <h2 className="landing-safe-title">A Gentle Browser Play Space</h2>
          <p className="landing-safe-subtitle">
            Tiny Toybox is built as a browser-first play experience with no install required and no browser persistence in the app runtime.
          </p>
          <div className="landing-safe-grid">
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128683;</span>
              <span className="landing-safe-label">No Ads</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128274;</span>
              <span className="landing-safe-label">No Browser Persistence</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128587;</span>
              <span className="landing-safe-label">No Accounts</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128230;</span>
              <span className="landing-safe-label">No Install Required</span>
            </div>
          </div>
          <p className="landing-safe-note">
            The app runtime blocks localStorage, sessionStorage, cookies, and IndexedDB before the page loads.
            <br />
            Close the tab and it&rsquo;s gone &mdash; play is memory-only.
          </p>
          <p className="landing-safe-parental">
            &#9888;&#65039; Tiny Toybox is designed to be enjoyed together &mdash; always play with a parent or guardian present.
          </p>
        </div>
      </section>

      {/* ── Scenes ───────────────────────────────── */}
      <section className="landing-worlds">
        <div ref={worldsRef} className="landing-reveal">
          <h2 className="landing-worlds-title">Scenes in the Current Build</h2>
          <div className="landing-worlds-grid">
            <div className="landing-world-card">
              <span className="landing-world-emoji">&#127968;</span>
              <div className="landing-world-name">Playroom</div>
              <div className="landing-world-desc">A cozy landing scene with active toyboxes that open into Nature and Pirate Cove</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#127859;</span>
              <div className="landing-world-name">Kitchen</div>
              <div className="landing-world-desc">A second landing scene with a toybox leading to Nature</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#127807;</span>
              <div className="landing-world-name">Nature</div>
              <div className="landing-world-desc">A forest-floor toybox world with Bubble Pop, Fireflies, and Little Shark mini-game portals</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#9968;&#65039;</span>
              <div className="landing-world-name">Pirate Cove</div>
              <div className="landing-world-desc">A pirate ship toybox world with Cannonball Splash</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────── */}
      <section className="landing-bottom-cta">
        <div ref={bottomCtaRef} className="landing-reveal">
          <p className="landing-bottom-cta-text">Ready to play? No sign-up, no download, no waiting.</p>
          <a href="/#/playroom" className="landing-cta">
            Open the Toybox <span className="landing-cta-arrow">&rarr;</span>
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="landing-footer">
        Made with <span className="landing-footer-hearts">&hearts;</span> for curious kids everywhere
      </footer>
    </div>
  );
}
