import { useEffect, useRef } from 'react';
import './LandingPage.css';

/**
 * Marketing landing page for Tiny Toybox.
 * Renders a playful, storybook-style page with floating toy shapes,
 * feature highlights, world previews, safe-space trust banner, and a CTA
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
            A magical 3D playground where children explore four toybox worlds, discover friendly animals, create art, and play twelve delightful mini-games
            &mdash; all inside the browser, no downloads needed.
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
              <div className="landing-feature-name">Four Unique Worlds</div>
              <div className="landing-feature-desc">
                Adventure, Animals, Creative, and Nature &mdash; each a handcrafted 3D diorama filled with surprises, hidden interactions, and friendly
                characters.
              </div>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#127918;</div>
              <div className="landing-feature-name">12 Mini-Games</div>
              <div className="landing-feature-desc">
                Pop bubbles, race balloons, feed animals, catch fireflies, build shapes, and more. No fail states, no timers &mdash; just pure playful joy.
              </div>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">&#128155;</div>
              <div className="landing-feature-name">No Fail States</div>
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
          <h2 className="landing-safe-title">A Safe Space for Kids</h2>
          <p className="landing-safe-subtitle">Tiny Toybox is built with one rule: children come first.</p>
          <div className="landing-safe-grid">
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128683;</span>
              <span className="landing-safe-label">No Ads. Ever.</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128373;&#65039;</span>
              <span className="landing-safe-label">No Tracking</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128274;</span>
              <span className="landing-safe-label">No Data Collection</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128587;</span>
              <span className="landing-safe-label">No Accounts</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#127850;</span>
              <span className="landing-safe-label">No Cookies</span>
            </div>
            <div className="landing-safe-item">
              <span className="landing-safe-icon">&#128247;</span>
              <span className="landing-safe-label">No Camera or Mic</span>
            </div>
          </div>
          <p className="landing-safe-note">
            Nothing is stored on the device. No sign-ups, no emails, no in-app purchases.
            <br />
            Close the tab and it&rsquo;s gone &mdash; exactly how children&rsquo;s apps should work.
          </p>
          <p className="landing-safe-parental">
            &#9888;&#65039; Tiny Toybox is designed to be enjoyed together &mdash; always play with a parent or guardian present.
          </p>
        </div>
      </section>

      {/* ── Worlds ───────────────────────────────── */}
      <section className="landing-worlds">
        <div ref={worldsRef} className="landing-reveal">
          <h2 className="landing-worlds-title">Four Worlds to Explore</h2>
          <div className="landing-worlds-grid">
            <div className="landing-world-card">
              <span className="landing-world-emoji">&#9968;&#65039;</span>
              <div className="landing-world-name">Adventure</div>
              <div className="landing-world-desc">Sail ships, race trucks, and launch balloons across rugged terrain</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#128062;</span>
              <div className="landing-world-name">Animals</div>
              <div className="landing-world-desc">Feed bunnies, play fetch with puppies, and splash with elephants</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#127912;</span>
              <div className="landing-world-name">Creative</div>
              <div className="landing-world-desc">Squish clay, pop bubbles, match colors, and build shapes from scratch</div>
            </div>

            <div className="landing-world-card">
              <span className="landing-world-emoji">&#127807;</span>
              <div className="landing-world-name">Nature</div>
              <div className="landing-world-desc">Catch fireflies in the meadow and swim with friendly baby sharks</div>
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
