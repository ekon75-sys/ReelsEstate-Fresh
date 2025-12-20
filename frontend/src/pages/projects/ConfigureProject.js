import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Home } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ConfigureProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [branding, setBranding] = useState(null);
  const [config, setConfig] = useState({
    agent_id: '',
    left_banner: 'No Banner',
    right_banner_price: '',
    currency: '€'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [agentsRes, brandingRes, projectRes] = await Promise.all([
        axios.get(`${API_URL}/agents`, { withCredentials: true }),
        axios.get(`${API_URL}/branding`, { withCredentials: true }),
        axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true })
      ]);

      setAgents(agentsRes.data);
      setBranding(brandingRes.data);
      
      if (projectRes.data.agent_id) {
        setConfig({
          agent_id: projectRes.data.agent_id || '',
          left_banner: projectRes.data.left_banner || 'No Banner',
          right_banner_price: projectRes.data.right_banner_price || '',
          currency: projectRes.data.currency || brandingRes.data.currency || '€'
        });
      } else {
        setConfig(prev => ({ ...prev, currency: brandingRes.data.currency || '€' }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleContinue = async () => {
    if (!config.agent_id) {
      toast.error('Please select an agent');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API_URL}/projects/${projectId}`, config);
      toast.success('Configuration saved!');
      navigate(`/projects/${projectId}/generate`);
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const bannerOptions = [
    'No Banner',
    'Coming Soon',
    'For Rent',
    'For Sale',
    'For Takeover',
    'New Development',
    'New Listing',
    'Price Lowered',
    'Rented',
    'Sold'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ReelsEstate Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
              ReelsEstate
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Configure Video Details</CardTitle>
            <p className="text-gray-600">Select agent, banners, and pricing</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Agent Selection */}
            <div className="space-y-2">
              <Label>Select Agent *</Label>
              <Select value={config.agent_id} onValueChange={(value) => setConfig(prev => ({ ...prev, agent_id: value }))}>
                <SelectTrigger data-testid="agent-select">
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} - {agent.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="text-sm text-red-500">No agents found. Please add an agent in Settings first.</p>
              )}
            </div>

            {/* Left Banner */}
            <div className="space-y-2">
              <Label>Left Banner (Property Status)</Label>
              <Select value={config.left_banner} onValueChange={(value) => setConfig(prev => ({ ...prev, left_banner: value }))}>
                <SelectTrigger data-testid="left-banner-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bannerOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Property Price (Right Banner - Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={config.currency}
                  disabled
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="e.g., 495000"
                  value={config.right_banner_price}
                  onChange={(e) => setConfig(prev => ({ ...prev, right_banner_price: e.target.value }))}
                  data-testid="price-input"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-gray-500">Leave empty if you don't want to show price</p>
            </div>

            {/* Preview */}
            {branding && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <p className="text-sm font-medium mb-3">Preview:</p>
                <div className="bg-gray-100 rounded p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="px-3 py-1 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: branding.main_color || '#FF6B35' }}
                    >
                      {config.left_banner}
                    </div>
                    {config.right_banner_price && (
                      <div
                        className="px-3 py-1 rounded text-white text-sm font-medium ml-auto"
                        style={{ backgroundColor: branding.main_color || '#FF6B35' }}
                      >
                        {config.currency}{parseFloat(config.right_banner_price).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Banners will appear on your video</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => navigate(`/projects/${projectId}/music`)}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back to Music
              </Button>
              <Button
                className="bg-brand-orange-500 hover:bg-brand-orange-600 w-full sm:w-auto"
                onClick={handleContinue}
                disabled={loading || !config.agent_id}
                data-testid="continue-to-generate-btn"
              >
                <span className="truncate">Continue to Generate</span>
                <ArrowRight className="ml-2 w-5 h-5 flex-shrink-0" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfigureProject;