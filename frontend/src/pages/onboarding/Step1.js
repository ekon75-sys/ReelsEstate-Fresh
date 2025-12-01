import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Building } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep1 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    commercial_name: '',
    address: '',
    country: '',
    region: '',
    postal_code: '',
    vat_number: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    billing_same_as_business: true,
    billing_address: '',
    billing_country: '',
    billing_region: '',
    billing_postal_code: ''
  });

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const response = await axios.get(`${API_URL}/onboarding/progress`);
      if (response.data.completed_steps && response.data.completed_steps['1']) {
        setFormData(response.data.completed_steps['1']);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save business info
      await axios.post(`${API_URL}/business-info`, formData);

      // Update progress
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 2,
        completed_steps: { '1': formData }
      });

      toast.success('Business information saved!');
      navigate('/onboarding/step-2');
    } catch (error) {
      toast.error('Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 1 of 6</span>
            <span className="text-sm text-gray-500">Business Information</span>
          </div>
          <Progress value={16.67} className="h-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <Building className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Business Information</h1>
                <p className="text-gray-600">Tell us about your company</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    required
                    data-testid="company-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commercial_name">Commercial Name (Optional)</Label>
                  <Input
                    id="commercial_name"
                    value={formData.commercial_name}
                    onChange={(e) => handleChange('commercial_name', e.target.value)}
                    data-testid="commercial-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  required
                  data-testid="address-input"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select value={formData.country} onValueChange={(value) => handleChange('country', value)}>
                    <SelectTrigger data-testid="country-select">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spain">Spain</SelectItem>
                      <SelectItem value="USA">United States</SelectItem>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Italy">Italy</SelectItem>
                      <SelectItem value="Portugal">Portugal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region / Province *</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => handleChange('region', e.target.value)}
                    required
                    data-testid="region-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code *</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleChange('postal_code', e.target.value)}
                    required
                    data-testid="postal-code-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat_number">VAT / Tax ID Number *</Label>
                <Input
                  id="vat_number"
                  value={formData.vat_number}
                  onChange={(e) => handleChange('vat_number', e.target.value)}
                  required
                  data-testid="vat-input"
                />
              </div>

              {/* Billing Address Section */}
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold text-lg mb-4">Billing Address</h3>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="billing_same"
                      checked={formData.billing_same_as_business}
                      onChange={(e) => handleChange('billing_same_as_business', e.target.checked)}
                      className="w-4 h-4 text-brand-orange-500 rounded focus:ring-brand-orange-500"
                    />
                    <Label htmlFor="billing_same" className="cursor-pointer">
                      This is also the billing address
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="billing_different"
                      checked={!formData.billing_same_as_business}
                      onChange={(e) => handleChange('billing_same_as_business', !e.target.checked)}
                      className="w-4 h-4 text-brand-orange-500 rounded focus:ring-brand-orange-500"
                    />
                    <Label htmlFor="billing_different" className="cursor-pointer">
                      Use a different billing address
                    </Label>
                  </div>
                </div>

                {!formData.billing_same_as_business && (
                  <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="billing_address">Billing Address *</Label>
                      <Input
                        id="billing_address"
                        value={formData.billing_address}
                        onChange={(e) => handleChange('billing_address', e.target.value)}
                        required={!formData.billing_same_as_business}
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="billing_country">Country *</Label>
                        <Select 
                          value={formData.billing_country} 
                          onValueChange={(value) => handleChange('billing_country', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Spain">Spain</SelectItem>
                            <SelectItem value="USA">United States</SelectItem>
                            <SelectItem value="UK">United Kingdom</SelectItem>
                            <SelectItem value="Germany">Germany</SelectItem>
                            <SelectItem value="France">France</SelectItem>
                            <SelectItem value="Italy">Italy</SelectItem>
                            <SelectItem value="Portugal">Portugal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="billing_region">Region / Province *</Label>
                        <Input
                          id="billing_region"
                          value={formData.billing_region}
                          onChange={(e) => handleChange('billing_region', e.target.value)}
                          required={!formData.billing_same_as_business}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="billing_postal_code">Postal Code *</Label>
                        <Input
                          id="billing_postal_code"
                          value={formData.billing_postal_code}
                          onChange={(e) => handleChange('billing_postal_code', e.target.value)}
                          required={!formData.billing_same_as_business}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold text-lg mb-4">Contact Person</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Full Name *</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => handleChange('contact_name', e.target.value)}
                      required
                      data-testid="contact-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone Number *</Label>
                    <Input
                      id="contact_phone"
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      required
                      data-testid="contact-phone-input"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="contact_email">Email Address *</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => handleChange('contact_email', e.target.value)}
                      required
                      data-testid="contact-email-input"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                disabled={loading}
                data-testid="step1-continue-btn"
              >
                Continue to Logo Upload
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep1;
