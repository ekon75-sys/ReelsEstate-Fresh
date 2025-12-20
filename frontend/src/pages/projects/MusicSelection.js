import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, ArrowLeft, Music, X, Loader2, Check, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Royalty-free music library
const FREE_MUSIC_LIBRARY = [
  {
    id: 'upbeat-1',
    name: 'Upbeat Corporate',
    duration: '2:30',
    mood: 'Energetic',
    description: 'Perfect for modern property showcases',
    url: 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3'
  },
  {
    id: 'calm-1',
    name: 'Calm Ambient',
    duration: '3:00',
    mood: 'Relaxing',
    description: 'Great for luxury properties',
    url: 'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3'
  },
  {
    id: 'modern-1',
    name: 'Modern Tech',
    duration: '2:45',
    mood: 'Professional',
    description: 'Ideal for commercial real estate',
    url: 'https://www.bensound.com/bensound-music/bensound-sunny.mp3'
  },
  {
    id: 'elegant-1',
    name: 'Elegant Piano',
    duration: '2:20',
    mood: 'Sophisticated',
    description: 'Best for high-end listings',
    url: 'https://www.bensound.com/bensound-music/bensound-slowmotion.mp3'
  }
];

const MusicSelection = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [musicFile, setMusicFile] = useState(null);
  const [musicUrl, setMusicUrl] = useState('');
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [selectedFreeTrack, setSelectedFreeTrack] = useState(null);
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const audioRefs = useRef({});

  useEffect(() => {
    loadProjectMusic();
  }, [projectId]);

  const loadProjectMusic = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      if (response.data.music_url) {
        setMusicUrl(response.data.music_url);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleMusicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      toast.error('Please upload an MP3, WAV, OGG, or M4A audio file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploadingMusic(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/projects/${projectId}/upload-music`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMusicUrl(response.data.music_url);
      setMusicFile(file);
      setSelectedFreeTrack(null);
      toast.success('Music uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload music');
      console.error('Music upload error:', error);
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleSelectFreeTrack = async (track) => {
    setUploadingMusic(true);
    try {
      // Instead of downloading on frontend, just store the URL
      // Backend will download it during video generation
      await axios.put(`${API_URL}/projects/${projectId}`, { 
        music_url: track.url  // Store the direct URL
      });
      
      setMusicUrl(track.url);
      setSelectedFreeTrack(track);
      setMusicFile(null);
      toast.success(`"${track.name}" selected!`);
    } catch (error) {
      toast.error('Failed to select music');
      console.error('Free music selection error:', error);
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleRemoveMusic = async () => {
    try {
      await axios.put(`${API_URL}/projects/${projectId}`, { music_url: null });
      setMusicUrl('');
      setMusicFile(null);
      setSelectedFreeTrack(null);
      toast.success('Music removed');
    } catch (error) {
      toast.error('Failed to remove music');
    }
  };

  const handlePlayPreview = (trackId, e) => {
    e.stopPropagation(); // Prevent card click
    
    // Stop any currently playing audio
    Object.keys(audioRefs.current).forEach(id => {
      if (id !== trackId && audioRefs.current[id]) {
        audioRefs.current[id].pause();
        audioRefs.current[id].currentTime = 0;
      }
    });

    const audio = audioRefs.current[trackId];
    if (audio) {
      if (playingTrackId === trackId) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingTrackId(null);
      } else {
        audio.play();
        setPlayingTrackId(trackId);
      }
    }
  };

  const setAudioRef = (trackId, element) => {
    if (element && !audioRefs.current[trackId]) {
      audioRefs.current[trackId] = element;
      
      // Add event listener for when audio ends
      element.addEventListener('ended', () => {
        setPlayingTrackId(null);
      });
    }
  };

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
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto py-12 px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Add Background Music</CardTitle>
            <p className="text-gray-600">Choose from free music library or upload your own</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {musicUrl ? (
              <div className="border-2 border-green-300 bg-green-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-500 p-3 rounded-full">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedFreeTrack ? selectedFreeTrack.name : musicFile ? musicFile.name : 'Music uploaded'}
                      </p>
                      <p className="text-sm text-gray-600">Ready for video generation</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveMusic}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="free" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="free">Free Music Library</TabsTrigger>
                  <TabsTrigger value="upload">Upload Your Own</TabsTrigger>
                </TabsList>
                
                <TabsContent value="free" className="space-y-4 mt-6">
                  {uploadingMusic ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-12 h-12 text-brand-orange-500 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600">Loading music...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {FREE_MUSIC_LIBRARY.map((track) => (
                        <Card key={track.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-brand-orange-100 p-3 rounded-lg flex-shrink-0">
                                <Music className="w-6 h-6 text-brand-orange-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 truncate">{track.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">{track.description}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{track.mood}</span>
                                  <span className="text-xs text-gray-500">{track.duration}</span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => handlePlayPreview(track.id, e)}
                                    className="flex-1"
                                  >
                                    {playingTrackId === track.id ? (
                                      <>
                                        <Pause className="w-4 h-4 mr-2" />
                                        Pause
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-4 h-4 mr-2" />
                                        Preview
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectFreeTrack(track)}
                                    className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600"
                                  >
                                    Select
                                  </Button>
                                </div>
                                {/* Hidden audio element */}
                                <audio
                                  ref={(el) => setAudioRef(track.id, el)}
                                  src={track.url}
                                  preload="none"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">ℹ️ Note:</span> All tracks are royalty-free from Bensound.com. Perfect for real estate videos!
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="mt-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-brand-orange-400 transition-colors">
                    <input
                      type="file"
                      id="music-upload"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
                      onChange={handleMusicUpload}
                      className="hidden"
                      disabled={uploadingMusic}
                    />
                    <label htmlFor="music-upload" className="cursor-pointer">
                      {uploadingMusic ? (
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-16 h-16 text-brand-orange-500 animate-spin" />
                          <p className="text-lg font-medium text-gray-700">Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <div className="bg-brand-orange-100 p-6 rounded-full">
                            <Music className="w-12 h-12 text-brand-orange-500" />
                          </div>
                          <div>
                            <p className="text-lg font-medium text-gray-700">Click to upload your music</p>
                            <p className="text-sm text-gray-500 mt-2">MP3, WAV, OGG, or M4A (max 50MB)</p>
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">⚠️ Copyright:</span> Make sure you have rights to use the music. We recommend royalty-free tracks.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex flex-col md:flex-row justify-between gap-3 pt-6 border-t">
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/upload`)} className="w-full md:w-auto">
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back to Photos
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/configure`)} className="w-full sm:w-auto">
                  Skip (No Music)
                </Button>
                <Button className="bg-brand-orange-500 hover:bg-brand-orange-600 w-full sm:w-auto" onClick={() => navigate(`/projects/${projectId}/configure`)}>
                  Continue
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MusicSelection;
