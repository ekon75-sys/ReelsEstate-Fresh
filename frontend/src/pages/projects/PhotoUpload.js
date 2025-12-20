import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Loader2, Sparkles, ArrowRight, GripVertical, Undo2, Home } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Sortable Photo Card Component
const SortablePhotoCard = ({ photo, index, onDelete, onEnhance, onUndoEnhance, onUpdateCaption, enhancing }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [enhanceType, setEnhanceType] = useState('auto');
  const [showEnhanceDialog, setShowEnhanceDialog] = useState(false);

  const handleEnhance = () => {
    onEnhance(photo.id, enhanceType);
    setShowEnhanceDialog(false);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="overflow-hidden">
        <div className="relative aspect-video">
          <img
            src={process.env.REACT_APP_BACKEND_URL + (photo.enhanced_url || photo.original_url)}
            alt={`Photo ${index + 1}`}
            className="w-full h-full object-cover"
          />
          {photo.caption === 'Virtually Staged' && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Home className="w-3 h-3" />
              Staged
            </div>
          )}
          {photo.caption === 'Enhanced' && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Enhanced
            </div>
          )}
          {photo.enhanced && !photo.caption && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Enhanced
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 left-2 bg-white/80 hover:bg-white cursor-move"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-12 left-2 bg-red-500/80 hover:bg-red-600 text-white"
            onClick={() => onDelete(photo.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Caption (optional)</Label>
            <Input
              placeholder="e.g., Spacious living room"
              defaultValue={photo.caption || ''}
              onBlur={(e) => onUpdateCaption(photo.id, e.target.value)}
              className="text-sm"
            />
          </div>
          {photo.enhanced ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onUndoEnhance(photo.id)}
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Undo Enhancement
            </Button>
          ) : (
            <Dialog open={showEnhanceDialog} onOpenChange={setShowEnhanceDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                  disabled={enhancing[photo.id]}
                >
                  {enhancing[photo.id] ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Enhance with AI
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] flex flex-col p-0">
                <div className="p-6 pb-0">
                  <DialogHeader>
                    <DialogTitle>Choose Enhancement Type</DialogTitle>
                    <DialogDescription>
                      Select the type of enhancement you want to apply to this photo
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-3">
                    <button
                      onClick={() => setEnhanceType('auto')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'auto'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">✨ Auto Enhance</div>
                      <div className="text-sm text-gray-600">Balanced enhancement for professional results</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('vibrant')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'vibrant'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">🎨 Vibrant</div>
                      <div className="text-sm text-gray-600">High saturation and vivid colors</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('natural')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'natural'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">🌿 Natural</div>
                      <div className="text-sm text-gray-600">Subtle improvements, authentic look</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('hdr')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'hdr'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">💎 HDR Effect</div>
                      <div className="text-sm text-gray-600">High dynamic range, dramatic look</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('warm')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'warm'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">🌅 Warm Tone</div>
                      <div className="text-sm text-gray-600">Cozy, inviting warm colors</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('cool')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'cool'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">❄️ Cool Tone</div>
                      <div className="text-sm text-gray-600">Modern, crisp cool colors</div>
                    </button>
                    
                    <button
                      onClick={() => setEnhanceType('clarity')}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                        enhanceType === 'clarity'
                          ? 'border-brand-orange-500 bg-brand-orange-50'
                          : 'border-gray-200 hover:border-brand-orange-300'
                      }`}
                    >
                      <div className="font-medium">🔍 Maximum Clarity</div>
                      <div className="text-sm text-gray-600">Ultra-sharp details and sharpness</div>
                    </button>
                  </div>
                </div>
                <div className="sticky bottom-0 bg-white border-t p-4">
                  <Button
                    onClick={handleEnhance}
                    className="w-full bg-brand-orange-500 hover:bg-brand-orange-600"
                  >
                    Apply Enhancement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PhotoUpload = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preloadedProcessed, setPreloadedProcessed] = useState(false);
  const [enhancing, setEnhancing] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPhotos();
    checkForPreloadedPhotos();
  }, [projectId]);

  const checkForPreloadedPhotos = async () => {
    // Check if we already processed preloaded photos for this project
    const processedKey = `preloaded_processed_${projectId}`;
    if (localStorage.getItem(processedKey)) {
      console.log('Preloaded photos already processed for this project, skipping');
      return;
    }
    
    const preloadedPhotos = sessionStorage.getItem('preloadedPhotos');
    if (preloadedPhotos) {
      // Mark as processed immediately in localStorage (persists across remounts)
      localStorage.setItem(processedKey, 'true');
      setPreloadedProcessed(true);
      try {
        const photoData = JSON.parse(preloadedPhotos);
        console.log('Processing preloaded photos:', photoData);
        setUploading(true);
        
        for (let i = 0; i < photoData.length; i++) {
          const photoInfo = photoData[i];
          // Download photo from URL and re-upload to project
          const response = await fetch(process.env.REACT_APP_BACKEND_URL + photoInfo.url);
          const blob = await response.blob();
          
          const formData = new FormData();
          formData.append('file', blob, `photo_${i + 1}_${photoInfo.type}.jpg`);
          formData.append('position', i);
          formData.append('caption', photoInfo.type === 'enhanced' ? 'Enhanced' : (photoInfo.type === 'staged' ? 'Virtually Staged' : ''));
          
          await axios.post(`${API_URL}/projects/${projectId}/photos`, formData, { withCredentials: true });
        }
        
        toast.success(`${photoData.length} photo(s) loaded from enhancement studio!`);
        // Clear sessionStorage immediately to prevent re-processing
        sessionStorage.removeItem('preloadedPhotos');
        await loadPhotos();
      } catch (error) {
        console.error('Failed to load preloaded photos:', error);
        toast.error('Failed to load enhanced photos');
        // Clear sessionStorage even on error to prevent infinite retries
        sessionStorage.removeItem('preloadedPhotos');
      } finally {
        setUploading(false);
      }
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      setPhotos(response.data.photos || []);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        formData.append('position', photos.length + i);
        formData.append('caption', '');

        await axios.post(`${API_URL}/projects/${projectId}/photos`, formData, { withCredentials: true });
      }
      toast.success(`${files.length} photo(s) uploaded!`);
      await loadPhotos();
    } catch (error) {
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleEnhance = async (photoId, enhancementType) => {
    setEnhancing(prev => ({ ...prev, [photoId]: true }));

    try {
      await axios.post(`${API_URL}/projects/${projectId}/photos/${photoId}/enhance`, null, {
        params: { enhancement_type: enhancementType },
        withCredentials: true
      });
      toast.success('Photo enhanced!');
      await loadPhotos();
    } catch (error) {
      toast.error('Enhancement failed');
    } finally {
      setEnhancing(prev => ({ ...prev, [photoId]: false }));
    }
  };

  const handleUndoEnhance = async (photoId) => {
    try {
      await axios.post(`${API_URL}/projects/${projectId}/photos/${photoId}/undo-enhance`);
      toast.success('Enhancement removed');
      await loadPhotos();
    } catch (error) {
      toast.error('Failed to undo enhancement');
    }
  };

  const handleUpdateCaption = async (photoId, caption) => {
    try {
      await axios.put(`${API_URL}/projects/${projectId}/photos/${photoId}`, { caption });
    } catch (error) {
      console.error('Failed to update caption');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await axios.delete(`${API_URL}/projects/${projectId}/photos/${photoId}`);
      toast.success('Photo deleted');
      await loadPhotos();
    } catch (error) {
      toast.error('Failed to delete photo');
      console.error('Delete error:', error);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);

      const newPhotos = arrayMove(photos, oldIndex, newIndex);
      setPhotos(newPhotos);

      // Update positions on backend
      try {
        for (let i = 0; i < newPhotos.length; i++) {
          await axios.put(`${API_URL}/projects/${projectId}/photos/${newPhotos[i].id}`, {
            position: i
          });
        }
      } catch (error) {
        console.error('Failed to update photo positions');
        toast.error('Failed to update photo order');
        // Reload to get correct order
        await loadPhotos();
      }
    }
  };

  const handleContinue = () => {
    if (photos.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }
    navigate(`/projects/${projectId}/music`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
      
      <div className="max-w-6xl mx-auto py-12 px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Upload Property Photos</CardTitle>
            <p className="text-gray-600">Upload photos for your video (recommended: 5-10 photos). Drag to reorder.</p>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> For better results, upload horizontal (landscape) photos. Vertical photos can only be used for vertical video formats.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-orange-500 transition-colors">
              <input
                type="file"
                id="photo-upload"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Click to upload photos</p>
                <p className="text-sm text-gray-500 mt-2">JPG, PNG, or HEIC (max 10MB each)</p>
              </label>
              {uploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-brand-orange-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={photos.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {photos.map((photo, index) => (
                      <SortablePhotoCard
                        key={photo.id}
                        photo={photo}
                        index={index}
                        onDelete={handleDeletePhoto}
                        onEnhance={handleEnhance}
                        onUndoEnhance={handleUndoEnhance}
                        onUpdateCaption={handleUpdateCaption}
                        enhancing={enhancing}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </Button>
              <Button
                className="bg-brand-orange-500 hover:bg-brand-orange-600"
                onClick={handleContinue}
                disabled={photos.length === 0}
                data-testid="continue-to-music-btn"
              >
                Continue to Music Selection
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PhotoUpload;
