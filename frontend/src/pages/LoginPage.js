import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUserData } = useAuth();

  useEffect(() => {
    // Check for session_id in URL fragment (from Emergent Auth)
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      processEmergentAuth(hash);
      return;
    }
    
    // Check if user is already logged in
    checkAuth();
  }, []);

  const processEmergentAuth = async (hash) => {
    setProcessingOAuth(true);
    try {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      
      if (!sessionId) {
        console.error('No session_id found in URL');
        setCheckingSession(false);
        setProcessingOAuth(false);
        return;
      }

      console.log('Processing Emergent Auth session_id...');

      // Send session_id to backend - backend will call Emergent Auth API (avoids CORS)
      const backendResponse = await axios.post(
        `${API_URL}/auth/emergent-callback`,
        {
          session_id: sessionId
        },
        {
          withCredentials: true
        }
      );

      console.log('Session processed by backend');
      
      // Update auth context
      const user = backendResponse.data.user;
      setUserData(user);

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Redirect based on onboarding status
      const onboardingStep = user.onboarding_step || 0;
      if (onboardingStep < 6) {
        navigate(`/onboarding/step-${onboardingStep + 1}`);
      } else {
        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Emergent Auth error:', error);
      toast.error('Login failed. Please try again.');
      // Clean URL on error
      window.history.replaceState({}, document.title, window.location.pathname);
      setCheckingSession(false);
      setProcessingOAuth(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        withCredentials: true
      });
      if (response.data && response.data.user_id) {
        setUserData(response.data);
        // User is logged in, redirect based on onboarding status
        const onboardingStep = response.data.onboarding_step || 0;
        if (onboardingStep < 6) {
          navigate(`/onboarding/step-${onboardingStep + 1}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      // Not logged in, show login page
      console.log('Not authenticated, showing login page');
    } finally {
      setCheckingSession(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      }, {
        withCredentials: true
      });
      
      setUserData(response.data.user);
      toast.success('Successfully logged in!');
      
      const onboardingStep = response.data.user.onboarding_step || 0;
      if (onboardingStep < 6) {
        navigate(`/onboarding/step-${onboardingStep + 1}`);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleLogin = () => {
    setLoading(true);
    // Use Emergent Auth - redirect URL must be dynamic based on current origin
    const redirectUrl = window.location.origin + '/login';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (checkingSession || processingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">{processingOAuth ? 'Completing sign in...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="ReelsEstate Logo" className="w-12 h-12 object-contain" />
            <span className="text-3xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
              ReelsEstate
            </span>
          </Link>
          <p className="text-gray-600">Create stunning real estate videos</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to continue to ReelsEstate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Google Login Button */}
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={handleGoogleLogin}
              disabled={loading}
              data-testid="google-login-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Login Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-brand-orange-500 hover:bg-brand-orange-600"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </Button>
            </form>

            <div className="text-center text-sm text-gray-500 pt-4">
              <p>By signing in, you agree to our</p>
              <p>
                <Link to="/terms-of-service" className="text-brand-orange-600 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy-policy" className="text-brand-orange-600 hover:underline">Privacy Policy</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-orange-600 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
