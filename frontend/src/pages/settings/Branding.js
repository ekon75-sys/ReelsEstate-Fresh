import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';


const BrandingSettings = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    font_name: 'Inter',
    font_alignment: 'left',
    main_color: '#FF6B35',
    currency: '€',
    logo_url: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const response = await axios.get(`${API_URL}/branding`, {
        withCredentials: true
      });
      if (response.data) {
        setFormData(response.data);
        if (response.data.logo_url) {
          // Support both data URLs (base64) and regular URLs
          const logoUrl = response.data.logo_url.startsWith('data:') || response.data.logo_url.startsWith('http') 
            ? response.data.logo_url 
            : `${process.env.REACT_APP_BACKEND_URL}${response.data.logo_url}`;
          setLogoPreview(logoUrl);
        }
      }
    } catch (error) {
      console.error('Failed to load branding:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (logoFile) {
        const logoFormData = new FormData();
        logoFormData.append('file', logoFile);
        await axios.post(`${API_URL}/upload/logo`, logoFormData, {
          withCredentials: true
        });
      }

      await axios.post(`${API_URL}/branding`, {
        font_name: formData.font_name,
        font_alignment: formData.font_alignment,
        main_color: formData.main_color,
        currency: formData.currency
      }, {
        withCredentials: true
      });

      toast.success('Branding updated!');
      await loadBranding();
    } catch (error) {
      toast.error('Failed to update branding');
    } finally {
      setLoading(false);
    }
  };

  const fonts = ['Inter', 'Space Grotesk', 'Playfair Display', 'Manrope', 'Work Sans', 'Roboto'];
  const currencies = [
    { label: 'Euro (€)', value: '€' },
    { label: 'US Dollar ($)', value: '$' },
    { label: 'British Pound (£)', value: '£' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Logo</Label>
            {logoPreview ? (
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center">
                <img src={logoPreview} alt="Logo" className="max-h-32 mb-4" />
                <Button type="button" variant="outline" size="sm" onClick={handleRemoveLogo}>
                  <X className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center cursor-pointer hover:border-brand-orange-500 transition-colors">
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600">Click to upload logo</p>
                <input
                  type="file"
                  accept=".png,.svg,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>Font Family</Label>
            <Select value={formData.font_name} onValueChange={(value) => setFormData(prev => ({ ...prev, font_name: value }))}>
              <SelectTrigger>
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
              <SelectTrigger>
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
            <Label>Main Color</Label>
            <div className="flex gap-4 items-center">
              <input
                type="color"
                value={formData.main_color}
                onChange={(e) => setFormData(prev => ({ ...prev, main_color: e.target.value }))}
                className="w-20 h-12 rounded border-2 border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.main_color}
                onChange={(e) => setFormData(prev => ({ ...prev, main_color: e.target.value }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(curr => (
                  <SelectItem key={curr.value} value={curr.value}>{curr.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="bg-brand-orange-500 hover:bg-brand-orange-600" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrandingSettings;
