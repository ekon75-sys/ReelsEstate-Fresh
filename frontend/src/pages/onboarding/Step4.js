import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep4 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState({
    Facebook: false,
    Instagram: false,
    YouTube: false,
    TikTok: false,
    LinkedIn: false,
    Twitter: false
  });

  useEffect(() => {
    loadSocialMedia();
  }, []);

  const loadSocialMedia = async () => {
    try {
      const response = await axios.get(`${API_URL}/social-media`);
      const connections = {};
      response.data.forEach(social => {
        connections[social.platform] = social.connected;
      });
      setConnected(prev => ({ ...prev, ...connections }));
    } catch (error) {
      console.error('Failed to load social media:', error);
    }
  };

  const handleConnect = async (platform) => {
    if (platform === 'Facebook') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/facebook/auth-url`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.href = response.data.auth_url;
      } catch (error) {
        toast.error('Failed to initiate Facebook connection');
      }
    } else if (platform === 'Instagram') {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch Instagram accounts linked to Facebook
        const response = await axios.get(`${API_URL}/instagram/accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const accounts = response.data.instagram_accounts;
        
        if (accounts.length === 0) {
          toast.error('No Instagram Business accounts found. Make sure your Instagram account is linked to a Facebook Page.');
          return;
        }
        
        // If only one account, connect it directly
        if (accounts.length === 1) {
          const account = accounts[0];
          await axios.post(`${API_URL}/instagram/connect`, {
            ig_account_id: account.ig_account_id,
            username: account.username,
            facebook_page_id: account.facebook_page_id,
            page_access_token: account.page_access_token
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          setConnected(prev => ({ ...prev, Instagram: true }));
          toast.success(`Connected @${account.username} successfully!`);
        } else {
          // Multiple accounts - show selection dialog
          toast.info('Multiple Instagram accounts found. Connecting first account...');
          const account = accounts[0];
          await axios.post(`${API_URL}/instagram/connect`, {
            ig_account_id: account.ig_account_id,
            username: account.username,
            facebook_page_id: account.facebook_page_id,
            page_access_token: account.page_access_token
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          setConnected(prev => ({ ...prev, Instagram: true }));
          toast.success(`Connected @${account.username} successfully!`);
        }
      } catch (error) {
        console.error('Instagram connection error:', error);
        toast.error(error.response?.data?.detail || 'Failed to connect Instagram. Make sure Facebook is connected first.');
      }
    } else if (platform === 'YouTube') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/youtube/auth-url`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.href = response.data.auth_url;
      } catch (error) {
        toast.error('Kan YouTube verbinding niet starten');
      }
    } else if (platform === 'TikTok') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/tiktok/auth-url`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.href = response.data.auth_url;
      } catch (error) {
        toast.error('Kan TikTok verbinding niet starten');
      }
    } else if (platform === 'LinkedIn') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/linkedin/auth-url`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.href = response.data.auth_url;
      } catch (error) {
        toast.error('Kan LinkedIn verbinding niet starten');
      }
    } else {
      toast.info(`${platform} integratie komt binnenkort!`);
    }
  };

  const handleDisconnect = async (platform) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/social-media/disconnect`, {
        platform
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setConnected(prev => ({ ...prev, [platform]: false }));
      toast.success(`${platform} disconnected successfully!`);
      
      // Reload connections
      loadSocialMedia();
    } catch (error) {
      toast.error(`Failed to disconnect ${platform}`);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 5,
        completed_steps: {}
      });
      navigate('/onboarding/step-5');
    } catch (error) {
      toast.error('Failed to proceed');
    } finally {
      setLoading(false);
    }
  };

  const platforms = [
    { 
      name: 'Facebook', 
      color: 'bg-blue-600', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ), 
      requiredPlan: 'Professional' 
    },
    { 
      name: 'Instagram', 
      color: 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ), 
      requiredPlan: 'Professional' 
    },
    { 
      name: 'YouTube', 
      color: 'bg-red-600', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ), 
      requiredPlan: 'Enterprise' 
    },
    { 
      name: 'TikTok', 
      color: 'bg-black', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ), 
      requiredPlan: 'Enterprise' 
    },
    { 
      name: 'LinkedIn', 
      color: 'bg-blue-700', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ), 
      requiredPlan: 'Enterprise' 
    },
    { 
      name: 'Twitter', 
      color: 'bg-sky-500', 
      logo: (
        <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ), 
      requiredPlan: 'Enterprise' 
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 4 of 6</span>
            <span className="text-sm text-gray-500">Social Media (Optional)</span>
          </div>
          <Progress value={66.67} className="h-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Connect Social Media</h1>
                <p className="text-gray-600">Link your accounts for direct posting</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              You can skip this step and connect accounts later from settings.
            </p>

            <div className="space-y-4 mb-8">
              {platforms.map(platform => (
                <div key={platform.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center`}>
                      {platform.logo}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{platform.name}</p>
                        <span className="text-xs px-2 py-1 bg-brand-orange-100 text-brand-orange-700 rounded-full">
                          {platform.requiredPlan}+
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {connected[platform.name] ? 'Connected' : `Available during trial • Requires ${platform.requiredPlan} plan`}
                      </p>
                    </div>
                  </div>
                  {connected[platform.name] ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(platform.name)}
                        data-testid={`disconnect-${platform.name.toLowerCase()}-btn`}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(platform.name)}
                      data-testid={`connect-${platform.name.toLowerCase()}-btn`}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>📌 Trial Period:</strong> All social media connections are available during your trial. 
                After trial, Facebook & Instagram require Professional plan, others require Enterprise plan.
              </p>
            </div>

            <Button
              onClick={handleContinue}
              className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
              disabled={loading}
              data-testid="step4-continue-btn"
            >
              Continue to Agent Details
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep4;
