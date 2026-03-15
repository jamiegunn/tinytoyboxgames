import './NotFoundPage.css';

/**
 * Renders a friendly 404 page with a toybox theme.
 * Shown when the URL hash contains an unrecognized route.
 * Provides a link back to the landing page.
 *
 * @returns A styled 404 page React element.
 */
export function NotFoundPage() {
  return (
    <div className="notfound-root">
      {/* Background shapes */}
      <div className="notfound-shapes">
        <div className="notfound-shape notfound-shape--1" />
        <div className="notfound-shape notfound-shape--2" />
        <div className="notfound-shape notfound-shape--3" />
        <div className="notfound-shape notfound-shape--4" />
      </div>

      <div className="notfound-content">
        {/* Sad toybox illustration */}
        <div className="notfound-illustration">
          <div className="notfound-question">?</div>
          <div className="notfound-lid" />
          <div className="notfound-box" />
        </div>

        <div className="notfound-code">404</div>
        <h1 className="notfound-heading">This toy went missing!</h1>
        <p className="notfound-message">We looked in every toybox but couldn&rsquo;t find this page. Let&rsquo;s head back to where the fun is.</p>
        <a href="/" className="notfound-home-link">
          Back to Tiny Toybox &#x2190;
        </a>
      </div>
    </div>
  );
}
