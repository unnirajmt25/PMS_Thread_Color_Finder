import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import Finder from "./pages/Finder";
import Vendors from "./pages/Vendors";
import ColorPicker from "./pages/ColorPicker";
import Admin from "./pages/Admin";
import StandardColorsModal from "./components/StandardColorsModal";

function navClass({ isActive }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

export default function App() {
  const [showStandardColors, setShowStandardColors] = useState(false);

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/app" className="app-nav__brand">
          Thread Color Finder
        </Link>
        <div className="app-nav__links">
          <NavLink to="/app" end className={navClass}>
            Finder
          </NavLink>
          <NavLink to="/app/vendors" className={navClass}>
            Vendors
          </NavLink>
          <NavLink to="/app/color-picker" className={navClass}>
            Color Explorer
          </NavLink>
          <button type="button" className="nav-link" onClick={() => setShowStandardColors(true)}>
            Standard PMS
          </button>
        </div>
        <div className="app-nav__admin">
          <NavLink to="/app/admin" className={navClass}>
            Admin
          </NavLink>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="" element={<Finder />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="color-picker" element={<ColorPicker />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Finder />} />
        </Routes>
      </main>

      {showStandardColors && <StandardColorsModal onClose={() => setShowStandardColors(false)} />}
    </div>
  );
}
