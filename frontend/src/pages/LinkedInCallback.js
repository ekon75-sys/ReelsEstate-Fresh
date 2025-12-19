import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LinkedInCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('LinkedIn verbinding geannuleerd of mislukt');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    if (!code) {
      setError('Geen autorisatiecode ontvangen');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    const connectLinkedIn = async () => {
      try {
        const response = await axios.post(`${API_URL}/linkedin/callback`, null, {
          params: { code, state }
        });
        
        const profile = response.data.profile || {};
        if (profile.name) {
          toast.success(`LinkedIn verbonden! Welkom ${profile.name}`);
        } else {
          toast.success('LinkedIn succesvol verbonden!');
        }
        navigate('/onboarding/step-4');
      } catch (err) {
        setError(err.response?.data?.detail || 'LinkedIn verbinding mislukt');
        setTimeout(() => navigate('/onboarding/step-4'), 3000);
      }
    };

    connectLinkedIn();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-xl font-semibold">LinkedIn verbinden...</p>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default LinkedInCallback;
