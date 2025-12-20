import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking, success, error
  const [planName, setPlanName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const urlStatus = searchParams.get('status');
    
    if (urlStatus === 'cancelled') {
      setStatus('cancelled');
      return;
    }
    
    if (sessionId) {
      checkPaymentStatus(sessionId);
    } else {
      setStatus('error');
      setError('No session ID found');
    }
  }, [searchParams]);

  const checkPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    
    if (attempts >= maxAttempts) {
      setStatus('error');
      setError('Payment verification timed out. Please contact support.');
      return;
    }

    try {
      // This endpoint works without authentication
      const response = await axios.get(`${API_URL}/stripe/checkout-status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        setPlanName(response.data.plan_name);
      } else if (response.data.status === 'expired') {
        setStatus('error');
        setError('Payment session expired. Please try again.');
      } else {
        // Continue polling
        setTimeout(() => checkPaymentStatus(sessionId, attempts + 1), 2000);
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      // Retry on error
      if (attempts < maxAttempts - 1) {
        setTimeout(() => checkPaymentStatus(sessionId, attempts + 1), 2000);
      } else {
        setStatus('error');
        setError('Error checking payment status. Please contact support.');
      }
    }
  };

  const handleContinue = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="pt-8 pb-8 px-8 text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="w-16 h-16 animate-spin text-brand-orange-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Verifying Payment...
              </h1>
              <p className="text-gray-600">
                Please wait while we confirm your payment with Stripe.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Payment Successful! 🎉
              </h1>
              <p className="text-gray-600 mb-6">
                Your subscription to <strong>{planName}</strong> has been activated.
              </p>
              <Button 
                onClick={handleContinue}
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
              >
                Continue to App
              </Button>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Payment Cancelled
              </h1>
              <p className="text-gray-600 mb-6">
                Your payment was cancelled. No charges were made.
              </p>
              <Button 
                onClick={handleContinue}
                variant="outline"
                className="w-full"
              >
                Return to App
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Something Went Wrong
              </h1>
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              <Button 
                onClick={handleContinue}
                variant="outline"
                className="w-full"
              >
                Return to App
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
