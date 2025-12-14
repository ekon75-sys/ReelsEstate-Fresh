import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const FacebookCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Facebook connection cancelled or failed`);
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      setTimeout(() => navigate('/onboarding/step-4'), 3000);
      return;
    }

    const connectFacebook = async () => {
      try {
        await axios.post(`${API_URL}/facebook/callback`, null, {
          params: { code, state }
        });
        
        toast.success('Facebook connected successfully!');
        navigate('/onboarding/step-4');
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to connect Facebook');
        setTimeout(() => navigate('/onboarding/step-4'), 3000);
      }
    };

    connectFacebook();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-xl font-semibold">Connecting Facebook...</p>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default FacebookCallback;
