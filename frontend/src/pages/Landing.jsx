import { Link } from "react-router-dom";
import "./landing.css";
import { ArrowRightIcon, HeartIcon, PaletteIcon, PersonIcon, SearchIcon, YarnBallIcon } from "./landingIcons";

/**
 * The site's home route ("/"). Not linked FROM the app's own
 * Finder/Vendors/Admin navigation, but "Get Start" leads into the real
 * app at /app. "Login" leads to /app/admin, which is gated behind the
 * client-side admin login screen.
 */
export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp__nav">
        <div className="lp__brand">
          <YarnBallIcon />
          Thread Color Finder
        </div>
        <Link className="lp__login" to="/app/admin">
          Login
          <PersonIcon />
        </Link>
      </nav>

      <div className="lp__hero">
        <span className="lp__chip lp__chip--1">
          <span className="lp__chip-dot" style={{ background: "#cdf5fd" }} />
          #A0E9FF
        </span>
        <span className="lp__chip lp__chip--label lp__chip--2">Gray</span>
        <span className="lp__chip lp__chip--3">
          <span className="lp__chip-dot" style={{ background: "#116af8" }} />
          #116AF8
        </span>
        <span className="lp__chip lp__chip--4">
          <span className="lp__chip-dot" style={{ background: "#cdf5fd" }} />
          #CDF5FD
        </span>
        <span className="lp__chip lp__chip--5">
          <span className="lp__chip-dot" style={{ background: "#20bced" }} />
          #20BCED
        </span>
        <span className="lp__chip lp__chip--6">
          <span className="lp__chip-dot" style={{ background: "#020d33" }} />
          #020D33
        </span>
        <span className="lp__chip lp__chip--dark lp__chip--7">Dark</span>

        <div className="lp__hero-content">
          <h1>
            Thread
            <br />
            Color
            <br />
            Finder
          </h1>
          <p>Find and match the perfect thread color for your designs.</p>
          <Link className="lp__cta" to="/app">
            Get Start <ArrowRightIcon />
          </Link>
        </div>
      </div>

      <div className="lp__features">
        <Link className="lp__feature" to="/app">
          <span className="lp__feature-icon">
            <SearchIcon />
          </span>
          <span>
            <span className="lp__feature-title">Smart Search</span>
            <br />
            <span className="lp__feature-sub">Find the right shade instantly.</span>
          </span>
        </Link>
        <Link className="lp__feature" to="/app/vendors">
          <span className="lp__feature-icon">
            <PaletteIcon />
          </span>
          <span>
            <span className="lp__feature-title">Wide Palette</span>
            <br />
            <span className="lp__feature-sub">Thousands of thread colors.</span>
          </span>
        </Link>
        <Link className="lp__feature" to="/app">
          <span className="lp__feature-icon">
            <HeartIcon />
          </span>
          <span>
            <span className="lp__feature-title">Perfect Match</span>
            <br />
            <span className="lp__feature-sub">Accurate results every time.</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
