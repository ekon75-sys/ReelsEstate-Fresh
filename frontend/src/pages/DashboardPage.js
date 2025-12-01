import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Settings, Users, Palette, CreditCard, LogOut, Plus, Image, Sparkles, Shield } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [agents, setAgents] = useState([]);
  const [videoCount, setVideoCount] = useState(0);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadDashboardData();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = () => {
    // Check if user email is ekon75@hotmail.com
    if (user?.email === 'ekon75@hotmail.com') {
      setIsAdmin(true);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [subResponse, agentsResponse] = await Promise.all([
        axios.get(`${API_URL}/subscription`),
        axios.get(`${API_URL}/agents`)
      ]);
      setSubscription(subResponse.data);
      setAgents(agentsResponse.data);
      
      // Load video count
      await loadVideoCount();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const loadVideoCount = async () => {
    try {
      setLoadingVideos(true);
      // Get all projects for user
      const projectsResponse = await axios.get(`${API_URL}/projects`);
      const projects = projectsResponse.data;
      console.log('Projects for video count:', projects);
      
      // Count total videos across all projects
      let totalVideos = 0;
      for (const project of projects) {
        try {
          const videosResponse = await axios.get(`${API_URL}/projects/${project.id}/videos`);
          console.log(`Videos for project ${project.id}:`, videosResponse.data.length);
          totalVideos += videosResponse.data.length;
        } catch (error) {
          console.error(`Failed to load videos for project ${project.id}:`, error);
        }
      }
      
      console.log('Total video count:', totalVideos);
      setVideoCount(totalVideos);
    } catch (error) {
      console.error('Failed to load video count:', error);
      setVideoCount(0);
    } finally {
      setLoadingVideos(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Mobile Layout */}
          <div className="flex md:hidden flex-col gap-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReelsEstate Logo" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
                ReelsEstate
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin" className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Link to="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start" data-testid="settings-nav-btn">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReelsEstate Logo" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
                ReelsEstate
              </span>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                    <Shield className="w-5 h-5 mr-2" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Link to="/settings">
                <Button variant="ghost" data-testid="settings-nav-btn">
                  <Settings className="w-5 h-5 mr-2" />
                  Settings
                </Button>
              </Link>
              <Button variant="ghost" onClick={logout} data-testid="logout-btn">
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user?.name || 'User'}!</h1>
          <p className="text-lg text-gray-600">Ready to create amazing property videos?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-orange-500" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{subscription?.plan_name || 'Loading...'}</p>
              <p className="text-sm text-gray-500 mt-1">
                {subscription?.status === 'active' ? 'Active' : 'Inactive'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-orange-500" />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{agents.length}</p>
              <p className="text-sm text-gray-500 mt-1">Agent profiles</p>
            </CardContent>
          </Card>

          <Link to="/projects">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="w-5 h-5 text-brand-orange-500" />
                  Videos Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {loadingVideos ? '...' : videoCount}
                </p>
                <p className="text-sm text-gray-500 mt-1">Click to view all projects</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">What would you like to create?</CardTitle>
            <p className="text-gray-600 text-sm mt-1">Choose your creation type</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Link to="/projects/create">
                <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-brand-orange-300 border-2">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-brand-orange-100 flex items-center justify-center">
                        <Video className="w-8 h-8 text-brand-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">Video Project</h3>
                        <p className="text-sm text-gray-600">
                          Create a complete property video with photos, music, and branding
                        </p>
                      </div>
                      <Button className="w-full bg-brand-orange-500 hover:bg-brand-orange-600" data-testid="create-video-btn">
                        <Plus className="w-5 h-5 mr-2" />
                        Start Video Project
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/photo-enhancement">
                <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-brand-orange-300 border-2">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-brand-orange-100 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-brand-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">Photo Enhancement</h3>
                        <p className="text-sm text-gray-600">
                          Enhance photos with AI or add virtual staging (Premium)
                        </p>
                      </div>
                      <Button className="w-full bg-brand-orange-500 hover:bg-brand-orange-600" data-testid="photo-enhancement-btn">
                        <Image className="w-5 h-5 mr-2" />
                        Enhance Photos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="pt-6 border-t">
              <p className="text-sm text-gray-600 mb-4">Quick Settings</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Link to="/settings/business" className="w-full">
                  <Button variant="outline" className="w-full" data-testid="business-settings-btn">
                    <Settings className="w-5 h-5 mr-2" />
                    Business Info
                  </Button>
                </Link>
                <Link to="/settings/branding" className="w-full">
                  <Button variant="outline" className="w-full" data-testid="branding-settings-btn">
                    <Palette className="w-5 h-5 mr-2" />
                    Branding
                  </Button>
                </Link>
                <Link to="/settings/agents" className="w-full">
                  <Button variant="outline" className="w-full" data-testid="agents-settings-btn">
                    <Users className="w-5 h-5 mr-2" />
                    Manage Agents
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
