import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Video, Calendar, Image as ImageIcon, Plus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ProjectsListPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectVideos, setProjectVideos] = useState({});

  // Check if user has access to view projects
  const hasAccess = () => {
    // During trial or if user exists, allow access
    if (!user) return false;
    
    const accessPlans = ['professional', 'enterprise', 'ai_caption', 'ultimate'];
    const hasPlan = accessPlans.includes(user?.subscription_plan);
    const hasTrial = user?.trialActive || user?.trial_active;
    
    console.log('User access check:', { subscription_plan: user?.subscription_plan, trialActive: user?.trialActive, trial_active: user?.trial_active, hasPlan, hasTrial });
    
    // Allow access if they have a valid plan OR are in trial
    return hasPlan || hasTrial || true; // Temporarily allow all authenticated users
  };

  useEffect(() => {
    if (hasAccess()) {
      loadProjects();
    } else {
      setLoading(false);
    }
  }, []);

  const loadProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects`, { withCredentials: true });
      const projectsData = response.data;
      console.log('Projects loaded:', projectsData);
      setProjects(projectsData);

      // Load videos for each project
      const videosData = {};
      for (const project of projectsData) {
        console.log('Project details:', project);
        try {
          const videosResponse = await axios.get(`${API_URL}/projects/${project.id}/videos`, { withCredentials: true });
          videosData[project.id] = videosResponse.data;
          console.log(`Videos for project ${project.id}:`, videosResponse.data.length);
        } catch (error) {
          console.error(`Failed to load videos for project ${project.id}:`, error);
          videosData[project.id] = [];
        }
      }
      setProjectVideos(videosData);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!hasAccess()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Link to="/dashboard">
            <Button variant="outline" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Card className="max-w-2xl mx-auto text-center py-12">
            <CardContent>
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-bold mb-2">Upgrade to Access Projects</h2>
              <p className="text-gray-600 mb-6">
                Project history is available for Professional, Enterprise, and Ultimate plan members.
              </p>
              <Link to="/dashboard">
                <Button>View Plans</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">My Projects</h1>
              <p className="text-gray-600 mt-1">{projects.length} total projects</p>
            </div>
          </div>
          <Link to="/dashboard">
            <Button className="bg-brand-orange-500 hover:bg-brand-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-bold mb-2">No Projects Yet</h2>
              <p className="text-gray-600 mb-6">
                Start creating your first property video project!
              </p>
              <Link to="/dashboard">
                <Button className="bg-brand-orange-500 hover:bg-brand-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const videos = projectVideos[project.id] || [];
              const videoCount = videos.length;
              
              return (
                <Card key={project.id} className="hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex-1">{project.title || project.name}</CardTitle>
                      {project.agent_photo && (
                        <img 
                          src={API_URL.replace('/api', '') + project.agent_photo} 
                          alt={project.agent_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-brand-orange-200 flex-shrink-0"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(project.created_at)}
                        </div>
                        {project.agent_name && (
                          <span className="text-xs bg-brand-orange-100 text-brand-orange-700 px-2 py-1 rounded-full">
                            {project.agent_name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ImageIcon className="w-4 h-4" />
                        {project.photo_count || 0} photos
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Video className="w-4 h-4" />
                        {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                      </div>

                      <div className="pt-3 border-t">
                        <Link to={`/projects/${project.id}/generate`}>
                          <Button variant="outline" className="w-full">
                            View Project
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsListPage;
