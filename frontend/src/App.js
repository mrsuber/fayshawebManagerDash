import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

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

// Super administrator dashboard (v1 pages, kept until the new boss dashboard replaces them).
// Lazy-loaded so visitors to the public site never download it.
const ChangePassword = lazy(() => import('./pages/admin/ChangePassword'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const PageManagement = lazy(() => import('./pages/admin/PageManagement'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const ApartmentCategories = lazy(() => import('./pages/admin/ApartmentCategories'));
const Apartments = lazy(() => import('./pages/admin/Apartments'));
const Bookings = lazy(() => import('./pages/admin/Bookings'));
const DepositBoxManagement = lazy(() => import('./pages/admin/DepositBoxManagement'));
const Payments = lazy(() => import('./pages/admin/Payments'));
const AvailabilityCalendar = lazy(() => import('./pages/admin/AvailabilityCalendar'));
const FeedbackManagement = lazy(() => import('./pages/admin/FeedbackManagement'));
const Jobs = lazy(() => import('./pages/admin/hr/Jobs'));
const Applications = lazy(() => import('./pages/admin/hr/Applications'));
const Employees = lazy(() => import('./pages/admin/hr/Employees'));
const Attendance = lazy(() => import('./pages/admin/hr/Attendance'));
const Leave = lazy(() => import('./pages/admin/hr/Leave'));
const WellnessActivities = lazy(() => import('./pages/admin/WellnessActivities'));
const WellnessZones = lazy(() => import('./pages/admin/WellnessZones'));
const WellnessBookings = lazy(() => import('./pages/admin/WellnessBookings'));
const WellnessAvailability = lazy(() => import('./pages/admin/WellnessAvailability'));
const WellnessConcierge = lazy(() => import('./pages/admin/WellnessConcierge'));
const WellnessMetrics = lazy(() => import('./pages/admin/WellnessMetrics'));
const GuestManagement = lazy(() => import('./pages/admin/GuestManagement'));

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

          {/* Super administrator dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={null}>
                  <AdminLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="guests" element={<GuestManagement />} />
            <Route path="pages" element={<PageManagement />} />
            <Route path="categories" element={<ApartmentCategories />} />
            <Route path="apartments" element={<Apartments />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="deposit-boxes" element={<DepositBoxManagement />} />
            <Route path="calendar" element={<AvailabilityCalendar />} />
            <Route path="payments" element={<Payments />} />
            <Route path="feedback" element={<FeedbackManagement />} />
            <Route path="hr/jobs" element={<Jobs />} />
            <Route path="hr/applications" element={<Applications />} />
            <Route path="hr/employees" element={<Employees />} />
            <Route path="hr/attendance" element={<Attendance />} />
            <Route path="hr/leave" element={<Leave />} />
            <Route path="wellness/dashboard" element={<WellnessMetrics />} />
            <Route path="wellness/activities" element={<WellnessActivities />} />
            <Route path="wellness/zones" element={<WellnessZones />} />
            <Route path="wellness/bookings" element={<WellnessBookings />} />
            <Route path="wellness/availability" element={<WellnessAvailability />} />
            <Route path="wellness/concierge" element={<WellnessConcierge />} />
            <Route path="settings" element={<Navigate to="/manager/settings" replace />} />
          </Route>

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
      </Router>
    </AuthProvider>
  );
}

export default App;
