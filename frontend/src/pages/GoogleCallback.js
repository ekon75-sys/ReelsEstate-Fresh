import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');

        if (errorParam) {
          throw new Error(`Google OAuth error: ${errorParam}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Exchange code for tokens via backend
        const response = await axios.post(`${API_URL}/auth/google/callback`, {
          code,
          redirect_uri: `${window.location.origin}/auth/google/callback`
        });

        // Store token
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

        toast.success('Successfully logged in with Google!');
        
        // Check if user needs onboarding
        const user = response.data.user;
        const onboardingStep = user.onboarding_step || 0;
        
        // Redirect based on onboarding status
        if (onboardingStep === 0 || onboardingStep < 6) {
          window.location.href = `/onboarding/step-${onboardingStep + 1}`;
        } else {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Google callback error:', error);
        setError(error.message);
        toast.error('Failed to complete Google login');
        
        // Redirect back to login after a delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">{error}</div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      <Loader2 className="w-12 h-12 animate-spin text-brand-orange-500 mb-4" />
      <p className="text-gray-600">Completing Google login...</p>
    </div>
  );
};

export default GoogleCallback;
