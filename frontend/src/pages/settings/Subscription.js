import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, CreditCard, Crown } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const SubscriptionSettings = () => {
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadPlans();
    
    // Check if returning from Stripe
    const sessionId = searchParams.get('session_id');
    const status = searchParams.get('status');
    
    if (sessionId && status === 'success') {
      checkPaymentStatus(sessionId);
    } else if (status === 'cancelled') {
      toast.info('Payment was cancelled');
    }
  }, [searchParams]);

  const loadSubscription = async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription`, {
        withCredentials: true
      });
      setSubscription(response.data);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/stripe/plans`);
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const checkPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      toast.error('Payment verification timed out. Please refresh the page.');
      setCheckingPayment(false);
      return;
    }

    setCheckingPayment(true);
    
    try {
      const response = await axios.get(`${API_URL}/stripe/checkout-status/${sessionId}`, {
        withCredentials: true
      });
      
      if (response.data.payment_status === 'paid') {
        toast.success(`Successfully upgraded to ${response.data.plan_name}!`);
        await loadSubscription();
        setCheckingPayment(false);
        // Clean URL
        window.history.replaceState({}, '', '/settings/subscription');
      } else if (response.data.status === 'expired') {
        toast.error('Payment session expired. Please try again.');
        setCheckingPayment(false);
      } else {
        // Continue polling
        setTimeout(() => checkPaymentStatus(sessionId, attempts + 1), 2000);
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      toast.error('Error checking payment status');
      setCheckingPayment(false);
    }
  };

  const handleSubscribe = async (planId) => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/stripe/create-checkout`, {
        plan_id: planId,
        origin_url: window.location.origin
      }, {
        withCredentials: true
      });
      
      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url;
      
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/subscription/cancel`, {}, {
        withCredentials: true
      });
      toast.success('Subscription cancelled');
      await loadSubscription();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  if (checkingPayment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-brand-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Verifying Payment...</h3>
            <p className="text-gray-500">Please wait while we confirm your payment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subscription</h2>
        <p className="text-gray-500">Manage your subscription plan</p>
      </div>

      {/* Current Plan */}
      {subscription && (
        <Card className="border-brand-orange-200 bg-brand-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-brand-orange-500" />
              Current Plan: {subscription.plan_name || subscription.plan || 'Free'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">
                  Status: <span className="font-medium capitalize">{subscription.subscription_status || subscription.status || 'Active'}</span>
                </p>
                {subscription.trial_active && (
                  <p className="text-sm text-brand-orange-600">Trial ends: {new Date(subscription.trial_end_date).toLocaleDateString()}</p>
                )}
              </div>
              {subscription.subscription_status === 'active' && !subscription.trial_active && (
                <Button variant="outline" onClick={handleCancelSubscription} disabled={loading}>
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.id === 'professional' ? 'border-brand-orange-500 border-2' : ''}`}
          >
            {plan.id === 'professional' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-brand-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex flex-col gap-2">
                <span>{plan.name}</span>
                <span className="text-2xl font-bold">€{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className={`w-full ${plan.id === 'professional' ? 'bg-brand-orange-500 hover:bg-brand-orange-600' : ''}`}
                variant={plan.id === 'professional' ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || (subscription?.plan?.toLowerCase() === plan.name.toLowerCase() && subscription?.subscription_status === 'active')}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                {subscription?.plan?.toLowerCase() === plan.name.toLowerCase() && subscription?.subscription_status === 'active' 
                  ? 'Current Plan' 
                  : `Subscribe`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Security Notice */}
      <div className="text-center text-sm text-gray-500">
        <p>🔒 Secure payment powered by Stripe</p>
        <p>You can cancel your subscription at any time</p>
      </div>
    </div>
  );
};

export default SubscriptionSettings;
