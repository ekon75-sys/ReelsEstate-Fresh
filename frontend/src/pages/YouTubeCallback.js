import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const YouTubeCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('YouTube verbinding geannuleerd of mislukt');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    if (!code) {
      setError('Geen autorisatiecode ontvangen');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    const connectYouTube = async () => {
      try {
        const response = await axios.post(`${API_URL}/youtube/callback`, null, {
          params: { code, state }
        });
        
        const channels = response.data.channels || [];
        if (channels.length > 0) {
          toast.success(`YouTube verbonden! ${channels.length} kanaal/kanalen gevonden.`);
        } else {
          toast.success('YouTube verbonden!');
        }
        navigate('/onboarding/step-4');
      } catch (err) {
        setError(err.response?.data?.detail || 'YouTube verbinding mislukt');
        setTimeout(() => navigate('/onboarding/step-4'), 3000);
      }
    };

    connectYouTube();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-xl font-semibold">YouTube verbinden...</p>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default YouTubeCallback;
