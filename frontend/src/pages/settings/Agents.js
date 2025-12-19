import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Trash2, Upload, Edit } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AgentsSettings = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', photo_url: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await axios.get(`${API_URL}/agents`, {
        headers: getAuthHeaders()
      });
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

  const handleAddOrUpdateAgent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let photo_url = formData.photo_url || '';
      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', photoFile);
        const uploadResponse = await axios.post(`${API_URL}/upload/agent-photo`, photoFormData, {
          headers: getAuthHeaders()
        });
        photo_url = uploadResponse.data.photo_url;
      }

      if (editingAgent) {
        // Update existing agent
        await axios.put(`${API_URL}/agents/${editingAgent.id}`, { ...formData, photo_url }, {
          headers: getAuthHeaders()
        });
        toast.success('Agent updated!');
      } else {
        // Add new agent
        await axios.post(`${API_URL}/agents`, { ...formData, photo_url }, {
          headers: getAuthHeaders()
        });
        toast.success('Agent added!');
      }

      await loadAgents();
      resetForm();
    } catch (error) {
      toast.error(editingAgent ? 'Failed to update agent' : 'Failed to add agent');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      photo_url: agent.photo_url
    });
    if (agent.photo_url) {
      const photoUrl = agent.photo_url.startsWith('http') ? agent.photo_url : `${process.env.REACT_APP_BACKEND_URL}${agent.photo_url}`;
      setPhotoPreview(photoUrl);
    }
    setShowForm(true);
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${API_URL}/agents/${agentId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Agent deleted');
      await loadAgents();
    } catch (error) {
      toast.error('Failed to delete agent');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', photo_url: '' });
    setPhotoFile(null);
    setPhotoPreview('');
    setEditingAgent(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              Manage Agents
            </CardTitle>
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-brand-orange-500 hover:bg-brand-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {agents.length === 0 && (
            <p className="text-center text-gray-500 py-8">No agents added yet</p>
          )}

          <div className="space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-4">
                  {agent.photo_url ? (
                    <img 
                      src={agent.photo_url.startsWith('http') ? agent.photo_url : `${process.env.REACT_APP_BACKEND_URL}${agent.photo_url}`} 
                      alt={agent.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-12 h-12 bg-brand-orange-100 rounded-full flex items-center justify-center text-brand-orange-600 font-semibold" style={{display: agent.photo_url ? 'none' : 'flex'}}>
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{agent.name}</p>
                    <p className="text-sm text-gray-600">{agent.email}</p>
                    <p className="text-sm text-gray-500">{agent.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditAgent(agent)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    data-testid={`edit-agent-${agent.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-agent-${agent.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingAgent ? 'Edit Agent' : 'Add New Agent'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddOrUpdateAgent} className="space-y-4">
              <div className="space-y-2">
                <Label>Agent Photo (Optional)</Label>
                {photoPreview ? (
                  <div className="flex items-center gap-4">
                    <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                      size="sm"
                    >
                      Remove Photo
                    </Button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-brand-orange-500 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Click to upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  data-testid="agent-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  data-testid="agent-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                  data-testid="agent-phone-input"
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="bg-brand-orange-500 hover:bg-brand-orange-600" disabled={loading}>
                  {loading ? 'Saving...' : (editingAgent ? 'Update Agent' : 'Add Agent')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentsSettings;
