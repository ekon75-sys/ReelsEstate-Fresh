import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

// Pages
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import GoogleCallback from '@/pages/GoogleCallback';
import FacebookCallback from '@/pages/FacebookCallback';
import DashboardPage from '@/pages/DashboardPage';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import OnboardingStep1 from '@/pages/onboarding/Step1';
import OnboardingStep2 from '@/pages/onboarding/Step2';
import OnboardingStep3 from '@/pages/onboarding/Step3';
import OnboardingStep4 from '@/pages/onboarding/Step4';
import OnboardingStep5 from '@/pages/onboarding/Step5';
import OnboardingStep6 from '@/pages/onboarding/Step6';
import SettingsLayout from '@/pages/settings/SettingsLayout';
import BusinessSettings from '@/pages/settings/Business';
import BrandingSettings from '@/pages/settings/Branding';
import AgentsSettings from '@/pages/settings/Agents';
import SocialMediaSettings from '@/pages/settings/SocialMedia';
import BillingSettings from '@/pages/settings/Billing';
import SubscriptionSettings from '@/pages/settings/Subscription';
import ProtectedRoute from '@/components/ProtectedRoute';

// Project Pages
import ProjectsListPage from '@/pages/ProjectsListPage';
import CreateProject from '@/pages/projects/CreateProject';
import PhotoUpload from '@/pages/projects/PhotoUpload';
import PremiumEditing from '@/pages/projects/PremiumEditing';
import MusicSelection from '@/pages/projects/MusicSelection';
import ConfigureProject from '@/pages/projects/ConfigureProject';
import GenerateVideo from '@/pages/projects/GenerateVideo';
import PhotoEnhancementPage from '@/pages/PhotoEnhancementPage';
import AdminPanel from '@/pages/AdminPanel';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route path="/auth/facebook/callback" element={<FacebookCallback />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          
          {/* Protected Onboarding Routes */}
          <Route path="/onboarding/step-1" element={<ProtectedRoute><OnboardingStep1 /></ProtectedRoute>} />
          <Route path="/onboarding/step-2" element={<ProtectedRoute><OnboardingStep2 /></ProtectedRoute>} />
          <Route path="/onboarding/step-3" element={<ProtectedRoute><OnboardingStep3 /></ProtectedRoute>} />
          <Route path="/onboarding/step-4" element={<ProtectedRoute><OnboardingStep4 /></ProtectedRoute>} />
          <Route path="/onboarding/step-5" element={<ProtectedRoute><OnboardingStep5 /></ProtectedRoute>} />
          <Route path="/onboarding/step-6" element={<ProtectedRoute><OnboardingStep6 /></ProtectedRoute>} />
          
          {/* Protected Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsListPage /></ProtectedRoute>} />
          <Route path="/photo-enhancement" element={<ProtectedRoute><PhotoEnhancementPage /></ProtectedRoute>} />
          
          {/* Protected Project Routes */}
          <Route path="/projects/create" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
          <Route path="/projects/:projectId/photos" element={<ProtectedRoute><PhotoUpload /></ProtectedRoute>} />
          <Route path="/projects/:projectId/premium" element={<ProtectedRoute><PremiumEditing /></ProtectedRoute>} />
          <Route path="/projects/:projectId/music" element={<ProtectedRoute><MusicSelection /></ProtectedRoute>} />
          <Route path="/projects/:projectId/configure" element={<ProtectedRoute><ConfigureProject /></ProtectedRoute>} />
          <Route path="/projects/:projectId/generate" element={<ProtectedRoute><GenerateVideo /></ProtectedRoute>} />
          
          {/* Protected Settings */}
          <Route path="/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/settings/business" replace />} />
            <Route path="business" element={<BusinessSettings />} />
            <Route path="branding" element={<BrandingSettings />} />
            <Route path="agents" element={<AgentsSettings />} />
            <Route path="social-media" element={<SocialMediaSettings />} />
            <Route path="billing" element={<BillingSettings />} />
            <Route path="subscription" element={<SubscriptionSettings />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
