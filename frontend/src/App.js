import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute, { DBAProtectedRoute, AdminProtectedRoute } from './ProtectedRoute';
import Navbar from './components/Navbar';
import SkipToContent from './components/SkipToContent';
import AccessibilityToolbar from './components/AccessibilityToolbar';
import AccessibilityNotification from './components/AccessibilityNotification';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { LanguageProvider } from './contexts/LanguageContext';
import HomePageWithFooter from './pages/HomePage';
import ScrollToTop from './ScrollToTop';
import PhotoGalleryPage from './pages/PhotoGalleryPage';
import VyadeshwarPage from './pages/VyadeshwarPage';
import YogeshwariDeviPage from './pages/YogeshwariDeviPage';
import KulvruttantSamitiPage from './pages/KulvruttantSamitiPage';
import PresidentsThoughtsPage from './pages/PresidentsThoughtsPage';
import ContactPage from './pages/ContactPage';
import LoginRegisterPage from './pages/LoginRegisterPage';
import FamilyRegistrationPage from './pages/FamilyRegistrationPage';
import Dashboard from './pages/UserDashboard';
import { Dashboard as DBADashboard } from './pages/DBA_Dashboard';
import GogteKulAdmin from './pages/Admin';
import Profile from './pages/Profile';
import FamilyTreePage from './pages/FamilyTreePage';
import LoadingSpinner from './components/LoadingSpinner';
import GranthPage from './pages/GranthPage';
import GogteEventsPage from './pages/GogteEvents';
import GogteNewsPage from './pages/GogteNews';
import RemembranceDayPage from './pages/RemembranceDayPage';
import VaatchaalPage from './pages/VaatchaalPage';
import NewsApp from './pages/app';
console.log("React version at runtime:", React.version);

function AppRoutesWithLoader() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setLoading(true);
    setShowContent(false);
    // Always show spinner for at least 600ms, then fade in content
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setShowContent(true), 100); // Small delay for fade transition
    }, 700);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div className="relative min-h-screen">
      <div
        className={`transition-opacity duration-500 ${loading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} fixed inset-0 z-50 flex items-center justify-center bg-white/80`}
        style={{ display: loading ? 'flex' : 'none' }}
      >
        <LoadingSpinner />
      </div>
      <div
        className={`transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}
      >
        <Routes>
          <Route path="/" element={<HomePageWithFooter />} />
          <Route path="/vyadeshwar" element={<VyadeshwarPage />} />
          <Route path="/yogeshwaridevi" element={<YogeshwariDeviPage />} />
          <Route path="/kulavruksh" element={<FamilyTreePage />} />
          <Route path="/kulvruttantsamiti" element={<KulvruttantSamitiPage />} />
          <Route path="/presidentsthoughts" element={<PresidentsThoughtsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginRegisterPage />} />
          <Route path="/register" element={<FamilyRegistrationPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<DBAProtectedRoute />}>
            <Route path="/dba-dashboard" element={<DBADashboard />} />
            <Route path="/dashboard" element={<DBADashboard />} />
            <Route path="/profile" element={<DBADashboard />} />
          </Route>
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin-dashboard" element={<GogteKulAdmin />} />
            <Route path="/dashboard" element={<GogteKulAdmin />} />
            <Route path="/profile" element={<GogteKulAdmin />} />
          </Route>
          <Route path="/photo-gallery" element={<PhotoGalleryPage />} />
          <Route path="/granth" element={<GranthPage />} />
          <Route path="/gogte-events" element={<GogteEventsPage />} />
          <Route path="/gogte-news" element={<GogteNewsPage />} />
          <Route path="/news-app" element={<NewsApp />} />
          <Route path="/remembrance-day" element={<RemembranceDayPage />} />
          <Route path="/gogte-vaatchaal" element={<VaatchaalPage />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundImage: "url('/background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/40 z-0"></div>
      
      <AccessibilityProvider>
        <LanguageProvider>
          <Router>
            <ScrollToTop />
            <SkipToContent />
            <Navbar />
            <main id="main-content">
              <AppRoutesWithLoader />
            </main>
            <KeyboardShortcuts />
            <AccessibilityNotification />
            <AccessibilityToolbar />
            {/* Prevent caching of protected pages to avoid back button showing them after logout */}
            <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </Router>
        </LanguageProvider>
      </AccessibilityProvider>
    </div>
  );
}

export default App;