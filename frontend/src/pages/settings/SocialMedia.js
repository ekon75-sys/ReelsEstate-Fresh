import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Youtube, Instagram, Facebook, Linkedin, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const SocialMediaSettings = () => {
  const [connections, setConnections] = useState({
    youtube: false,
    instagram: false,
    facebook: false,
    linkedin: false,
    tiktok: false
  });
  const [connecting, setConnecting] = useState({
    youtube: false,
    instagram: false,
    facebook: false,
    linkedin: false,
    tiktok: false
  });
  const [loading, setLoading] = useState(true);
  const [disconnectDialog, setDisconnectDialog] = useState({ show: false, platform: null });
  const [pageSelectionDialog, setPageSelectionDialog] = useState({ show: false, pages: [], selectedPage: null });

  useEffect(() => {
    checkAllConnections();
  }, []);

  const checkAllConnections = async () => {
    try {
      const token = localStorage.getItem('token');
      const [youtube, instagram, facebook, linkedin, tiktok, twitter] = await Promise.all([
        axios.get(`${API_URL}/auth/youtube/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/instagram/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/facebook/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/linkedin/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/auth/tiktok/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { connected: false } })),
        axios.get(`${API_URL}/auth/twitter/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { connected: false } }))
      ]);

      setConnections({
        youtube: youtube.data.connected,
        instagram: instagram.data.connected,
        facebook: facebook.data.connected,
        linkedin: linkedin.data.connected,
        tiktok: tiktok.data.connected,
        twitter: twitter.data.connected
      });
    } catch (error) {
      console.error('Failed to check connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform) => {
    setConnecting(prev => ({ ...prev, [platform]: true }));

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/${platform}/authorize`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Open OAuth popup
      const authWindow = window.open(
        response.data.auth_url,
        `${platform} Authorization`,
        'width=600,height=700'
      );

      // Poll for connection status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/auth/${platform}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (statusResponse.data.connected) {
            setConnections(prev => ({ ...prev, [platform]: true }));
            clearInterval(pollInterval);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`);
            setConnecting(prev => ({ ...prev, [platform]: false }));
            
            // For LinkedIn, show page selection dialog
            if (platform === 'linkedin') {
              await showLinkedInPageSelection();
            }
          }
        } catch (error) {
          console.error(`Failed to poll ${platform} status:`, error);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnecting(prev => ({ ...prev, [platform]: false }));
      }, 300000);

    } catch (error) {
      toast.error(`Failed to connect ${platform}`);
      setConnecting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const showDisconnectDialog = (platform) => {
    setDisconnectDialog({ show: true, platform });
  };

  const closeDisconnectDialog = () => {
    setDisconnectDialog({ show: false, platform: null });
  };

  const showLinkedInPageSelection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/auth/linkedin/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPageSelectionDialog({
        show: true,
        pages: response.data.pages,
        selectedPage: response.data.selected
      });
    } catch (error) {
      console.error('Failed to get LinkedIn pages:', error);
      toast.error('Failed to load LinkedIn pages');
    }
  };

  const handleSelectPage = async (pageUrn) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/auth/linkedin/select-page`, 
        { page_urn: pageUrn },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      setPageSelectionDialog({ show: false, pages: [], selectedPage: null });
      toast.success('LinkedIn page selected successfully!');
    } catch (error) {
      console.error('Failed to select page:', error);
      toast.error('Failed to select LinkedIn page');
    }
  };

  const handleDisconnect = async () => {
    const platform = disconnectDialog.platform;
    if (!platform) return;

    try {
      const token = localStorage.getItem('token');
      console.log(`Disconnecting ${platform}...`);
      
      const response = await axios.delete(`${API_URL}/auth/${platform}/disconnect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`Disconnect response:`, response.data);

      setConnections(prev => ({ ...prev, [platform]: false }));
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} disconnected!`);
      
      // Refresh all connections to ensure state is accurate
      await checkAllConnections();
    } catch (error) {
      console.error(`Disconnect error for ${platform}:`, error);
      toast.error(`Failed to disconnect ${platform}: ${error.response?.data?.detail || error.message}`);
    } finally {
      closeDisconnectDialog();
    }
  };

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
      description: 'Post videos to your Facebook page or profile'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-500',
      description: 'Share videos to your Instagram feed and reels'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      description: 'Upload videos directly to your YouTube channel'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      color: 'text-black',
      bgColor: 'bg-gray-50',
      borderColor: 'border-black',
      description: 'Share short-form property videos on TikTok'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-700',
      description: 'Share professional property videos on LinkedIn'
    },
    {
      id: 'twitter',
      name: 'Twitter',
      logo: () => (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'text-sky-500',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-500',
      description: 'Post property videos on Twitter/X'
    }
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading connections...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* LinkedIn Page Selection Dialog */}
      {pageSelectionDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select LinkedIn Page
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose where you want to post your videos
            </p>
            <div className="space-y-2">
              {pageSelectionDialog.pages.map(page => (
                <button
                  key={page.urn}
                  onClick={() => handleSelectPage(page.urn)}
                  className={`w-full text-left p-3 border-2 rounded-lg hover:bg-blue-50 transition-colors ${
                    pageSelectionDialog.selectedPage === page.urn
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium">{page.name}</div>
                  {page.type === 'organization' && (
                    <div className="text-xs text-gray-500 mt-1">Organization • {page.role}</div>
                  )}
                  {page.type === 'personal' && (
                    <div className="text-xs text-gray-500 mt-1">Personal Profile</div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setPageSelectionDialog({ show: false, pages: [], selectedPage: null })}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      {disconnectDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Disconnect {disconnectDialog.platform?.charAt(0).toUpperCase() + disconnectDialog.platform?.slice(1)}?
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to disconnect your {disconnectDialog.platform} account? You'll need to reconnect to upload videos to this platform.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={closeDisconnectDialog}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisconnect}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Social Media Connections</CardTitle>
          <CardDescription>
            Connect your social media accounts to share videos directly from ReelsEstate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {platforms.map(platform => {
          const isConnected = connections[platform.id];
          const isConnecting = connecting[platform.id];

          return (
            <div
              key={platform.id}
              className={`flex flex-col md:flex-row md:items-center md:justify-between p-4 border-2 rounded-lg transition-all gap-4 ${
                isConnected
                  ? `${platform.borderColor} ${platform.bgColor}`
                  : 'border-gray-200 hover:border-brand-orange-300'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`p-3 rounded-full ${platform.bgColor} flex-shrink-0`}>
                  <div className={platform.color}>
                    {platform.logo()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{platform.name}</h3>
                    {isConnected && (
                      <div className="flex items-center gap-1 text-green-600 text-sm whitespace-nowrap">
                        <Check className="w-4 h-4" />
                        <span className="font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{platform.description}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                {isConnected && platform.id === 'linkedin' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showLinkedInPageSelection()}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full sm:w-auto"
                  >
                    Change Page
                  </Button>
                )}
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showDisconnectDialog(platform.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                    className="bg-brand-orange-500 hover:bg-brand-orange-600 w-full sm:w-auto"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Connect your social media accounts here once, and you'll be able to share videos directly when generating them. All connections are secure and use OAuth 2.0 authentication.
          </p>
        </div>
      </CardContent>
    </Card>
    </>
  );
};

export default SocialMediaSettings;
