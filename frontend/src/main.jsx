import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Landing from './pages/Landing.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* The marketing page is the site's home route. "Get Start" and
            the nav Login lead into the real app under /app. */}
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<App />} />
        {/* /landing was the old home path before this became "/" —
            redirect it (and anything else unmatched) home instead of
            rendering a blank page for stale links/bookmarks. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
