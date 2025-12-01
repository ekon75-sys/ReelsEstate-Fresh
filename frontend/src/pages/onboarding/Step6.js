import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep6 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Professional');

  const plans = [
    {
      name: 'Basic',
      price: 19.99,
      features: [
        '1 agent profile',
        '1 download format',
        'Watermark + Outro branding',
        '3-day free trial',
        'Basic video editing'
      ]
    },
    {
      name: 'Professional',
      price: 39.99,
      popular: true,
      features: [
        'Up to 3 agents',
        'Horizontal & Vertical formats',
        'Facebook & Instagram integration',
        'AI photo enhancement',
        'Custom branding',
        '3-day free trial'
      ]
    },
    {
      name: 'Enterprise',
      price: 99.99,
      features: [
        'Unlimited agents',
        'All formats (16:9, 9:16, 1:1)',
        'All social media integrations',
        'Multi-agent support',
        'Priority support',
        'Advanced scheduling',
        '3-day free trial'
      ]
    },
    {
      name: 'AI Caption',
      price: 199.99,
      badge: 'Premium',
      features: [
        'Everything in Enterprise',
        'AI-generated text captions',
        'Advanced AI photo enhancement',
        'Automatic property descriptions',
        'Smart text overlay positioning',
        'Premium support',
        '3-day free trial'
      ]
    }
  ];

  const handleSubscribe = async () => {
    setLoading(true);

    try {
      const plan = plans.find(p => p.name === selectedPlan);
      
      // Mock subscription (Stripe integration to be added)
      await axios.post(`${API_URL}/subscription`, {
        plan_name: plan.name,
        plan_price: plan.price
      });

      // Mark onboarding as complete
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 7,
        completed_steps: {}
      });

      toast.success('Subscription activated! Welcome to ReelsEstate!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to activate subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 6 of 6</span>
            <span className="text-sm text-gray-500">Choose Your Plan</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-lg text-gray-600">Start with a 3-day free trial. No credit card required.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map(plan => (
            <Card
              key={plan.name}
              className={`relative cursor-pointer transition-all ${
                selectedPlan === plan.name
                  ? 'border-brand-orange-500 border-2 shadow-xl'
                  : 'border-gray-200 hover:border-brand-orange-300'
              }`}
              onClick={() => setSelectedPlan(plan.name)}
              data-testid={`plan-card-${plan.name.toLowerCase().replace(' ', '-')}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {plan.badge}
                </div>
              )}
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">€{plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-brand-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Start Your Free Trial</h2>
              <p className="text-gray-600">Selected: {selectedPlan} Plan</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              🎉 <strong>Trial Period:</strong> Get full access to all features for 3 days. 
              No credit card required. Cancel anytime.
            </p>
          </div>

          <Button
            onClick={handleSubscribe}
            className="w-full bg-brand-orange-500 hover:bg-brand-orange-600 text-lg py-6"
            disabled={loading}
            data-testid="subscribe-btn"
          >
            {loading ? 'Activating...' : 'Start 3-Day Free Trial'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep6;
