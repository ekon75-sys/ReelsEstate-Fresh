import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Video, Building, Palette, Users, Share2, CreditCard, DollarSign, ArrowLeft } from 'lucide-react';

const SettingsLayout = () => {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    { path: '/settings/business', label: 'Business Info', icon: Building },
    { path: '/settings/branding', label: 'Branding', icon: Palette },
    { path: '/settings/agents', label: 'Agents', icon: Users },
    { path: '/settings/social-media', label: 'Social Media', icon: Share2 },
    { path: '/settings/billing', label: 'Billing', icon: CreditCard },
    { path: '/settings/subscription', label: 'Subscription', icon: DollarSign }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" data-testid="back-to-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReelsEstate Logo" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-brand-orange-500 to-brand-orange-600 bg-clip-text text-transparent">
                ReelsEstate
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {user?.email}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Settings</h1>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-24">
              <nav className="space-y-1">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path}>
                      <button
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                          isActive
                            ? 'bg-brand-orange-100 text-brand-orange-600 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        data-testid={`settings-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </button>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
