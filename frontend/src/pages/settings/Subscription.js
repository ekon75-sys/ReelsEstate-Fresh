import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DollarSign, Check, Tag, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';


const SubscriptionSettings = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  useEffect(() => {
    loadSubscription();
  }, []);

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

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;

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

  const handleValidateDiscount = async (planPrice) => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code');
      return;
    }

    setValidatingCode(true);
    try {
      const response = await axios.post(`${API_URL}/discount-codes/validate`, {
        code: discountCode.trim(),
        plan_price: planPrice
      }, {
        withCredentials: true
      });

      if (response.data.valid) {
        setAppliedDiscount(response.data);
        toast.success(response.data.message);
      } else {
        setAppliedDiscount(null);
        toast.error(response.data.message);
      }
    } catch (error) {
      setAppliedDiscount(null);
      toast.error('Failed to validate discount code');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubscribe = async (plan) => {
    setLoading(true);
    try {
      // Apply discount if available
      let finalPrice = plan.price;
      if (appliedDiscount && appliedDiscount.valid) {
        await axios.post(`${API_URL}/discount-codes/apply`, {
          code: discountCode.trim(),
          plan_price: plan.price
        }, {
          withCredentials: true
        });
        finalPrice = appliedDiscount.final_price;
      }

      // Create subscription
      await axios.post(`${API_URL}/subscription`, {
        plan_name: plan.name,
        plan_price: finalPrice
      }, {
        withCredentials: true
      });

      toast.success(`Successfully subscribed to ${plan.name} plan!`);
      setDiscountCode('');
      setAppliedDiscount(null);
      await loadSubscription();
    } catch (error) {
      toast.error('Failed to subscribe to plan');
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Basic',
      price: 19.99,
      features: ['1 agent', '1 format (16:9)', 'Basic features']
    },
    {
      name: 'Professional',
      price: 39.99,
      features: ['3 agents', 'All formats (16:9, 9:16, 1:1)', 'Premium photo enhancements', 'Virtual staging', 'Facebook & Instagram']
    },
    {
      name: 'Enterprise',
      price: 99.99,
      features: ['Unlimited agents', 'All formats (16:9, 9:16, 1:1)', 'Premium photo enhancements', 'Virtual staging', 'All integrations', 'Priority support']
    },
    {
      name: 'AI Caption',
      price: 199.99,
      features: ['Enterprise + AI captions', 'Premium photo enhancements', 'Virtual staging', 'Auto descriptions', 'Premium support']
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-brand-orange-50 border border-brand-orange-200 rounded-lg">
                <div>
                  <p className="text-2xl font-bold text-brand-orange-600">{subscription.plan_name}</p>
                  <p className="text-sm text-gray-600">Status: {subscription.status}</p>
                  <p className="text-sm text-gray-600">€{subscription.plan_price}/month</p>
                </div>
                {subscription.status === 'active' && (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={loading}
                    className="border-red-500 text-red-500 hover:bg-red-50"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No active subscription</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Discount Code Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Have a discount code?</h3>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter discount code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="flex-1"
                disabled={validatingCode}
              />
              <Button
                onClick={() => handleValidateDiscount(plans[0].price)}
                disabled={validatingCode || !discountCode.trim()}
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                {validatingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Apply'
                )}
              </Button>
            </div>
            {appliedDiscount && appliedDiscount.valid && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800 font-medium">
                  ✓ Discount applied: {appliedDiscount.discount_type === 'percentage' 
                    ? `${appliedDiscount.discount_value}% off` 
                    : `€${appliedDiscount.discount_value} off`}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  You'll save €{appliedDiscount.discount_amount} on your subscription
                </p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map(plan => {
              const originalPrice = plan.price;
              const discountedPrice = appliedDiscount?.valid ? (originalPrice - (originalPrice * (appliedDiscount.discount_value / 100))) : originalPrice;
              const showDiscount = appliedDiscount?.valid;
              
              return (
                <div
                  key={plan.name}
                  className={`border-2 rounded-lg p-6 ${
                    subscription?.plan_name === plan.name
                      ? 'border-brand-orange-500 bg-brand-orange-50'
                      : 'border-gray-200'
                  }`}
                >
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    {showDiscount ? (
                      <div>
                        <p className="text-lg text-gray-400 line-through">€{originalPrice}</p>
                        <p className="text-3xl font-bold text-green-600">
                          €{discountedPrice.toFixed(2)}
                          <span className="text-sm text-gray-500">/mo</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold">
                        €{originalPrice}
                        <span className="text-sm text-gray-500">/mo</span>
                      </p>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {subscription?.plan_name === plan.name ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleSubscribe(plan)}
                      disabled={loading}
                      className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Subscribe Now'
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Comparison Table */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Detailed Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 p-3 text-left font-semibold">Feature</th>
                    <th className="border border-gray-200 p-3 text-center font-semibold">Basic</th>
                    <th className="border border-gray-200 p-3 text-center font-semibold">Professional</th>
                    <th className="border border-gray-200 p-3 text-center font-semibold">Enterprise</th>
                    <th className="border border-gray-200 p-3 text-center font-semibold bg-brand-orange-50">AI Caption</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Number of Agents</td>
                    <td className="border border-gray-200 p-3 text-center">1</td>
                    <td className="border border-gray-200 p-3 text-center">3</td>
                    <td className="border border-gray-200 p-3 text-center">Unlimited</td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50">Unlimited</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 p-3 font-medium">Video Formats</td>
                    <td className="border border-gray-200 p-3 text-center">16:9 only</td>
                    <td className="border border-gray-200 p-3 text-center">All (16:9, 9:16, 1:1)</td>
                    <td className="border border-gray-200 p-3 text-center">All (16:9, 9:16, 1:1)</td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50">All (16:9, 9:16, 1:1)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Premium Photo Enhancement</td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 p-3 font-medium">Virtual Staging</td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">AI-Generated Captions</td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 p-3 font-medium">Custom Font Upload</td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Social Media Integrations</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">None</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">Facebook & Instagram</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">All platforms</td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50 text-sm">All platforms</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 p-3 font-medium">Support</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">Email</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">Email</td>
                    <td className="border border-gray-200 p-3 text-center text-sm">Priority</td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50 text-sm">Premium</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium font-bold">Monthly Price</td>
                    <td className="border border-gray-200 p-3 text-center font-bold">€19.99</td>
                    <td className="border border-gray-200 p-3 text-center font-bold">€39.99</td>
                    <td className="border border-gray-200 p-3 text-center font-bold">€99.99</td>
                    <td className="border border-gray-200 p-3 text-center bg-brand-orange-50 font-bold">€199.99</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSettings;
