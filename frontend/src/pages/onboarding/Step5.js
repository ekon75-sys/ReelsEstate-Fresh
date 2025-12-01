import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Users, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OnboardingStep5 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState({
    name: '',
    phone: '',
    email: '',
    photo_url: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await axios.get(`${API_URL}/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleAddAgent = async () => {
    if (!currentAgent.name || !currentAgent.email || !currentAgent.phone) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      let photo_url = '';
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        const uploadResponse = await axios.post(`${API_URL}/upload/agent-photo`, formData);
        photo_url = uploadResponse.data.photo_url;
      }

      await axios.post(`${API_URL}/agents`, {
        ...currentAgent,
        photo_url
      });

      toast.success('Agent added!');
      await loadAgents();
      
      // Reset form
      setCurrentAgent({ name: '', phone: '', email: '', photo_url: '' });
      setPhotoFile(null);
      setPhotoPreview('');
    } catch (error) {
      toast.error('Failed to add agent');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (agents.length === 0) {
      toast.error('Please add at least one agent');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API_URL}/onboarding/progress`, {
        current_step: 6,
        completed_steps: {}
      });
      navigate('/onboarding/step-6');
    } catch (error) {
      toast.error('Failed to proceed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 5 of 6</span>
            <span className="text-sm text-gray-500">Agent Details</span>
          </div>
          <Progress value={83.34} className="h-2" />
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add Agent Details</h1>
                <p className="text-gray-600">Add agents to appear in your videos</p>
              </div>
            </div>

            {agents.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">
                  {agents.length} agent(s) added
                </p>
                <div className="space-y-2">
                  {agents.map(agent => (
                    <div key={agent.id} className="flex items-center gap-3 text-sm text-gray-700">
                      <div className="w-8 h-8 bg-brand-orange-100 rounded-full flex items-center justify-center">
                        {agent.name.charAt(0)}
                      </div>
                      <span>{agent.name} - {agent.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Agent Photo</Label>
                {photoPreview ? (
                  <div className="flex items-center gap-4">
                    <img src={photoPreview} alt="Agent" className="w-20 h-20 rounded-full object-cover" />
                    <Button variant="outline" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} size="sm">
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange-500 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Upload agent photo</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      data-testid="agent-photo-input"
                    />
                  </label>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="agent_name">Full Name *</Label>
                  <Input
                    id="agent_name"
                    value={currentAgent.name}
                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="agent-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent_phone">Phone Number *</Label>
                  <Input
                    id="agent_phone"
                    type="tel"
                    value={currentAgent.phone}
                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="agent-phone-input"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="agent_email">Email Address *</Label>
                  <Input
                    id="agent_email"
                    type="email"
                    value={currentAgent.email}
                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="agent-email-input"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddAgent}
                variant="outline"
                className="w-full border-brand-orange-500 text-brand-orange-500 hover:bg-brand-orange-50"
                disabled={loading}
                data-testid="add-agent-btn"
              >
                <Plus className="mr-2 w-5 h-5" />
                Add Agent
              </Button>

              <p className="text-sm text-gray-500 italic">
                At least one agent is required. You can add more agents later in your profile menu.
              </p>

              <Button
                onClick={handleContinue}
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                disabled={loading || agents.length === 0}
                data-testid="step5-continue-btn"
              >
                Continue to Subscription
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingStep5;
