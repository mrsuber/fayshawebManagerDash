import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ViewAsBanner from './admin/components/ViewAsBanner';

// Public website (src/site)
import SiteLayout from './site/SiteLayout';
import Home from './site/pages/Home';
import Residences from './site/pages/Residences';
import Residence from './site/pages/Residence';
import Book from './site/pages/Book';
import Wellness from './site/pages/Wellness';
import About from './site/pages/About';
import Contact from './site/pages/Contact';
import Careers from './site/pages/Careers';
import Feedback from './site/pages/Feedback';
import LegacyApartment from './site/pages/LegacyApartment';
import { Privacy, Terms } from './site/pages/Legal';
import { ForgotPassword, Login, NotFound, ResetPassword } from './site/pages/Account';

// Faysha HQ — the super administrator dashboard (src/admin), its own bundle, loaded only at /admin.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const ChangePassword = lazy(() => import('./pages/admin/ChangePassword'));

// Manager dashboard (FAY OS): its own bundle, loaded only when someone opens /manager.
const ManagerApp = lazy(() => import('./manager/ManagerApp'));
const managerMocks = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_USE_MOCKS === 'true';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Mandatory password change on first sign-in */}
          <Route
            path="/admin/change-password-required"
            element={
              <ProtectedRoute allowPasswordChange>
                <Suspense fallback={null}>
                  <ChangePassword />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Manager dashboard — managers and super administrators */}
          <Route
            path="/manager/*"
            element={
              managerMocks ? (
                <Suspense fallback={null}>
                  <ManagerApp />
                </Suspense>
              ) : (
                <ProtectedRoute requiredRole="manager">
                  <Suspense fallback={null}>
                    <ManagerApp />
                  </Suspense>
                </ProtectedRoute>
              )
            }
          />

          {/* Faysha HQ — super administrators and any role granted an HQ area */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={null}>
                  <AdminApp />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Public website */}
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="residences" element={<Residences />} />
            <Route path="residences/:id" element={<Residence />} />
            <Route path="book" element={<Book />} />
            <Route path="wellness" element={<Wellness />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="careers" element={<Careers />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="login" element={<Login />} />
            <Route path="admin/login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />

            {/* v1 addresses (emails, bookmarks, search results) */}
            <Route path="booking" element={<Navigate to="/residences" replace />} />
            <Route path="amenities" element={<Navigate to="/wellness" replace />} />
            <Route path="apartments/:id" element={<LegacyApartment />} />
            <Route path="terms-of-service" element={<Navigate to="/terms" replace />} />
            <Route path="privacy-policy" element={<Navigate to="/privacy" replace />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        <ViewAsBanner />
      </Router>
    </AuthProvider>
  );
}

export default App;
