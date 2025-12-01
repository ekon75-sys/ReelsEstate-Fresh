import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Sparkles, Upload, Palette, Share2, Calendar, Check, ArrowRight, Play } from 'lucide-react';

const LandingPage = () => {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Random popup interval
    const showRandomPopup = () => {
      const names = ['John D.', 'Sarah M.', 'Michael K.', 'Emma L.', 'David R.'];
      const plans = ['Professional', 'Enterprise', 'Basic'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomPlan = plans[Math.floor(Math.random() * plans.length)];
      
      setTimeout(() => {
        setShowPopup({ name: randomName, plan: randomPlan });
        setTimeout(() => setShowPopup(false), 5000);
      }, Math.random() * 20000 + 15000);
    };

    showRandomPopup();
    const interval = setInterval(showRandomPopup, 45000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'AI-Powered Video Creation',
      description: 'Automatically generate stunning property videos with AI enhancements'
    },
    {
      icon: <Upload className="w-6 h-6" />,
      title: 'Photo Enhancement',
      description: 'AI-powered sky replacement, brightness, and clarity adjustments'
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: 'Custom Branding',
      description: 'Add your logo, colors, and agent details to every video'
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: 'Multi-Format Export',
      description: 'Generate videos for all social platforms: Instagram, TikTok, YouTube & more'
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: 'Direct Social Posting',
      description: 'Post directly to Facebook, Instagram, and other platforms'
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: 'Content Scheduling',
      description: 'Schedule your real estate videos for optimal engagement'
    }
  ];

  const plans = [
    {
      name: 'Basic',
      price: '€19.99',
      features: [
        '1 agent profile',
        '1 download format',
        'Watermark + Outro branding',
        '3-day free trial',
        'Basic video editing'
      ],
      unavailable: ['Multi-format export', 'Social media integration', 'AI captions']
    },
    {
      name: 'Professional',
      price: '€39.99',
      popular: true,
      features: [
        'Up to 3 agents',
        'All formats (16:9, 9:16, 1:1)',
        'Smart photo enhancement',
        'Virtual staging',
        'Facebook & Instagram integration',
        'Custom branding',
        '3-day free trial'
      ],
      unavailable: ['Unlimited agents', 'AI captions']
    },
    {
      name: 'Enterprise',
      price: '€99.99',
      features: [
        'Unlimited agents',
        'All formats (16:9, 9:16, 1:1)',
        'Smart photo enhancement',
        'Virtual staging (all styles)',
        'All social media integrations',
        'Multi-agent support',
        'Advanced scheduling',
        '3-day free trial'
      ],
      unavailable: ['AI-generated captions']
    },
    {
      name: 'Ultimate',
      price: '€199.99',
      badge: 'Premium',
      features: [
        'Everything in Enterprise',
        'Smart photo enhancement (ALL 22 options)',
        'Virtual staging (all styles)',
        'Sky replacement (all 14 types)',
        'Sharpening & clarity (all 19 options)',
        'AI-generated text captions',
        'Automatic property descriptions',
        'Smart text overlay',
        'Premium support',
        '3-day free trial'
      ],
      unavailable: []
    }
  ];

  const testimonials = [
    {
      name: 'Maria Rodriguez',
      company: 'Premium Properties Spain',
      text: 'ReelsEstate transformed how I market properties. Videos in minutes!',
      image: 'https://i.pravatar.cc/150?img=1'
    },
    {
      name: 'Tom Anderson',
      company: 'Anderson Realty',
      text: 'The AI enhancement feature makes every property look incredible.',
      image: 'https://i.pravatar.cc/150?img=2'
    },
    {
      name: 'Sophie Chen',
      company: 'Luxury Estates',
      text: 'Best investment for my real estate business. ROI in the first month!',
      image: 'https://i.pravatar.cc/150?img=3'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Social Proof Popup */}
      {showPopup && (
        <div className="fixed bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3 border border-brand-orange-100">
            <div className="w-10 h-10 rounded-full bg-brand-orange-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-brand-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{showPopup.name}</p>
              <p className="text-xs text-gray-500">just subscribed to {showPopup.plan}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Mobile Layout */}
          <div className="flex md:hidden flex-col gap-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReelsEstate Logo" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
                ReelsEstate
              </span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Link to="/login">
                <Button variant="ghost" size="sm" data-testid="nav-login-btn">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-brand-orange-500 hover:bg-brand-orange-600" data-testid="nav-register-btn">
                  Start Free Trial
                </Button>
              </Link>
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
            <div className="flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-brand-orange-500 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-brand-orange-500 transition-colors">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-brand-orange-500 transition-colors">Testimonials</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-brand-orange-500 transition-colors">How It Works</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" data-testid="nav-login-btn">Login</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-brand-orange-500 hover:bg-brand-orange-600" data-testid="nav-register-btn">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Create Stunning <span className="gradient-text">Real Estate Videos</span> in Minutes
            </h1>
            <p className="text-lg md:text-xl text-gray-600">
              AI-powered video creation for real estate professionals. Upload photos, add branding, and export to any platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-brand-orange-500 hover:bg-brand-orange-600 text-white px-8" data-testid="hero-cta-btn">
                  Try Free 3-Day Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-brand-orange-500 text-brand-orange-500 hover:bg-brand-orange-50">
                <Play className="mr-2 w-5 h-5" /> Watch Demo
              </Button>
            </div>
            <p className="text-sm text-gray-500">No credit card required • Full access during trial</p>
          </div>
          <div className="relative">
            <div className="aspect-video rounded-2xl bg-gradient-to-br from-brand-orange-400 to-brand-orange-600 shadow-2xl flex items-center justify-center">
              <Play className="w-20 h-20 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-lg text-gray-600">Everything you need to create professional property videos</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center text-brand-orange-500 mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600">Create professional videos in 5 simple steps</p>
          </div>
          <div className="grid md:grid-cols-5 gap-8">
            {[
              { step: '1', title: 'Sign Up', desc: 'Complete quick onboarding' },
              { step: '2', title: 'Upload Photos', desc: 'Add property images' },
              { step: '3', title: 'Customize', desc: 'Add banners & branding' },
              { step: '4', title: 'Generate', desc: 'AI creates your video' },
              { step: '5', title: 'Share', desc: 'Download or post directly' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-brand-orange-400 to-brand-orange-600 text-white flex items-center justify-center text-2xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
            <p className="text-lg text-gray-600">Choose the plan that fits your business</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-brand-orange-500 border-2 shadow-2xl' : 'border-gray-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    {plan.badge}
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    {plan.unavailable.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 opacity-50">
                        <div className="w-5 h-5 mt-0.5 flex-shrink-0"></div>
                        <span className="text-sm line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/register">
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-brand-orange-500 hover:bg-brand-orange-600' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                      data-testid={`plan-${plan.name.toLowerCase().replace(' ', '-')}-btn`}
                    >
                      Start Free Trial
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comprehensive Feature Comparison Table */}
          <div className="mt-20">
            <h3 className="text-3xl font-bold text-center mb-12">Detailed Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b-2 border-gray-300 py-4 px-6 text-left font-bold text-gray-700">Feature Category</th>
                    <th className="border-b-2 border-gray-300 py-4 px-4 text-center font-bold text-gray-700">Basic</th>
                    <th className="border-b-2 border-gray-300 py-4 px-4 text-center font-bold text-gray-700">Professional</th>
                    <th className="border-b-2 border-gray-300 py-4 px-4 text-center font-bold text-brand-orange-600 bg-brand-orange-50">Enterprise</th>
                    <th className="border-b-2 border-gray-300 py-4 px-4 text-center font-bold text-gray-700">Ultimate</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Video Creation */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">🎥 Video Creation</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Branded Video Creation</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Video Formats (16:9, 9:16, 1:1)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">16:9 only</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">All formats</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">All formats</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">All formats</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Music Selection</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">Basic</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>

                  {/* Photo Enhancements */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">💡 Lighting & Color Enhancements</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Basic Adjustments (5 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Color Balance & Tone (5 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Real Estate-Specific (5 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Professional Polish (7 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Advanced Controls (4 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>

                  {/* Sky Replacement */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">🌅 Sky Replacement</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Daytime Skies (4 types)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Golden Hour / Sunset (3 types)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Cloudy / Creative Skies (7 types)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>

                  {/* Sharpening & Clarity */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">🔍 Sharpening & Clarity</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Core Sharpening (5 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Real Estate-Focused (5 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">AI-Assisted & Creative (9 options)</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>

                  {/* Virtual Staging */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">🏠 Virtual Staging</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Virtual Staging</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">Basic styles</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">More styles</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">All styles</td>
                  </tr>

                  {/* Other Features */}
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="py-3 px-6 font-semibold text-gray-800 bg-gray-200">📱 Other Features</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Social Media Integration</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">Limited</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">✅</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">AI-Generated Captions</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">❌</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 py-3 px-6">Team Members</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">1</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">3</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center bg-brand-orange-50">10</td>
                    <td className="border-b border-gray-200 py-3 px-4 text-center">Unlimited</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Loved by Real Estate Pros</h2>
            <p className="text-lg text-gray-600">See what our customers say</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-none shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full" />
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-gray-500">{testimonial.company}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 italic">"{testimonial.text}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Property Marketing?</h2>
          <p className="text-xl mb-8 opacity-90">Start your 3-day free trial today. No credit card required.</p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="bg-white text-brand-orange-500 hover:bg-gray-100 px-8" data-testid="final-cta-btn">
              Start Free Trial <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-6 h-6" />
                <span className="text-xl font-bold">ReelsEstate</span>
              </div>
              <p className="text-gray-400 text-sm">Professional real estate video creation made simple.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-white">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 ReelsEstate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
