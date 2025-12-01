import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { login, googleAuth, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for session_id from Google OAuth
    const hash = window.location.hash;
    if (hash && hash.includes('session_id')) {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        handleGoogleCallback(sessionId);
        return;
      }
    }
    
    // If already logged in, redirect
    if (user) {
      checkOnboarding();
    } else {
      setCheckingSession(false);
    }
  }, [user]);

  const handleGoogleCallback = async (sessionId) => {
    try {
      console.log('Processing Google session_id:', sessionId.substring(0, 20) + '...');
      await googleAuth(sessionId);
      console.log('Google auth successful, cleaning URL...');
      // Clean URL
      window.history.replaceState({}, document.title, '/login');
      await checkOnboarding();
    } catch (error) {
      console.error('Google login error:', error);
      toast.error(error.response?.data?.detail || 'Google login failed. Please try again.');
      setCheckingSession(false);
    }
  };

  const checkOnboarding = async () => {
    try {
      const response = await axios.get(`${API_URL}/onboarding/progress`);
      // Step 7 means onboarding is complete (set in Step6 after subscription)
      if (response.data.current_step >= 7) {
        navigate('/dashboard');
      } else {
        navigate(`/onboarding/step-${response.data.current_step}`);
      }
    } catch (error) {
      navigate('/onboarding/step-1');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Login successful!');
      await checkOnboarding();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async () => {
    setLoading(true);
    try {
      // Test login endpoint - only works in preview
      const response = await axios.post(`${API_URL}/auth/test-login`, {
        email: 'ekon75@hotmail.com'
      });
      
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      toast.success('Test login successful!');
      
      // Check onboarding status and navigate
      try {
        const onboardingResponse = await axios.get(`${API_URL}/onboarding/progress`);
        if (onboardingResponse.data.current_step >= 7) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = `/onboarding/step-${onboardingResponse.data.current_step}`;
        }
      } catch (err) {
        window.location.href = '/onboarding/step-1';
      }
    } catch (error) {
      console.error('Test login failed:', error);
      toast.error('Test login not available in production');
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Get Google Client ID from environment variable
    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
    const scope = encodeURIComponent('openid email profile');
    const responseType = 'code';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;
    window.location.href = authUrl;
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-orange-500" />
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Login to continue creating amazing videos</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>Login to Your Account</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="login-email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="login-password-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                data-testid="google-login-btn"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              {/* Test Login - Only for Preview Environment */}
              {(API_URL.includes('localhost') || API_URL.includes('0.0.0.0') || API_URL.includes('emergentagent.com')) ? (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">PREVIEW ONLY</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-green-500 text-green-600 hover:bg-green-50"
                    onClick={handleTestLogin}
                  >
                    🧪 Test Login (Preview Only)
                  </Button>
                </>
              ) : null}
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/register" className="text-brand-orange-500 hover:text-brand-orange-600 font-medium" data-testid="register-link">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
