import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ArrowRight, Sparkles, Home, Sunset, Stars, Crown } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PremiumEditing = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedEnhancement, setSelectedEnhancement] = useState('twilight_sky');
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [trialActive, setTrialActive] = useState(false);

  useEffect(() => {
    checkPremiumAccess();
    loadPhotos();
  }, [projectId]);

  const checkPremiumAccess = async () => {
    try {
      const response = await axios.get(`${API_URL}/premium-features/check-access`);
      setHasAccess(response.data.has_access);
      setTrialActive(response.data.trial_active || false);
      
      if (!response.data.has_access) {
        toast.error('Premium features require Professional, Enterprise, or AI Caption subscription');
        setTimeout(() => navigate(`/projects/${projectId}/music`), 2000);
      }
    } catch (error) {
      console.error('Access check failed:', error);
      toast.error('Unable to verify premium access');
    }
  };

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}`);
      setPhotos(response.data.photos || []);
      if (response.data.photos?.length > 0) {
        setSelectedPhoto(response.data.photos[0]);
      }
    } catch (error) {
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async () => {
    if (!selectedPhoto) return;
    
    setProcessing(true);
    try {
      const response = await axios.post(
        `${API_URL}/projects/${projectId}/photos/${selectedPhoto.id}/premium-enhance`,
        null,
        {
          params: {
            enhancement_type: selectedEnhancement,
            style: selectedStyle
          }
        }
      );

      toast.success('Enhancement completed!');
      
      // Update photo in list
      setPhotos(photos.map(p => 
        p.id === selectedPhoto.id 
          ? { ...p, premium_enhanced_url: response.data.enhanced_url, premium_enhanced: true }
          : p
      ));
      
      // Update selected photo
      setSelectedPhoto({
        ...selectedPhoto,
        premium_enhanced_url: response.data.enhanced_url,
        premium_enhanced: true
      });
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Enhancement failed');
    } finally {
      setProcessing(false);
    }
  };

  const enhancements = [
    {
      id: 'twilight_sky',
      name: 'Twilight Sky',
      icon: Sunset,
      description: 'Transform to golden hour with stunning twilight sky',
      category: 'smart'
    },
    {
      id: 'golden_hour',
      name: 'Golden Hour',
      icon: Stars,
      description: 'Add warm golden hour lighting',
      category: 'smart'
    },
    {
      id: 'professional_retouch',
      name: 'Pro Retouch',
      icon: Sparkles,
      description: 'Professional retouching and detail enhancement',
      category: 'smart'
    },
    {
      id: 'virtual_staging_interior',
      name: 'Interior Staging',
      icon: Home,
      description: 'Add furniture and decor to empty rooms',
      category: 'staging'
    },
    {
      id: 'virtual_staging_exterior',
      name: 'Exterior Staging',
      icon: Crown,
      description: 'Enhance landscaping and curb appeal',
      category: 'staging'
    }
  ];

  const stagingStyles = [
    { id: 'modern', name: 'Modern', desc: 'Contemporary clean lines' },
    { id: 'luxury', name: 'Luxury', desc: 'High-end designer furniture' },
    { id: 'minimalist', name: 'Minimalist', desc: 'Scandinavian simplicity' },
    { id: 'valencian', name: 'Valencian', desc: 'Mediterranean elegance' },
    { id: 'ibiza', name: 'Ibiza', desc: 'Chic coastal style' }
  ];

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Premium Features</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Crown className="w-16 h-16 mx-auto text-brand-orange-500" />
            <p>This feature requires a premium subscription</p>
            <p className="text-sm text-gray-600">
              Upgrade to Professional, Enterprise, or AI Caption plan to access AI-powered photo enhancements
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-orange-500" />
      </div>
    );
  }

  const currentPhotoUrl = selectedPhoto?.premium_enhanced_url || selectedPhoto?.enhanced_url || selectedPhoto?.url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-brand-orange-500" />
                  Premium Photo Editing
                </CardTitle>
                <p className="text-gray-600 mt-1">AI-powered enhancements and virtual staging</p>
              </div>
              <Badge variant="outline" className="bg-brand-orange-100 text-brand-orange-700 border-brand-orange-300">
                {trialActive ? 'Trial Active' : 'Premium'}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Tabs defaultValue="smart" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="smart">Smart Enhancement</TabsTrigger>
                <TabsTrigger value="staging">Virtual Staging</TabsTrigger>
              </TabsList>
              
              <TabsContent value="smart" className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Preview */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Preview</h3>
                    {selectedPhoto && (
                      <div className="border rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={process.env.REACT_APP_BACKEND_URL + currentPhotoUrl}
                          alt="Selected"
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                    
                    {/* Photo selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map(photo => (
                        <div
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo)}
                          className={`cursor-pointer border-2 rounded overflow-hidden ${
                            selectedPhoto?.id === photo.id ? 'border-brand-orange-500' : 'border-gray-200'
                          }`}
                        >
                          <img
                            src={process.env.REACT_APP_BACKEND_URL + (photo.premium_enhanced_url || photo.enhanced_url || photo.url)}
                            alt="Thumbnail"
                            className="w-full h-16 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Enhancement options */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Enhancement Type</h3>
                    <div className="space-y-3">
                      {enhancements.filter(e => e.category === 'smart').map(enhancement => {
                        const Icon = enhancement.icon;
                        return (
                          <Card
                            key={enhancement.id}
                            className={`cursor-pointer transition-all ${
                              selectedEnhancement === enhancement.id
                                ? 'border-brand-orange-500 border-2 bg-brand-orange-50'
                                : 'border-gray-200 hover:border-brand-orange-300'
                            }`}
                            onClick={() => setSelectedEnhancement(enhancement.id)}
                          >
                            <CardContent className="p-4 flex items-start gap-3">
                              <Icon className="w-6 h-6 text-brand-orange-500 mt-1" />
                              <div className="flex-1">
                                <h4 className="font-semibold">{enhancement.name}</h4>
                                <p className="text-sm text-gray-600">{enhancement.description}</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    <Button
                      onClick={handleEnhance}
                      disabled={!selectedPhoto || processing}
                      className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                          Enhancing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 w-5 h-5" />
                          Apply Enhancement
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="staging" className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Preview */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Preview</h3>
                    {selectedPhoto && (
                      <div className="border rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={process.env.REACT_APP_BACKEND_URL + currentPhotoUrl}
                          alt="Selected"
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                    
                    {/* Photo selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map(photo => (
                        <div
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo)}
                          className={`cursor-pointer border-2 rounded overflow-hidden ${
                            selectedPhoto?.id === photo.id ? 'border-brand-orange-500' : 'border-gray-200'
                          }`}
                        >
                          <img
                            src={process.env.REACT_APP_BACKEND_URL + (photo.premium_enhanced_url || photo.enhanced_url || photo.url)}
                            alt="Thumbnail"
                            className="w-full h-16 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Staging options */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Staging Type</h3>
                      <div className="space-y-2">
                        {enhancements.filter(e => e.category === 'staging').map(enhancement => {
                          const Icon = enhancement.icon;
                          return (
                            <Card
                              key={enhancement.id}
                              className={`cursor-pointer transition-all ${
                                selectedEnhancement === enhancement.id
                                  ? 'border-brand-orange-500 border-2 bg-brand-orange-50'
                                  : 'border-gray-200 hover:border-brand-orange-300'
                              }`}
                              onClick={() => setSelectedEnhancement(enhancement.id)}
                            >
                              <CardContent className="p-3 flex items-center gap-3">
                                <Icon className="w-5 h-5 text-brand-orange-500" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm">{enhancement.name}</h4>
                                  <p className="text-xs text-gray-600">{enhancement.description}</p>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                    
                    {selectedEnhancement === 'virtual_staging_interior' && (
                      <div>
                        <h3 className="font-semibold mb-3">Style</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {stagingStyles.map(style => (
                            <Card
                              key={style.id}
                              className={`cursor-pointer transition-all ${
                                selectedStyle === style.id
                                  ? 'border-brand-orange-500 border-2 bg-brand-orange-50'
                                  : 'border-gray-200 hover:border-brand-orange-300'
                              }`}
                              onClick={() => setSelectedStyle(style.id)}
                            >
                              <CardContent className="p-3">
                                <h4 className="font-semibold text-sm">{style.name}</h4>
                                <p className="text-xs text-gray-600">{style.desc}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={handleEnhance}
                      disabled={!selectedPhoto || processing}
                      className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                          Staging...
                        </>
                      ) : (
                        <>
                          <Home className="mr-2 w-5 h-5" />
                          Apply Virtual Staging
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => navigate(`/projects/${projectId}/photos`)}
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back to Photos
              </Button>
              <Button
                onClick={() => navigate(`/projects/${projectId}/music`)}
                className="bg-brand-orange-500 hover:bg-brand-orange-600"
              >
                Continue to Music
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PremiumEditing;
