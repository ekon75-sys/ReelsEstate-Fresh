import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CreateProject = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/projects`, {
        title,
        status: 'draft'
      });
      toast.success('Project created!');
      navigate(`/projects/${response.data.id}/photos`);
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                <Video className="w-6 h-6 text-brand-orange-500" />
              </div>
              <div>
                <CardTitle className="text-2xl">Create New Video Project</CardTitle>
                <p className="text-gray-600 text-sm mt-1">Start by giving your project a name</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Luxury Villa in Marbella"
                  required
                  data-testid="project-title-input"
                  className="text-lg"
                />
                <p className="text-sm text-gray-500">This will appear in your intro video</p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600 py-6 text-lg"
                  disabled={loading}
                  data-testid="create-project-btn"
                >
                  {loading ? 'Creating...' : 'Continue to Photo Upload'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="py-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateProject;