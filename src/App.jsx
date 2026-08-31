import { Link, NavLink, Route, Routes } from "react-router-dom";
import Finder from "./pages/Finder";
import Vendors from "./pages/Vendors";
import Admin from "./pages/Admin";

function navClass({ isActive }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

export default function App() {
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
          <NavLink to="/app/admin" className={navClass}>
            Admin
          </NavLink>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="" element={<Finder />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Finder />} />
        </Routes>
      </main>
    </div>
  );
}
