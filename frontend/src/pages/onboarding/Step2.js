import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Upload, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const response = await axios.get(`${API_URL}/branding`, { withCredentials: true });
      if (response.data.logo_url) {
        const logoUrl = response.data.logo_url.startsWith('data:') ? response.data.logo_url : process.env.REACT_APP_BACKEND_URL + response.data.logo_url;
        setLogoPreview(logoUrl);
      }
    } catch (error) {
      console.error('Failed to load branding:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    setLogoPreview('');
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (logo) {
        const formData = new FormData();
        formData.append('file', logo);
        await axios.post(`${API_URL}/upload/logo`, formData, { withCredentials: true });
      }

      // Update progress
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 3,
        completed_steps: {}
      }, { withCredentials: true });

      toast.success('Logo uploaded successfully!');
      navigate('/onboarding/step-3');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 3,
        completed_steps: {}
      });
      navigate('/onboarding/step-3');
    } catch (error) {
      toast.error('Failed to proceed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 2 of 6</span>
            <span className="text-sm text-gray-500">Upload Logo</span>
          </div>
          <Progress value={33.34} className="h-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Upload Your Logo</h1>
                <p className="text-gray-600">Your logo will appear on all videos</p>
              </div>
            </div>

            <div className="space-y-6">
              {logoPreview ? (
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center">
                  <img src={logoPreview} alt="Logo preview" className="max-h-48 mb-4" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="absolute top-4 right-4"
                    data-testid="remove-logo-btn"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <p className="text-sm text-gray-600">Logo preview</p>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange-500 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-1">Click to upload logo</p>
                  <p className="text-sm text-gray-500">PNG, SVG, or JPG (recommended: transparent background)</p>
                  <input
                    type="file"
                    accept=".png,.svg,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="logo-upload-input"
                  />
                </label>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600"
                  disabled={loading || !logoPreview}
                  data-testid="step2-continue-btn"
                >
                  Continue to Branding
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  data-testid="step2-skip-btn"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep2;
