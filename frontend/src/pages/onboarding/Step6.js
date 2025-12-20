import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Check, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep6 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStartTrial = async () => {
    setLoading(true);

    try {
      // Start free trial
      await axios.post(`${API_URL}/subscription`, {
        plan_name: 'Free Trial',
        plan_price: 0
      }, { withCredentials: true });

      // Mark onboarding as complete
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 7,
        completed_steps: {}
      }, { withCredentials: true });

      toast.success('Welcome to ReelsEstate! Your free trial has started.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Trial activation error:', error);
      toast.error('Failed to start trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Create stunning property videos',
    'AI-powered photo enhancement',
    'Multiple social media integrations',
    'Custom branding options',
    'Professional video templates'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 6 of 6</span>
            <span className="text-sm text-brand-orange-600 font-medium">Almost there!</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {/* Main Content */}
        <Card className="shadow-xl border-0">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <div className="w-20 h-20 bg-brand-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-10 h-10 text-brand-orange-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              You're All Set! 🎉
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Start your 3-day free trial and experience all the features of ReelsEstate.
            </p>

            {/* Features List */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">What's included in your trial:</h3>
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <Button 
              size="lg"
              className="w-full bg-brand-orange-500 hover:bg-brand-orange-600 text-lg py-6"
              onClick={handleStartTrial}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting your trial...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>

            <p className="text-sm text-gray-500 mt-4">
              No credit card required. You can upgrade anytime in Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep6;
