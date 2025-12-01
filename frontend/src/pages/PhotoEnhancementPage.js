import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, ArrowRight, Upload, Sparkles, Home, Download, X, Video, Sun, Image as ImageIcon, Sliders, Lock, Settings, LogOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PhotoEnhancementPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(null);
  const [enhancementDialog, setEnhancementDialog] = useState({ open: false, type: null, photo: null });
  const [selectedSkyType, setSelectedSkyType] = useState('clear_blue');
  const [stagingDialog, setStagingDialog] = useState({ open: false, photo: null, category: null, roomType: null, style: null });
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render

  useEffect(() => { checkPremiumAccess(); }, []);

  const checkPremiumAccess = async () => {
    try {
      const response = await axios.get(`${API_URL}/premium-features/check-access`);
      setHasAccess(response.data.has_access);
      setTrialActive(response.data.trial_active || false);
    } catch (error) {
      console.error('Access check failed:', error);
    }
  };

  // Tiered access control for lighting enhancements
  const getUserPlan = () => {
    // TEMPORARILY: Give everyone full access for testing
    return 'ai_caption';
  };

  const isFeatureAvailable = (featureTier) => {
    // TEMPORARILY: Everyone has full access
    return true;
  };

  const getUpgradeMessage = (featureTier) => {
    const userPlan = getUserPlan();
    
    if (featureTier === 'professional' && (userPlan === 'basic')) {
      return 'Upgrade to Professional plan to unlock this feature';
    } else if (featureTier === 'enterprise' && (userPlan === 'basic' || userPlan === 'professional')) {
      return 'Upgrade to Enterprise plan to unlock this feature';
    } else if (featureTier === 'ai_caption') {
      return 'Upgrade to Ultimate plan to unlock this feature';
    }
    return 'Upgrade your plan to unlock this feature';
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    const uploadedPhotos = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_URL}/photos/upload-temp`, formData);
        uploadedPhotos.push({ id: Date.now() + Math.random(), url: response.data.url, filename: file.name, enhanced: false, staged: false });
      }
      setPhotos([...photos, ...uploadedPhotos]);
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (photoId) => setPhotos(photos.filter(p => p.id !== photoId));

  const handleUndoEnhancement = (photo) => {
    const updatedPhotos = photos.map(p => p.id === photo.id ? { ...p, enhanced_url: null, enhanced: false, enhancement_type: null } : p);
    setPhotos(updatedPhotos);
    toast.success('Enhancement removed');
  };

  const handleUndoStaging = (photo) => {
    const updatedPhotos = photos.map(p => p.id === photo.id ? { ...p, staged_url: null, staged: false, staging_info: null } : p);
    setPhotos(updatedPhotos);
    toast.success('Staging removed');
  };

  // Map enhancement types to their required tier
  const getEnhancementTier = (enhancementType) => {
    // Lighting & Color - Professional
    const basicAdjustments = ['enhance_brightness', 'adjust_contrast', 'boost_exposure', 'recover_highlights', 'recover_shadows'];
    const colorBalance = ['white_balance_correction', 'temperature_adjustment', 'vibrance_boost', 'saturation_control', 'tint_adjustment'];
    
    // Lighting & Color - Enterprise
    const realEstate = ['natural_light_simulation', 'window_view_enhancement', 'sky_brightness_sync', 'color_cast_removal', 'golden_hour_glow'];
    
    // Lighting & Color - AI Caption
    const professionalPolish = ['hdr_enhancement', 'smart_auto_tone', 'preset_bright_airy', 'preset_warm_cozy', 'preset_luxury_gloss', 'preset_modern_neutral', 'preset_cool_minimalist'];
    const advancedControls = ['highlight_rolloff', 'local_adjustment_brush', 'color_grading', 'ai_lighting_correction'];

    // Sharpening - Professional
    const coreSharpening = ['improve_clarity', 'sharpen_details', 'texture_boost', 'micro_contrast', 'edge_definition'];
    
    // Sharpening - Enterprise
    const realEstateSharpening = ['architectural_detail', 'landscape_sharpness', 'interior_texture', 'window_glass_clarity', 'floor_surface'];
    
    // Sharpening - AI Caption
    const aiAssistedSharpening = ['ai_smart_sharpen', 'ai_structure_recovery', 'focus_restoration', 'noise_aware_sharpening'];
    const creativeSharpening = ['soft_sharpen', 'hd_mode', 'dehaze', 'fine_detail_recovery', 'surface_smooth_edge_sharp'];

    // Professional tier
    if (basicAdjustments.includes(enhancementType) || colorBalance.includes(enhancementType) || coreSharpening.includes(enhancementType)) {
      return 'professional';
    } 
    // Enterprise tier
    else if (realEstate.includes(enhancementType) || realEstateSharpening.includes(enhancementType)) {
      return 'enterprise';
    } 
    // AI Caption tier
    else if (professionalPolish.includes(enhancementType) || advancedControls.includes(enhancementType) || 
             aiAssistedSharpening.includes(enhancementType) || creativeSharpening.includes(enhancementType)) {
      return 'ai_caption';
    }
    return 'professional'; // Default
  };

  const handleEnhance = async (photo, enhancementType, additionalParams = {}, requiredTier = null) => {
    // Check tier access
    const tier = requiredTier || getEnhancementTier(enhancementType);
    if (!isFeatureAvailable(tier)) {
      toast.error(getUpgradeMessage(tier));
      return;
    }

    if (!hasAccess) {
      toast.error('Premium features require Professional, Enterprise, or Ultimate subscription');
      return;
    }
    
    setProcessingPhoto(photo.id);
    try {
      console.log('Enhancing photo:', { photo_url: photo.enhanced_url || photo.url, enhancement_type: enhancementType, additionalParams });
      const response = await axios.post(`${API_URL}/photos/enhance-standalone`, {
        photo_url: photo.enhanced_url || photo.url,
        enhancement_type: enhancementType,
        ...additionalParams
      });
      console.log('Enhancement response:', response.data);
      
      if (!response.data.enhanced_url) {
        toast.error('Enhancement failed: No enhanced image returned');
        return;
      }
      
      // Instead of updating state, completely reload photos to force fresh images
      console.log('Enhancement response:', response.data);
      
      // Update the specific photo in state - preserve original URL for undo functionality
      const updatedPhotos = photos.map(p => p.id === photo.id ? { 
        ...p, 
        enhanced_url: response.data.enhanced_url, 
        enhanced: true,
        enhancement_type: enhancementType,
        timestamp: Date.now() // Add timestamp to force image refresh
      } : p);
      
      // Clear photos and set new array to force complete re-render
      setPhotos([]);
      setTimeout(() => {
        setPhotos(updatedPhotos);
        setRefreshKey(prev => prev + 1);
      }, 100);
      
      toast.success('Enhancement completed! Image updated.');
      setEnhancementDialog({ open: false, type: null, photo: null });
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error.response?.data?.detail || 'Enhancement failed');
    } finally {
      setProcessingPhoto(null);
    }
  };

  const handleStaging = async (photo, roomType, style) => {
    if (!hasAccess) {
      toast.error('Premium features require Professional, Enterprise, or Ultimate subscription');
      return;
    }
    setProcessingPhoto(photo.id);
    try {
      const photoUrl = photo.enhanced_url || photo.url;
      console.log('Staging photo:', { photo_url: photoUrl, enhancement_type: 'virtual_staging_interior', style, room_type: roomType });
      const response = await axios.post(`${API_URL}/photos/enhance-standalone`, { photo_url: photoUrl, enhancement_type: 'virtual_staging_interior', style, room_type: roomType });
      console.log('Staging response:', response.data);
      
      if (!response.data.enhanced_url) {
        toast.error('Virtual staging failed: No staged image returned');
        return;
      }
      
      // Instead of updating state, completely reload photos to force fresh images
      console.log('Staging response:', response.data);
      
      const updatedPhotos = photos.map(p => p.id === photo.id ? { 
        ...p, 
        staged_url: response.data.enhanced_url, 
        staged: true, 
        staging_info: { roomType, style },
        timestamp: Date.now() // Add timestamp to force image refresh
      } : p);
      
      // Clear photos and set new array to force complete re-render
      setPhotos([]);
      setTimeout(() => {
        setPhotos(updatedPhotos);
        setRefreshKey(prev => prev + 1);
      }, 100);
      
      toast.success('Virtual staging completed! Image updated.');
      setStagingDialog({ open: false, photo: null, category: null, roomType: null, style: null });
    } catch (error) {
      console.error('Staging error:', error);
      toast.error(error.response?.data?.detail || 'Staging failed');
    } finally {
      setProcessingPhoto(null);
    }
  };

  const handleDownloadPhoto = (url) => window.open(process.env.REACT_APP_BACKEND_URL + url, '_blank');

  const handleCreateVideoProject = () => {
    // Get only final processed photos (no duplicates)
    const finalPhotos = photos.map(p => {
      const finalUrl = p.staged_url || p.enhanced_url || p.url;
      const isProcessed = !!(p.staged_url || p.enhanced_url);
      return {
        url: finalUrl,
        processed: isProcessed,
        type: p.staged_url ? 'staged' : (p.enhanced_url ? 'enhanced' : 'original')
      };
    });
    
    sessionStorage.setItem('preloadedPhotos', JSON.stringify(finalPhotos));
    navigate('/projects/create');
  };

  const skyTypes = {
    daytime: {
      tier: 'professional',
      label: '☀️ Daytime Skies (Realistic & Natural)',
      badge: 'Professional+',
      badgeColor: 'default',
      skies: [
        { id: 'clear_blue', name: 'Clear Blue Sky', desc: 'Bright midday blue, few or no clouds' },
        { id: 'soft_clouds', name: 'Soft White Clouds', desc: 'Blue with light, fluffy clouds' },
        { id: 'deep_summer', name: 'Deep Summer Blue', desc: 'Rich saturated tones, luxury coastal' },
        { id: 'sunny_glow', name: 'Sunny with Lens Glow', desc: 'Warm sunlight with gentle glow' }
      ]
    },
    goldenHour: {
      tier: 'enterprise',
      label: '🌇 Golden Hour / Sunset Skies',
      badge: 'Enterprise+',
      badgeColor: 'bg-brand-orange-50',
      skies: [
        { id: 'golden_hour', name: 'Golden Hour Warm', desc: 'Soft orange-pink with long shadows' },
        { id: 'sunset_pink', name: 'Sunset Pink/Peach', desc: 'Vibrant pinks and purples' },
        { id: 'dramatic_sunset', name: 'Dramatic Sunset', desc: 'Intense orange-red horizon' }
      ]
    },
    cloudy: {
      tier: 'ai_caption',
      label: '🌤️ Cloudy / Overcast Options',
      badge: 'Ultimate',
      badgeColor: 'bg-brand-orange-50',
      skies: [
        { id: 'soft_overcast', name: 'Soft Overcast', desc: 'Light greyish-white, diffused' },
        { id: 'partly_cloudy', name: 'Partly Cloudy', desc: 'Dynamic texture, sun and clouds' },
        { id: 'stormy_subtle', name: 'Stormy (Subtle)', desc: 'Dark clouds for dramatic effect' }
      ]
    },
    creative: {
      tier: 'ai_caption',
      label: '🌌 Creative / Lifestyle Skies',
      badge: 'Ultimate',
      badgeColor: 'bg-brand-orange-50',
      skies: [
        { id: 'sunrise_glow', name: 'Sunrise Glow', desc: 'Gentle pink-orange, calming' },
        { id: 'twilight_blue', name: 'Twilight/Blue Hour', desc: 'Deep blue with glowing windows' },
        { id: 'tropical_paradise', name: 'Tropical Paradise', desc: 'Bright cyan, white fluffy clouds' },
        { id: 'artistic_gradient', name: 'Artistic Gradient', desc: 'Soft pastel cinematic tones' }
      ]
    }
  };

  const sharpeningOptions = {
    core: {
      tier: 'professional',
      label: '✨ Core Sharpening Tools (Must-Have)',
      badge: 'Professional+',
      badgeColor: 'default',
      options: [
        { id: 'improve_clarity', name: 'Improve Clarity', desc: 'Enhances midtone contrast for natural detail' },
        { id: 'sharpen_details', name: 'Sharpen Details', desc: 'Increases edge definition across image' },
        { id: 'texture_boost', name: 'Texture Boost', desc: 'Enhances fine textures like fabrics or walls' },
        { id: 'micro_contrast', name: 'Micro Contrast', desc: 'Adds depth via local contrast' },
        { id: 'edge_definition', name: 'Edge Definition (Smart Sharpen)', desc: 'Targets edges without noise' }
      ]
    },
    realEstate: {
      tier: 'enterprise',
      label: '🏠 Real Estate-Focused Enhancements',
      badge: 'Enterprise+',
      badgeColor: 'bg-brand-orange-50',
      options: [
        { id: 'architectural_detail', name: 'Architectural Detail Enhance', desc: 'Structure lines, tiles, beams, frames' },
        { id: 'landscape_sharpness', name: 'Landscape Sharpness', desc: 'Gardens, outdoor scenes, views' },
        { id: 'interior_texture', name: 'Interior Texture Restore', desc: 'Recovers lost detail in compression' },
        { id: 'window_glass_clarity', name: 'Window & Glass Clarity', desc: 'Cleans reflections, enhances transparency' },
        { id: 'floor_surface', name: 'Floor & Surface Definition', desc: 'Marble, tile, wood texture detail' }
      ]
    },
    aiAssisted: {
      tier: 'ai_caption',
      label: '🧠 AI-Assisted Smart Options',
      badge: 'Ultimate',
      badgeColor: 'bg-brand-orange-50',
      options: [
        { id: 'ai_smart_sharpen', name: 'AI Smart Sharpen', desc: 'Auto-detects and balances sharpening' },
        { id: 'ai_structure_recovery', name: 'AI Structure Recovery', desc: 'Rebuilds lost detail in low-res photos' },
        { id: 'focus_restoration', name: 'Focus Restoration', desc: 'Corrects mild blur or focus drift' },
        { id: 'noise_aware_sharpening', name: 'Noise-Aware Sharpening', desc: 'Enhances clarity while minimizing grain' }
      ]
    },
    creative: {
      tier: 'ai_caption',
      label: '🖼️ Creative / Situational Enhancements',
      badge: 'Ultimate',
      badgeColor: 'bg-brand-orange-50',
      options: [
        { id: 'soft_sharpen', name: 'Soft Sharpen (Natural Look)', desc: 'Gentle clarity for lifestyle images' },
        { id: 'hd_mode', name: 'High Definition (HD Mode)', desc: 'Dramatic clarity for exteriors' },
        { id: 'dehaze', name: 'Dehaze / Mist Removal', desc: 'Clears fog or haze in outdoor photos' },
        { id: 'fine_detail_recovery', name: 'Fine Detail Recovery', desc: 'Ultra-high-quality microtextures' },
        { id: 'surface_smooth_edge_sharp', name: 'Surface Smooth + Edge Sharp', desc: 'Smooth walls, sharp outlines' }
      ]
    }
  };

  const roomCategories = [
    { id: 'living_social', name: 'Living & Social Areas', icon: '🛋️' },
    { id: 'dining_kitchen', name: 'Dining & Kitchen', icon: '🍽️' },
    { id: 'bedrooms', name: 'Bedrooms', icon: '🛏️' },
    { id: 'work_flex', name: 'Work & Flex Spaces', icon: '💼' },
    { id: 'wellness', name: 'Wellness & Utility', icon: '🚿' },
    { id: 'outdoor', name: 'Outdoor & Leisure', icon: '🏞️' },
    { id: 'premium_addons', name: 'Property Add-ons', icon: '🚗' }
  ];

  const roomTypes = {
    living_social: [
      { id: 'living_room', name: 'Living Room', desc: 'Sofa set, coffee table, TV, decor' },
      { id: 'open_plan', name: 'Open-Plan Living', desc: 'Combined lounge, dining, kitchen' },
      { id: 'family_room', name: 'Family/TV Room', desc: 'Cozy, sectional sofa, entertainment' },
      { id: 'formal_lounge', name: 'Formal Lounge', desc: 'Elegant seating, luxury/classical' }
    ],
    dining_kitchen: [
      { id: 'dining_room', name: 'Dining Room', desc: 'Table, chairs, art, lighting' },
      { id: 'kitchen', name: 'Kitchen', desc: 'Stools, decor, plants, breakfast nook' },
      { id: 'open_kitchen', name: 'Open Kitchen/Bar', desc: 'Island bar with stools' }
    ],
    bedrooms: [
      { id: 'master_bedroom', name: 'Master Bedroom', desc: 'Premium bed, luxury feel' },
      { id: 'guest_bedroom', name: 'Guest Bedroom', desc: 'Neutral, versatile' },
      { id: 'children_bedroom', name: "Children's Bedroom", desc: 'Fun, colorful, age-appropriate' },
      { id: 'teen_bedroom', name: 'Teen Bedroom', desc: 'Trendy or minimalist' },
      { id: 'nursery', name: 'Nursery', desc: 'Baby furniture, soft tones' }
    ],
    work_flex: [
      { id: 'home_office', name: 'Home Office/Study', desc: 'Desk, plants, modern chair' },
      { id: 'library', name: 'Library/Reading Corner', desc: 'Bookshelves, armchair' },
      { id: 'studio', name: 'Studio/Creative Room', desc: 'Artistic workspace' }
    ],
    wellness: [
      { id: 'bathroom', name: 'Bathroom', desc: 'Towels, candles, mirrors' },
      { id: 'spa', name: 'Spa/Wellness Room', desc: 'Sauna, massage table (luxury)' },
      { id: 'laundry', name: 'Laundry/Utility', desc: 'Appliances, functional' }
    ],
    outdoor: [
      { id: 'garden', name: 'Garden/Lawn', desc: 'Seating, greenery, sun loungers' },
      { id: 'pool', name: 'Swimming Pool Area', desc: 'Pool furniture, umbrellas' },
      { id: 'terrace', name: 'Terrace/Balcony', desc: 'Outdoor lounge or dining' },
      { id: 'bbq', name: 'Outdoor Kitchen/BBQ', desc: 'Grill, bar, dining table' },
      { id: 'rooftop', name: 'Rooftop/Solarium', desc: 'Lounge chairs, pergola' },
      { id: 'patio', name: 'Patio/Courtyard', desc: 'Cozy enclosed outdoor' }
    ],
    premium_addons: [
      { id: 'garage', name: 'Garage/Workshop', desc: 'Organized tools, clean' },
      { id: 'gym', name: 'Gym/Fitness Room', desc: 'Exercise equipment, mirrors' },
      { id: 'cinema', name: 'Home Cinema', desc: 'Projector, sofa, dark ambiance' },
      { id: 'game_room', name: 'Game Room', desc: 'Pool table, bar, relaxed' },
      { id: 'entry_hall', name: 'Entry Hall/Foyer', desc: 'Welcoming decor, console' },
      { id: 'walk_in_closet', name: 'Walk-in Closet', desc: 'Luxury wardrobes, mirrors' }
    ]
  };

  const styles = {
    core: [
      { id: 'modern', name: 'Modern/Contemporary', desc: 'Clean lines, neutral tones, minimal', tier: 'professional' },
      { id: 'scandinavian', name: 'Scandinavian/Nordic', desc: 'Light woods, white walls, cozy', tier: 'professional' },
      { id: 'minimalist', name: 'Minimalist', desc: 'Ultra-sleek, focus on space & light', tier: 'professional' },
      { id: 'classic', name: 'Classic/Traditional', desc: 'Elegant, symmetry, warm tones', tier: 'professional' }
    ],
    lifestyle: [
      { id: 'mediterranean', name: 'Mediterranean/Coastal', desc: 'White walls, blue tones, natural materials', tier: 'enterprise' },
      { id: 'bohemian', name: 'Bohemian (Boho Chic)', desc: 'Eclectic, earthy, plants, cozy', tier: 'enterprise' },
      { id: 'luxury', name: 'Luxury/Premium', desc: 'High-end, marble, statement pieces', tier: 'enterprise' },
      { id: 'industrial', name: 'Industrial/Urban Loft', desc: 'Exposed brick, metal, dark tones', tier: 'enterprise' }
    ],
    niche: [
      { id: 'japandi', name: 'Japandi', desc: 'Japanese + Scandinavian fusion, calm', tier: 'ai_caption' },
      { id: 'rustic', name: 'Rustic/Farmhouse', desc: 'Wooden textures, vintage, cozy', tier: 'ai_caption' },
      { id: 'eco', name: 'Eco-Friendly/Sustainable', desc: 'Natural materials, plants, earthy', tier: 'ai_caption' },
      { id: 'tropical', name: 'Tropical Resort/Vacation', desc: 'Light fabrics, palms, sea views', tier: 'ai_caption' }
    ]
  };

  const getAvailableStyles = () => {
    if (trialActive) {
      // All styles in trial
      return [...styles.core, ...styles.lifestyle, ...styles.niche];
    }
    
    // Get user subscription plan
    const userPlan = 'professional'; // This should come from user object
    
    if (userPlan === 'ai_caption' || userPlan === 'ai caption') {
      return [...styles.core, ...styles.lifestyle, ...styles.niche];
    } else if (userPlan === 'enterprise') {
      return [...styles.core, ...styles.lifestyle];
    } else if (userPlan === 'professional') {
      return styles.core;
    }
    return []; // Basic plan
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-100">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <Video className="w-8 h-8 text-brand-orange-500" />
            <span className="text-2xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
              ReelsEstate
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/settings">
              <Button variant="ghost">
                <Settings className="w-5 h-5 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2"><Sparkles className="w-6 h-6 text-brand-orange-500" />AI Photo Studio</CardTitle>
                <p className="text-gray-600 mt-1">Enhance and stage your property photos</p>
              </div>
              {hasAccess && <Badge variant="outline" className="bg-brand-orange-100 text-brand-orange-700 border-brand-orange-300">{trialActive ? 'Trial Active' : 'Premium Access'}</Badge>}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Step {currentStep} of 3</span><span>{Math.round((currentStep / 3) * 100)}%</span></div>
              <Progress value={(currentStep / 3) * 100} className="h-2" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* STEP 1: Upload */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8"><h2 className="text-xl font-bold mb-2">Upload Your Property Photos</h2><p className="text-gray-600">Upload one or multiple photos (JPG, PNG, HEIC)</p></div>
                {photos.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center"><Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" /><h3 className="text-lg font-semibold mb-2">Drop your photos here</h3><p className="text-gray-600 mb-6">or click below to browse</p><div><input id="photo-upload" type="file" multiple accept="image/*,.heic" onChange={handleFileUpload} className="hidden" /><label htmlFor="photo-upload" className="inline-block cursor-pointer"><div className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-brand-orange-500 rounded-md hover:bg-brand-orange-600 transition-colors">{uploading ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" />Uploading...</> : <><Upload className="mr-2 w-5 h-5" />Select Photos</>}</div></label></div></div>
                ) : (
                  <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{photos.length} photo(s) uploaded</h3><div><input id="photo-upload-more" type="file" multiple accept="image/*,.heic" onChange={handleFileUpload} className="hidden" /><label htmlFor="photo-upload-more" className="inline-block cursor-pointer"><div className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"><Upload className="w-4 h-4 mr-2" />Add More</div></label></div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{photos.map(photo => <div key={photo.id} className="relative border rounded-lg overflow-hidden group bg-gray-100"><img src={process.env.REACT_APP_BACKEND_URL + photo.url} alt="Uploaded" className="w-full h-32 object-contain" /><button onClick={() => handleRemovePhoto(photo.id)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button></div>)}</div></div>
                )}
                <div className="flex justify-between pt-6 border-t"><Button variant="outline" onClick={() => navigate('/dashboard')}><ArrowLeft className="mr-2 w-5 h-5" />Back to Dashboard</Button><Button onClick={() => setCurrentStep(2)} disabled={photos.length === 0} className="bg-brand-orange-500 hover:bg-brand-orange-600">Continue<ArrowRight className="ml-2 w-5 h-5" /></Button></div>
              </div>
            )}

            {/* STEP 2: Photo Enhancement */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8"><h2 className="text-xl font-bold mb-2">Enhance Your Photos (Optional)</h2><p className="text-gray-600">Apply AI enhancements to individual photos or skip this step</p></div>
                <div className="grid md:grid-cols-3 gap-6">
                  {photos.map(photo => (
                    <Card key={`${photo.id}-${refreshKey}`} className="overflow-hidden">
                      <div className="relative bg-gray-100">
                        <img 
                          key={`${photo.enhanced_url || photo.url}-${photo.timestamp || 0}`}
                          src={process.env.REACT_APP_BACKEND_URL + (photo.enhanced_url || photo.url) + `?t=${photo.timestamp || Date.now()}`}
                          alt="Photo" 
                          className="w-full h-48 object-contain" 
                        />
                        {photo.enhanced && <Badge className="absolute top-2 right-2 bg-green-500">Enhanced</Badge>}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEnhancementDialog({ open: true, type: 'lighting', photo })} disabled={processingPhoto === photo.id} className="text-xs px-2">
                            {processingPhoto === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sun className="w-3 h-3 mr-1" />Lighting</>}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEnhancementDialog({ open: true, type: 'sky', photo })} disabled={processingPhoto === photo.id} className="text-xs px-2">
                            {processingPhoto === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ImageIcon className="w-3 h-3 mr-1" />Sky</>}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEnhancementDialog({ open: true, type: 'sharpening', photo })} disabled={processingPhoto === photo.id} className="text-xs px-2">
                            {processingPhoto === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sliders className="w-3 h-3 mr-1" />Sharp</>}
                          </Button>
                        </div>
                        {photo.enhanced && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadPhoto(photo.enhanced_url)} className="flex-1"><Download className="w-3 h-3 mr-2" />Download</Button>
                            <Button size="sm" variant="outline" onClick={() => handleUndoEnhancement(photo)} className="flex-1"><X className="w-3 h-3 mr-2" />Undo</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-between pt-6 border-t"><Button variant="outline" onClick={() => setCurrentStep(1)}><ArrowLeft className="mr-2 w-5 h-5" />Back</Button><Button onClick={() => setCurrentStep(3)} className="bg-brand-orange-500 hover:bg-brand-orange-600">Continue to Staging<ArrowRight className="ml-2 w-5 h-5" /></Button></div>
              </div>
            )}

            {/* STEP 3: Virtual Staging */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8"><h2 className="text-xl font-bold mb-2">Virtual Staging (Optional)</h2><p className="text-gray-600">Add furniture to your photos individually</p></div>
                <div className="grid md:grid-cols-3 gap-6">
                  {photos.map(photo => (
                    <Card key={`${photo.id}-staging-${refreshKey}`} className="overflow-hidden">
                      <div className="relative bg-gray-100">
                        <img 
                          key={`${photo.staged_url || photo.enhanced_url || photo.url}-${photo.timestamp || 0}`}
                          src={process.env.REACT_APP_BACKEND_URL + (photo.staged_url || photo.enhanced_url || photo.url) + `?t=${photo.timestamp || Date.now()}`}
                          alt="Photo" 
                          className="w-full h-48 object-contain" 
                        />
                        {photo.staged && <Badge className="absolute top-2 right-2 bg-blue-500">Staged</Badge>}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setStagingDialog({ open: true, photo, step: 'category', category: null, roomType: null, style: null })} 
                          disabled={processingPhoto === photo.id} 
                          className="w-full"
                        >
                          {processingPhoto === photo.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Home className="w-4 h-4 mr-2" />
                              Virtual Staging
                            </>
                          )}
                        </Button>
                        {photo.staged && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadPhoto(photo.staged_url)} className="flex-1">
                              <Download className="w-3 h-3 mr-2" />
                              Download
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleUndoStaging(photo)} className="flex-1">
                              <X className="w-3 h-3 mr-2" />
                              Undo
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-between pt-6 border-t"><Button variant="outline" onClick={() => setCurrentStep(2)}><ArrowLeft className="mr-2 w-5 h-5" />Back</Button><div className="space-x-2"><Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button><Button onClick={handleCreateVideoProject} className="bg-brand-orange-500 hover:bg-brand-orange-600"><Video className="mr-2 w-5 h-5" />Create Video Project</Button></div></div>
              </div>
            )}

            {/* Enhancement Dialogs */}
            <Dialog open={enhancementDialog.open} onOpenChange={(open) => setEnhancementDialog({ open, type: null, photo: null })}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                {enhancementDialog.type === 'sky' && (
                  <>
                    <DialogHeader><DialogTitle>🌅 Sky Replacement</DialogTitle><DialogDescription>Choose a sky type for your property photo</DialogDescription></DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      {Object.entries(skyTypes).map(([category, categoryData]) => {
                        const isAvailable = isFeatureAvailable(categoryData.tier);
                        return (
                          <div key={category} className={`space-y-2 ${category !== 'daytime' ? 'pt-2 border-t' : ''}`}>
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              {categoryData.label}
                              <Badge variant="outline" className={`text-xs ${categoryData.badgeColor}`}>{categoryData.badge}</Badge>
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {categoryData.skies.map(sky => {
                                const isDisabled = !isAvailable;
                                return (
                                  <Card 
                                    key={sky.id} 
                                    className={`cursor-pointer transition ${selectedSkyType === sky.id ? 'border-brand-orange-500 border-2 bg-brand-orange-50' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-orange-300'}`} 
                                    onClick={() => {
                                      if (!isAvailable) {
                                        toast.error(getUpgradeMessage(categoryData.tier));
                                        return;
                                      }
                                      setSelectedSkyType(sky.id);
                                    }}
                                  >
                                    <CardContent className="p-3">
                                      {!isAvailable && <Lock className="w-3 h-3 mb-1 text-gray-400" />}
                                      <h5 className="font-semibold text-sm">{sky.name}</h5>
                                      <p className="text-xs text-gray-600">{sky.desc}</p>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button 
                      onClick={() => {
                        const selectedCategory = Object.values(skyTypes).find(cat => cat.skies.some(s => s.id === selectedSkyType));
                        if (selectedCategory && !isFeatureAvailable(selectedCategory.tier)) {
                          toast.error(getUpgradeMessage(selectedCategory.tier));
                          return;
                        }
                        handleEnhance(enhancementDialog.photo, 'sky_replacement', { sky_type: selectedSkyType }, selectedCategory?.tier);
                      }} 
                      disabled={processingPhoto} 
                      className="w-full bg-brand-orange-500 hover:bg-purple-600"
                    >
                      {processingPhoto ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" />Processing...</> : 'Apply Sky Replacement'}
                    </Button>
                  </>
                )}
                {enhancementDialog.type === 'lighting' && (() => {
                  // Helper to render enhancement button with tier checking
                  const renderEnhancementButton = (enhancementType, title, description, tier) => {
                    const isAvailable = isFeatureAvailable(tier);
                    const isDisabled = processingPhoto || !isAvailable;
                    
                    return (
                      <Button 
                        onClick={() => isAvailable && handleEnhance(enhancementDialog.photo, enhancementType, {}, tier)} 
                        disabled={isDisabled} 
                        variant="outline" 
                        className={`w-full justify-start text-sm h-auto py-2 ${!isAvailable ? 'opacity-50' : ''}`}
                      >
                        {!isAvailable && <Lock className="w-3 h-3 mr-2 flex-shrink-0" />}
                        <span className="flex flex-col items-start">
                          <span className="font-medium">{title}</span>
                          <span className="text-xs text-gray-500">{description}</span>
                        </span>
                      </Button>
                    );
                  };

                  return (
                    <>
                      <DialogHeader><DialogTitle>💡 Lighting & Color Enhancements</DialogTitle><DialogDescription>Professional lighting and color adjustments for real estate photography</DialogDescription></DialogHeader>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        
                        {/* Basic Adjustments */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            🔆 Basic Adjustments (Must-Have)
                            <Badge variant="outline" className="text-xs">Professional+</Badge>
                          </h4>
                          <div className="space-y-1">
                            {renderEnhancementButton('enhance_brightness', 'Enhance Brightness', 'Increases overall light for dark or shaded photos', 'professional')}
                            {renderEnhancementButton('adjust_contrast', 'Adjust Contrast', 'Adds depth by balancing light and dark tones', 'professional')}
                            {renderEnhancementButton('boost_exposure', 'Boost Exposure', 'Corrects underexposed images (useful for interiors)', 'professional')}
                            {renderEnhancementButton('recover_highlights', 'Recover Highlights', 'Restores detail from bright window areas', 'professional')}
                            {renderEnhancementButton('recover_shadows', 'Recover Shadows', 'Brightens dark corners or rooms', 'professional')}
                        </div>
                      </div>

                        {/* Color Balance & Tone */}
                        <div className="space-y-2 pt-2 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            🌈 Color Balance & Tone
                            <Badge variant="outline" className="text-xs">Professional+</Badge>
                          </h4>
                          <div className="space-y-1">
                            {renderEnhancementButton('white_balance_correction', 'White Balance Correction', 'Fixes yellow or blue color casts from artificial lighting', 'professional')}
                            {renderEnhancementButton('temperature_adjustment', 'Temperature Adjustment', 'Warm up (sunny tone) or cool down (modern/neutral tone)', 'professional')}
                            {renderEnhancementButton('vibrance_boost', 'Vibrance Boost', 'Enhances colors subtly without oversaturation', 'professional')}
                            {renderEnhancementButton('saturation_control', 'Saturation Control', 'Adds or reduces color intensity', 'professional')}
                            {renderEnhancementButton('tint_adjustment', 'Tint Adjustment', 'Fine-tune green/magenta tones for accuracy', 'professional')}
                          </div>
                        </div>

                        {/* Real Estate-Specific Enhancements */}
                        <div className="space-y-2 pt-2 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            🌤️ Real Estate-Specific Enhancements
                            <Badge variant="outline" className="text-xs bg-brand-orange-50">Enterprise+</Badge>
                          </h4>
                          <div className="space-y-1">
                            {renderEnhancementButton('natural_light_simulation', 'Natural Light Simulation', 'Adds realistic daylight ambience inside rooms', 'enterprise')}
                            {renderEnhancementButton('window_view_enhancement', 'Window View Enhancement', 'Balances interior and exterior exposure (see outside views)', 'enterprise')}
                            {renderEnhancementButton('sky_brightness_sync', 'Sky Brightness Sync', 'Matches sky tone with interior lighting', 'enterprise')}
                            {renderEnhancementButton('color_cast_removal', 'Color Cast Removal', 'Removes unwanted orange or blue tint from mixed lighting', 'enterprise')}
                            {renderEnhancementButton('golden_hour_glow', 'Golden Hour Glow', 'Adds warm, soft light tone to simulate late afternoon sunlight', 'enterprise')}
                          </div>
                        </div>

                        {/* Professional Polish Options */}
                        <div className="space-y-2 pt-2 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            ✨ Professional Polish Options
                            <Badge variant="outline" className="text-xs bg-brand-orange-50">AI Caption</Badge>
                          </h4>
                          <div className="space-y-1">
                            {renderEnhancementButton('hdr_enhancement', 'HDR Enhancement (Smart)', 'Combines lighting layers for balanced, natural high-dynamic-range look', 'ai_caption')}
                            {renderEnhancementButton('smart_auto_tone', 'Smart Auto Tone', 'AI-corrected brightness, contrast, and saturation in one click', 'ai_caption')}
                            
                            {/* Interior Mood Presets */}
                            <div className="pl-4 space-y-1 mt-2">
                              <p className="text-xs text-gray-600 font-medium mb-1">Interior Mood Presets:</p>
                              {(() => {
                                const isAvailable = isFeatureAvailable('ai_caption');
                                const isDisabled = processingPhoto || !isAvailable;
                                const presets = [
                                  { id: 'preset_bright_airy', name: 'Bright & Airy' },
                                  { id: 'preset_warm_cozy', name: 'Warm & Cozy' },
                                  { id: 'preset_luxury_gloss', name: 'Luxury Gloss' },
                                  { id: 'preset_modern_neutral', name: 'Modern Neutral' },
                                  { id: 'preset_cool_minimalist', name: 'Cool Minimalist' }
                                ];
                                return presets.map(preset => (
                                  <Button 
                                    key={preset.id}
                                    onClick={() => isAvailable && handleEnhance(enhancementDialog.photo, preset.id, {}, 'ai_caption')} 
                                    disabled={isDisabled} 
                                    variant="outline" 
                                    className={`w-full justify-start text-sm h-auto py-1.5 ${!isAvailable ? 'opacity-50' : ''}`}
                                  >
                                    {!isAvailable && <Lock className="w-3 h-3 mr-2" />}
                                    <span className="text-xs">{preset.name}</span>
                                  </Button>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Advanced Controls (Pro Mode) */}
                        <div className="space-y-2 pt-2 border-t">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            🧠 Advanced Controls (Pro Mode)
                            <Badge variant="outline" className="text-xs bg-brand-orange-50">AI Caption</Badge>
                          </h4>
                          <div className="space-y-1">
                            {renderEnhancementButton('highlight_rolloff', 'Highlight Roll-off', 'Smooths transitions in bright spots', 'ai_caption')}
                            {renderEnhancementButton('local_adjustment_brush', 'Local Adjustment Brush', 'Manually brighten or darken parts of the image', 'ai_caption')}
                            {renderEnhancementButton('color_grading', 'Color Grading', 'Adjust midtones, shadows, and highlights separately', 'ai_caption')}
                            {renderEnhancementButton('ai_lighting_correction', 'AI Lighting Correction (Automatic)', 'Auto-detects poorly lit areas and enhances intelligently', 'ai_caption')}
                          </div>
                        </div>

                      </div>
                    </>
                  );
                })()}
                {enhancementDialog.type === 'sharpening' && (
                  <>
                    <DialogHeader><DialogTitle>🔍 Sharpening & Clarity Enhancements</DialogTitle><DialogDescription>Improve detail and sharpness for professional photos</DialogDescription></DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      {Object.entries(sharpeningOptions).map(([category, categoryData]) => {
                        const isAvailable = isFeatureAvailable(categoryData.tier);
                        return (
                          <div key={category} className={`space-y-2 ${category !== 'core' ? 'pt-2 border-t' : ''}`}>
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              {categoryData.label}
                              <Badge variant="outline" className={`text-xs ${categoryData.badgeColor}`}>{categoryData.badge}</Badge>
                            </h4>
                            <div className="space-y-1">
                              {categoryData.options.map(option => {
                                const isDisabled = processingPhoto || !isAvailable;
                                return (
                                  <Button 
                                    key={option.id}
                                    onClick={() => isAvailable && handleEnhance(enhancementDialog.photo, option.id, {}, categoryData.tier)} 
                                    disabled={isDisabled} 
                                    variant="outline" 
                                    className={`w-full justify-start text-sm h-auto py-2 ${!isAvailable ? 'opacity-50' : ''}`}
                                  >
                                    {!isAvailable && <Lock className="w-3 h-3 mr-2 flex-shrink-0" />}
                                    <span className="flex flex-col items-start">
                                      <span className="font-medium">{option.name}</span>
                                      <span className="text-xs text-gray-500">{option.desc}</span>
                                    </span>
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Staging Dialog - Cascading Selection */}
            <Dialog open={stagingDialog.open} onOpenChange={(open) => !open && setStagingDialog({ open: false, photo: null, step: 'category', category: null, roomType: null, style: null })}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                {stagingDialog.step === 'category' && (
                  <>
                    <DialogHeader><DialogTitle>Step 1: Choose Main Category</DialogTitle><DialogDescription>Select the type of space you want to stage</DialogDescription></DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                      {roomCategories.map(cat => (
                        <Card key={cat.id} className="cursor-pointer hover:border-brand-orange-500 transition" onClick={() => setStagingDialog({ ...stagingDialog, step: 'room', category: cat.id })}>
                          <CardContent className="p-4 text-center">
                            <div className="text-3xl mb-2">{cat.icon}</div>
                            <h4 className="font-semibold text-sm">{cat.name}</h4>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
                {stagingDialog.step === 'room' && stagingDialog.category && (
                  <>
                    <DialogHeader><DialogTitle>Step 2: Choose Specific Room</DialogTitle><DialogDescription>Select the exact room type</DialogDescription></DialogHeader>
                    <div className="space-y-2">
                      {roomTypes[stagingDialog.category]?.map(room => (
                        <Card key={room.id} className="cursor-pointer hover:border-brand-orange-500 transition" onClick={() => setStagingDialog({ ...stagingDialog, step: 'style', roomType: room.id })}>
                          <CardContent className="p-3">
                            <h4 className="font-semibold text-sm">{room.name}</h4>
                            <p className="text-xs text-gray-600">{room.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Button variant="outline" onClick={() => setStagingDialog({ ...stagingDialog, step: 'category', category: null })} className="w-full mt-2"><ArrowLeft className="mr-2 w-4 h-4" />Back to Categories</Button>
                  </>
                )}
                {stagingDialog.step === 'style' && stagingDialog.roomType && (
                  <>
                    <DialogHeader><DialogTitle>Step 3: Choose Style</DialogTitle><DialogDescription>Select the interior design style{trialActive ? ' (All styles available in trial!)' : ''}</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                      {/* Core Styles - Professional Plan */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-sm">Core Popular Styles</h4>
                          <Badge variant="outline" className="text-xs">Professional+</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {styles.core.map(style => (
                            <Card key={style.id} className={`cursor-pointer hover:border-brand-orange-500 transition ${stagingDialog.style === style.id ? 'border-brand-orange-500 border-2 bg-brand-orange-50' : ''}`} onClick={() => setStagingDialog({ ...stagingDialog, style: style.id })}>
                              <CardContent className="p-3">
                                <h5 className="font-semibold text-sm">{style.name}</h5>
                                <p className="text-xs text-gray-600">{style.desc}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                      
                      {/* Lifestyle Styles - Enterprise Plan */}
                      {(trialActive || hasAccess) && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">Lifestyle-Oriented Styles</h4>
                            <Badge variant="outline" className="text-xs bg-blue-50">Enterprise+</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {styles.lifestyle.map(style => (
                              <Card key={style.id} className={`cursor-pointer hover:border-brand-orange-500 transition ${stagingDialog.style === style.id ? 'border-brand-orange-500 border-2 bg-brand-orange-50' : ''}`} onClick={() => setStagingDialog({ ...stagingDialog, style: style.id })}>
                                <CardContent className="p-3">
                                  <h5 className="font-semibold text-sm">{style.name}</h5>
                                  <p className="text-xs text-gray-600">{style.desc}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Niche Styles - AI Caption Plan */}
                      {(trialActive || hasAccess) && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">Niche & Trending Styles</h4>
                            <Badge variant="outline" className="text-xs bg-brand-orange-50">AI Caption</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {styles.niche.map(style => (
                              <Card key={style.id} className={`cursor-pointer hover:border-brand-orange-500 transition ${stagingDialog.style === style.id ? 'border-brand-orange-500 border-2 bg-brand-orange-50' : ''}`} onClick={() => setStagingDialog({ ...stagingDialog, style: style.id })}>
                                <CardContent className="p-3">
                                  <h5 className="font-semibold text-sm">{style.name}</h5>
                                  <p className="text-xs text-gray-600">{style.desc}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 mt-4">
                      <Button variant="outline" onClick={() => setStagingDialog({ ...stagingDialog, step: 'room', roomType: null, style: null })} className="w-full"><ArrowLeft className="mr-2 w-4 h-4" />Back to Rooms</Button>
                      {stagingDialog.style && <Button onClick={() => handleStaging(stagingDialog.photo, stagingDialog.roomType, stagingDialog.style)} disabled={processingPhoto} className="w-full bg-brand-orange-500 hover:bg-purple-600">{processingPhoto ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" />Staging...</> : 'Apply Virtual Staging'}</Button>}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {!hasAccess && currentStep > 1 && <div className="mt-6 p-4 bg-brand-orange-50 border border-brand-orange-200 rounded-lg"><p className="text-sm text-brand-orange-800"><strong>Premium Feature:</strong> Enhancement requires Professional+ plan. {trialActive ? 'Full access during trial!' : 'Upgrade to unlock.'}</p></div>}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default PhotoEnhancementPage;