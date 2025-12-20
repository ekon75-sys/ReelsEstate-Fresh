import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Get session_id from URL fragment
        const hash = window.location.hash;
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];

        if (!sessionId) {
          console.error('No session_id found in URL');
          navigate('/login');
          return;
        }

        console.log('Processing session_id...');

        // Exchange session_id for user data via Emergent Auth
        const authResponse = await axios.get(
          'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
          {
            headers: {
              'X-Session-ID': sessionId
            }
          }
        );

        const userData = authResponse.data;
        console.log('Got user data from Emergent Auth');

        // Send to our backend to create/update user and session
        const backendResponse = await axios.post(
          `${API_URL}/auth/emergent-session`,
          {
            user_id: userData.id,
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            session_token: userData.session_token
          },
          {
            withCredentials: true
          }
        );

        console.log('Session stored in backend');

        // Clean URL and redirect to dashboard
        window.history.replaceState({}, document.title, '/dashboard');

        // Check onboarding status and redirect
        const user = backendResponse.data.user;
        const onboardingStep = user.onboarding_step || 0;

        if (onboardingStep < 6) {
          navigate(`/onboarding/step-${onboardingStep + 1}`, { state: { user } });
        } else {
          navigate('/dashboard', { state: { user } });
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login');
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
