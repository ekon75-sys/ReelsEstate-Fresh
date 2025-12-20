import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Palette } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep3 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    font_name: 'Inter',
    font_alignment: 'left',
    main_color: '#FF6B35',
    currency: '€'
  });

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const response = await axios.get(`${API_URL}/branding`, { withCredentials: true });
      if (response.data.font_name) {
        setFormData({
          font_name: response.data.font_name || 'Inter',
          font_alignment: response.data.font_alignment || 'left',
          main_color: response.data.main_color || '#FF6B35',
          currency: response.data.currency || '€'
        });
      }
    } catch (error) {
      console.error('Failed to load branding:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      await axios.post(`${API_URL}/branding`, formData, { withCredentials: true });
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 4,
        completed_steps: {}
      }, { withCredentials: true });

      toast.success('Branding preferences saved!');
      navigate('/onboarding/step-4');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const fonts = [
    'Inter',
    'Space Grotesk',
    'Playfair Display',
    'Manrope',
    'Work Sans',
    'Roboto',
    'Montserrat',
    'Lato'
  ];

  const currencies = [
    { label: 'Euro (€)', value: '€' },
    { label: 'US Dollar ($)', value: '$' },
    { label: 'British Pound (£)', value: '£' },
    { label: 'Japanese Yen (¥)', value: '¥' },
    { label: 'Swiss Franc (CHF)', value: 'CHF' },
    { label: 'Canadian Dollar (C$)', value: 'C$' },
    { label: 'Australian Dollar (A$)', value: 'A$' },
    { label: 'Chinese Yuan (¥)', value: 'CN¥' },
    { label: 'Indian Rupee (₹)', value: '₹' },
    { label: 'Singapore Dollar (S$)', value: 'S$' },
    { label: 'Hong Kong Dollar (HK$)', value: 'HK$' },
    { label: 'Swedish Krona (kr)', value: 'kr' },
    { label: 'Norwegian Krone (kr)', value: 'NOK' },
    { label: 'Danish Krone (kr)', value: 'DKK' },
    { label: 'Polish Złoty (zł)', value: 'zł' },
    { label: 'Mexican Peso (MX$)', value: 'MX$' },
    { label: 'Brazilian Real (R$)', value: 'R$' },
    { label: 'South African Rand (R)', value: 'ZAR' },
    { label: 'UAE Dirham (د.إ)', value: 'AED' },
    { label: 'Turkish Lira (₺)', value: '₺' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 3 of 6</span>
            <span className="text-sm text-gray-500">Branding Preferences</span>
          </div>
          <Progress value={50} className="h-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <Palette className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Branding Preferences</h1>
                <p className="text-gray-600">Customize your video style</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={formData.font_name} onValueChange={(value) => setFormData(prev => ({ ...prev, font_name: value }))}>
                  <SelectTrigger data-testid="font-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fonts.map(font => (
                      <SelectItem key={font} value={font}>{font}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Text Alignment</Label>
                <Select value={formData.font_alignment} onValueChange={(value) => setFormData(prev => ({ ...prev, font_alignment: value }))}>
                  <SelectTrigger data-testid="alignment-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Main Brand Color</Label>
                <div className="flex gap-4 items-center">
                  <input
                    type="color"
                    value={formData.main_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, main_color: e.target.value }))}
                    className="w-20 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    data-testid="color-picker"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.main_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, main_color: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded"
                      placeholder="#FF6B35"
                      data-testid="color-input"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
                  <SelectTrigger data-testid="currency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mt-6">
                <p className="text-sm text-gray-600 mb-4">Preview:</p>
                <div
                  style={{
                    fontFamily: formData.font_name,
                    textAlign: formData.font_alignment,
                    color: formData.main_color
                  }}
                  className="text-2xl font-bold"
                >
                  Your Brand Style
                </div>
                <p className="mt-2 text-gray-600" style={{ textAlign: formData.font_alignment }}>
                  Sample property price: {formData.currency}495,000
                </p>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                disabled={loading}
                data-testid="step3-continue-btn"
              >
                Continue to Social Media
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep3;
