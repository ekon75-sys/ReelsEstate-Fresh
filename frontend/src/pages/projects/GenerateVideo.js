import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download, ArrowLeft, Video, Share2, Home } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const GenerateVideo = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('16:9');
  const [videos, setVideos] = useState([]);
  const [project, setProject] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [socialDialog, setSocialDialog] = useState({ open: false, video: null });
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [caption, setCaption] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoTags, setVideoTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [connectingYouTube, setConnectingYouTube] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [connectingInstagram, setConnectingInstagram] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [connectingLinkedin, setConnectingLinkedin] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [alteredContent, setAlteredContent] = useState(false); // Default: No
  const [remixOption, setRemixOption] = useState('audio'); // Default: audio only

  useEffect(() => {
    loadProject();
    loadVideos();
    checkYouTubeConnection();
    checkInstagramConnection();
    checkFacebookConnection();
    checkLinkedInConnection();
  }, [projectId]);

  const checkYouTubeConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/youtube/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setYoutubeConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check YouTube connection:', error);
    }
  };

  const checkInstagramConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/instagram/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInstagramConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check Instagram connection:', error);
    }
  };

  const checkFacebookConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/facebook/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFacebookConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check Facebook connection:', error);
    }
  };

  const checkLinkedInConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/linkedin/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLinkedinConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to check LinkedIn connection:', error);
    }
  };

  const handleConnectYouTube = async () => {
    setConnectingYouTube(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/youtube/authorize`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Open OAuth URL in a new window
      const authWindow = window.open(
        response.data.auth_url,
        'YouTube Authorization',
        'width=600,height=700'
      );
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/auth/youtube/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (statusResponse.data.connected) {
            setYoutubeConnected(true);
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            toast.success('YouTube connected successfully!');
            setConnectingYouTube(false);
          }
        } catch (error) {
          console.error('Failed to poll YouTube status:', error);
        }
      }, 2000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnectingYouTube(false);
      }, 300000);
      
    } catch (error) {
      toast.error('Failed to connect YouTube');
      setConnectingYouTube(false);
    }
  };

  const handleConnectInstagram = async () => {
    setConnectingInstagram(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/instagram/authorize`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Open OAuth popup
      const authWindow = window.open(response.data.auth_url, 'Instagram Authorization', 'width=600,height=700');
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/auth/instagram/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (statusResponse.data.connected) {
            setInstagramConnected(true);
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            toast.success('Instagram connected successfully!');
            setConnectingInstagram(false);
          }
        } catch (error) {
          console.error('Failed to poll Instagram status:', error);
        }
      }, 2000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnectingInstagram(false);
      }, 300000);
      
    } catch (error) {
      toast.error('Failed to connect Instagram');
      setConnectingInstagram(false);
    }
  };

  const handleConnectFacebook = async () => {
    setConnectingFacebook(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/facebook/authorize`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Open OAuth popup
      const authWindow = window.open(response.data.auth_url, 'Facebook Authorization', 'width=600,height=700');
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/auth/facebook/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (statusResponse.data.connected) {
            setFacebookConnected(true);
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            toast.success('Facebook connected successfully!');
            setConnectingFacebook(false);
          }
        } catch (error) {
          console.error('Failed to poll Facebook status:', error);
        }
      }, 2000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnectingFacebook(false);
      }, 300000);
      
    } catch (error) {
      toast.error('Failed to connect Facebook');
      setConnectingFacebook(false);
    }
  };

  const handleConnectLinkedIn = async () => {
    setConnectingLinkedin(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/linkedin/authorize`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Open OAuth popup
      const authWindow = window.open(response.data.auth_url, 'LinkedIn Authorization', 'width=600,height=700');
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/auth/linkedin/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (statusResponse.data.connected) {
            setLinkedinConnected(true);
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            toast.success('LinkedIn connected successfully!');
            setConnectingLinkedin(false);
          }
        } catch (error) {
          console.error('Failed to poll LinkedIn status:', error);
        }
      }, 2000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnectingLinkedin(false);
      }, 300000);
      
    } catch (error) {
      toast.error('Failed to connect LinkedIn');
      setConnectingLinkedin(false);
    }
  };

  const handleGenerateMetadata = async () => {
    if (!socialDialog.video) return;
    
    setGeneratingMetadata(true);
    toast.info('Analyzing video with AI... This may take a moment.');
    
    try {
      const filename = socialDialog.video.file_url.split('/').pop();
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/social-media/generate-metadata`,
        { video_filename: filename },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setVideoTitle(response.data.title);
      setVideoDescription(response.data.description);
      setVideoTags(response.data.tags);
      
      toast.success('Metadata generated successfully!');
    } catch (error) {
      console.error('Failed to generate metadata:', error);
      toast.error('Failed to generate metadata: ' + (error.response?.data?.detail || error.message));
    } finally {
      setGeneratingMetadata(false);
    }
  };

  const loadProject = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      setProject(response.data);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}/videos`, { withCredentials: true });
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      await axios.post(`${API_URL}/projects/${projectId}/generate-video`, null, {
        params: { format_type: selectedFormat }
      });
      toast.success('Video generated successfully!');
      await loadVideos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Video generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (videoUrl) => {
    // Simply open the video URL directly - same as what video player uses
    const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${videoUrl}`;
    window.open(fullUrl, '_blank');
    toast.info('Opening video - use your browser\'s download option (right-click → Save as)');
  };

  const handleSocialUpload = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }
    
    // For YouTube, require title
    if (selectedPlatforms.includes('youtube')) {
      if (!videoTitle.trim()) {
        toast.error('Please add a title for YouTube');
        return;
      }
      if (!videoDescription.trim()) {
        toast.error('Please add a description for YouTube');
        return;
      }
    }
    
    // For Instagram/Facebook, require caption
    if ((selectedPlatforms.includes('instagram') || selectedPlatforms.includes('facebook')) && !caption.trim()) {
      toast.error('Please add a caption');
      return;
    }

    setUploading(true);
    
    // Show YouTube Studio reminder if YouTube is selected
    if (selectedPlatforms.includes('youtube')) {
      toast.info('⚠️ Remember to check your video settings in YouTube Studio after upload (remixing, visibility, etc.)', { duration: 8000 });
    }
    
    try {
      const filename = socialDialog.video.file_url.split('/').pop();
      
      const response = await axios.post(`${API_URL}/social-media/upload`, {
        video_filename: filename,
        platforms: selectedPlatforms,
        caption: caption,
        title: videoTitle,
        description: videoDescription,
        tags: videoTags,
        altered_content: alteredContent,
        remix_option: remixOption,
        video_format: socialDialog.video.format
      });

      toast.success(`Upload completed! ${response.data.summary.successful}/${response.data.summary.total_platforms} platforms successful`);
      
      // Show details
      if (response.data.results.successes.length > 0) {
        response.data.results.successes.forEach(success => {
          toast.success(`✓ ${success.platform}: ${success.message}`);
        });
      }
      if (response.data.results.failures.length > 0) {
        response.data.results.failures.forEach(failure => {
          toast.error(`✗ ${failure.platform}: ${failure.message || failure.error}`);
        });
      }

      // Reset and close dialog
      setSocialDialog({ open: false, video: null });
      setSelectedPlatforms([]);
      setCaption('');
      setVideoTitle('');
      setVideoDescription('');
      setVideoTags('');
      setAlteredContent(false);
      setRemixOption('audio');
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  const formats = [
    { value: '16:9', label: 'Horizontal (16:9)', desc: 'YouTube, Facebook, Website' },
    { value: '9:16', label: 'Vertical (9:16)', desc: 'Instagram Reels, TikTok, Stories' },
    { value: '1:1', label: 'Square (1:1)', desc: 'Instagram Feed, LinkedIn' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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
      
      <div className="max-w-5xl mx-auto py-12 px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Generate Video</CardTitle>
            <p className="text-gray-600">Select format and generate your property video</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Select Video Format</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {formats.map(format => (
                  <Card
                    key={format.value}
                    className={`cursor-pointer transition-all ${
                      selectedFormat === format.value
                        ? 'border-brand-orange-500 border-2 bg-brand-orange-50'
                        : 'border-gray-200 hover:border-brand-orange-300'
                    }`}
                    onClick={() => setSelectedFormat(format.value)}
                    data-testid={`format-${format.value}`}
                  >
                    <CardContent className="p-6">
                      <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                        <Video className="w-12 h-12 text-gray-400" />
                      </div>
                      <h4 className="font-semibold mb-1">{format.label}</h4>
                      <p className="text-sm text-gray-500">{format.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <Button
              className="w-full bg-brand-orange-500 hover:bg-brand-orange-600 py-6 text-base sm:text-lg min-h-[72px]"
              onClick={handleGenerate}
              disabled={generating}
              data-testid="generate-video-btn"
            >
              {generating ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin flex-shrink-0" />
                    <span>Generating Video...</span>
                  </div>
                  <span className="text-sm">(This may take 1-2 minutes)</span>
                </div>
              ) : (
                <>
                  <Video className="mr-2 w-6 h-6" />
                  Generate Video
                </>
              )}
            </Button>

            {/* Generated Videos */}
            {videos.length > 0 && (
              <div className="space-y-4 pt-6 border-t">
                <h3 className="font-semibold text-lg">Generated Videos</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {videos.map(video => (
                    <Card key={video.id}>
                      <CardContent className="p-4">
                        <div className="aspect-video bg-black rounded mb-3">
                          <video
                            src={process.env.REACT_APP_BACKEND_URL + video.file_url}
                            controls
                            className="w-full h-full"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{video.format}</p>
                              <p className="text-sm text-gray-500">Use video controls (⋮) to download</p>
                            </div>
                            <button
                            onClick={async () => {
                              try {
                                setDownloading(video.id);
                                const downloadUrl = process.env.REACT_APP_BACKEND_URL + video.file_url + '/download';
                                const filename = `${project?.title?.replace(/[^a-z0-9]/gi, '_') || 'video'}_${video.format}.mp4`;
                                
                                console.log('Download URL:', downloadUrl);
                                console.log('Filename:', filename);
                                
                                // Fetch as blob to handle CORS properly
                                console.log('Fetching video...');
                                const response = await fetch(downloadUrl);
                                console.log('Response status:', response.status);
                                
                                if (!response.ok) {
                                  throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                
                                const blob = await response.blob();
                                console.log('Blob size:', blob.size);
                                
                                // Create object URL and open in new tab (works in sandboxed iframes)
                                const blobUrl = URL.createObjectURL(blob);
                                console.log('Blob URL created:', blobUrl);
                                
                                // Open in new window - this bypasses sandbox download restrictions
                                window.open(blobUrl, '_blank');
                                
                                // Clean up the blob URL after a delay
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                                
                                toast.success('Video opened in new tab - use browser download (Ctrl+S or ⋮ menu)');
                              } catch (error) {
                                console.error('Download error:', error);
                                toast.error(`Download failed: ${error.message}`);
                              } finally {
                                setDownloading(null);
                              }
                            }}
                            disabled={downloading === video.id}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-orange-500 rounded-md hover:bg-brand-orange-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Click to download"
                          >
                            {downloading === video.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Opening...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Open & Download
                              </>
                            )}
                          </button>
                          </div>
                          
                          {/* Social Media Upload Button */}
                          <Button
                            onClick={() => setSocialDialog({ open: true, video })}
                            className="w-full bg-brand-orange-500 hover:bg-brand-orange-600 text-white"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share to Social Media
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => navigate(`/projects/${projectId}/configure`)}
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back to Configuration
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Social Media Upload Dialog */}
      <Dialog open={socialDialog.open} onOpenChange={(open) => setSocialDialog({ open, video: null })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share to Social Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">Select platforms:</p>
              <div className="space-y-2">
                {['instagram', 'youtube', 'facebook', 'linkedin'].map(platform => {
                  const isYouTube = platform === 'youtube';
                  const isInstagram = platform === 'instagram';
                  const isFacebook = platform === 'facebook';
                  const isLinkedIn = platform === 'linkedin';
                  
                  const isConnected = isYouTube ? youtubeConnected : 
                                    isInstagram ? instagramConnected : 
                                    isFacebook ? facebookConnected : 
                                    linkedinConnected;
                  const isConnecting = isYouTube ? connectingYouTube : 
                                      isInstagram ? connectingInstagram : 
                                      isFacebook ? connectingFacebook : 
                                      connectingLinkedin;
                  const needsConnection = !isConnected;
                  
                  return (
                    <div key={platform}>
                      <label className={`flex items-center gap-3 p-3 border rounded-lg ${needsConnection ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(platform)}
                          onChange={(e) => {
                            if (needsConnection) {
                              return; // Don't allow selection if not connected
                            }
                            if (e.target.checked) {
                              setSelectedPlatforms([...selectedPlatforms, platform]);
                            } else {
                              setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                            }
                          }}
                          disabled={needsConnection}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="capitalize font-medium">{platform}</span>
                          {!isConnected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isYouTube) handleConnectYouTube();
                                else if (isInstagram) handleConnectInstagram();
                                else if (isFacebook) handleConnectFacebook();
                                else if (isLinkedIn) handleConnectLinkedIn();
                              }}
                              disabled={isConnecting}
                              className="text-xs"
                            >
                              {isConnecting ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Connecting...
                                </>
                              ) : (
                                'Connect'
                              )}
                            </Button>
                          )}
                          {isConnected && (
                            <span className="text-xs text-green-600 font-medium">✓ Connected</span>
                          )}
                        </div>
                      </label>
                      {(platform === 'instagram' || platform === 'facebook' || platform === 'linkedin') && !isConnected && (
                        <p className="text-xs text-gray-500 ml-10 mt-1">Mock mode enabled - connect to use real uploads</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* YouTube Fields */}
            {selectedPlatforms.includes('youtube') && (
              <div className="space-y-3 border-l-4 border-red-500 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">📺 YouTube Details</p>
                  {/* AI Generator - Only for Ultimate plan or trial users */}
                  {(!user?.subscription_plan || user?.subscription_plan === 'ai_caption' || user?.subscription_plan === 'ultimate' || user?.trialActive || user?.trial_active) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateMetadata}
                      disabled={generatingMetadata}
                      className="text-xs bg-purple-50 hover:bg-purple-100 border-purple-300"
                    >
                      {generatingMetadata ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          ✨ Generate with AI
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Title: *</label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Enter video title (max 100 characters)"
                    maxLength={100}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{videoTitle.length}/100 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description: *</label>
                  <textarea
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    placeholder="Enter video description..."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags:</label>
                  <input
                    type="text"
                    value={videoTags}
                    onChange={(e) => setVideoTags(e.target.value)}
                    placeholder="Enter tags separated by commas (e.g., real estate, property, home)"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
                </div>

                {/* Altered Content Disclosure */}
                <div className="border-t pt-3">
                  <label className="block text-sm font-medium mb-2">Altered Content</label>
                  <p className="text-xs text-gray-600 mb-2">
                    Does your content show a realistic altered person, place or events?
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alteredContent"
                        checked={!alteredContent}
                        onChange={() => setAlteredContent(false)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">No</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alteredContent"
                        checked={alteredContent}
                        onChange={() => setAlteredContent(true)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                    ✓ Thumbnail will be auto-generated from video at 7 seconds
                  </div>
                  {socialDialog.video?.format === '9:16' && (
                    <div className="bg-purple-50 p-2 rounded text-xs text-purple-700">
                      📱 This vertical video will be uploaded as YouTube Shorts
                    </div>
                  )}
                  {(socialDialog.video?.format === '16:9' || socialDialog.video?.format === '1:1') && (
                    <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
                      🎬 This video will be uploaded as a regular YouTube video
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instagram/Facebook Caption */}
            {(selectedPlatforms.includes('instagram') || selectedPlatforms.includes('facebook')) && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Caption:</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption for Instagram/Facebook..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <p className="font-medium text-blue-900 mb-1">ℹ️ Platform Status</p>
              <p className="text-blue-700">• YouTube: {youtubeConnected ? '✓ Connected and ready for upload' : '○ Not connected'}</p>
              <p className="text-blue-700">• Instagram: {instagramConnected ? '✓ Connected (mock mode)' : '○ Not connected (mock mode)'}</p>
              <p className="text-blue-700">• Facebook: {facebookConnected ? '✓ Connected (mock mode)' : '○ Not connected (mock mode)'}</p>
              <p className="text-blue-700">• LinkedIn: {linkedinConnected ? '✓ Connected (mock mode)' : '○ Not connected (mock mode)'}</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setSocialDialog({ open: false, video: null });
                  setSelectedPlatforms([]);
                  setCaption('');
                  setVideoTitle('');
                  setVideoDescription('');
                  setVideoTags('');
                  setAlteredContent(false);
                  setRemixOption('audio');
                }}
                variant="outline"
                className="flex-1"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSocialUpload}
                className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600 text-white"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateVideo;