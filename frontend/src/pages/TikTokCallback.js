import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const TikTokCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('TikTok verbinding geannuleerd of mislukt');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    if (!code) {
      setError('Geen autorisatiecode ontvangen');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    const connectTikTok = async () => {
      try {
        const response = await axios.post(`${API_URL}/tiktok/callback`, null, {
          params: { code, state }
        });
        
        const user = response.data.user || {};
        if (user.display_name) {
          toast.success(`TikTok verbonden! Welkom ${user.display_name}`);
        } else {
          toast.success('TikTok succesvol verbonden!');
        }
        navigate('/onboarding/step-4');
      } catch (err) {
        setError(err.response?.data?.detail || 'TikTok verbinding mislukt');
        setTimeout(() => navigate('/onboarding/step-4'), 3000);
      }
    };

    connectTikTok();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-xl font-semibold">TikTok verbinden...</p>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default TikTokCallback;
