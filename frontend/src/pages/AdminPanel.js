import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Users, Crown, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminPanel = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradeDialog, setUpgradeDialog] = useState({ show: false, user: null });
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Ultimate');
  const [durationType, setDurationType] = useState('unlimited');
  const [customDays, setCustomDays] = useState(30);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.users);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to load users');
      }
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!upgradeDialog.user) return;

    try {
      setUpgrading(true);
      const token = localStorage.getItem('token');
      
      const duration_days = durationType === 'unlimited' ? null : 
                           durationType === '30days' ? 30 :
                           durationType === '90days' ? 90 :
                           durationType === '365days' ? 365 :
                           customDays;

      const response = await axios.post(
        `${API_URL}/admin/users/${upgradeDialog.user.id}/upgrade?plan_name=${selectedPlan}${duration_days !== null ? `&duration_days=${duration_days}` : ''}`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );

      toast.success(response.data.message);
      setUpgradeDialog({ show: false, user: null });
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upgrade user');
      console.error('Failed to upgrade user:', error);
    } finally {
      setUpgrading(false);
    }
  };

  const plans = [
    { name: 'Basic', color: 'bg-gray-100 border-gray-300', icon: '📦' },
    { name: 'Professional', color: 'bg-blue-100 border-blue-300', icon: '💼' },
    { name: 'Enterprise', color: 'bg-brand-orange-100 border-brand-orange-300', icon: '🏢' },
    { name: 'Ultimate', color: 'bg-yellow-100 border-yellow-300', icon: '👑' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-orange-50 via-white to-brand-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-brand-orange-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600">Manage users and subscriptions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.subscription?.is_active).length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ultimate Plans</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.subscription?.plan_name === 'Ultimate').length}
                  </p>
                </div>
                <Crown className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">No Subscription</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => !u.subscription).length}
                  </p>
                </div>
                <X className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage user subscriptions and access levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {user.picture ? (
                      <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand-orange-100 flex items-center justify-center">
                        <span className="text-brand-orange-600 font-semibold text-lg">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{user.name || 'Unnamed User'}</p>
                      <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      {user.subscription ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.subscription.plan_name === 'Ultimate' ? 'bg-yellow-100 text-yellow-700' :
                            user.subscription.plan_name === 'Enterprise' ? 'bg-brand-orange-100 text-brand-orange-700' :
                            user.subscription.plan_name === 'Professional' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.subscription.plan_name}
                          </span>
                          {user.subscription.subscription_end === null ? (
                            <span className="text-xs text-green-600 font-medium">✓ Unlimited</span>
                          ) : user.subscription.subscription_active ? (
                            <span className="text-xs text-green-600">Active</span>
                          ) : (
                            <span className="text-xs text-red-600">Expired</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 mt-1 inline-block">No subscription</span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setUpgradeDialog({ show: true, user })}
                    className="bg-brand-orange-500 hover:bg-brand-orange-600"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Dialog */}
      {upgradeDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Upgrade User Subscription
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Upgrading: <span className="font-semibold">{upgradeDialog.user?.email}</span>
            </p>

            {/* Plan Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                {plans.map(plan => (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    className={`p-3 border-2 rounded-lg transition-all ${
                      selectedPlan === plan.name
                        ? `${plan.color} border-current`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{plan.icon}</div>
                    <div className="text-sm font-medium">{plan.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value="unlimited"
                    checked={durationType === 'unlimited'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="text-brand-orange-500"
                  />
                  <span className="text-sm">Unlimited Access (Forever)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value="30days"
                    checked={durationType === '30days'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="text-brand-orange-500"
                  />
                  <span className="text-sm">30 Days</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value="90days"
                    checked={durationType === '90days'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="text-brand-orange-500"
                  />
                  <span className="text-sm">90 Days</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value="365days"
                    checked={durationType === '365days'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="text-brand-orange-500"
                  />
                  <span className="text-sm">1 Year (365 Days)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    value="custom"
                    checked={durationType === 'custom'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="text-brand-orange-500"
                  />
                  <span className="text-sm">Custom Days:</span>
                  {durationType === 'custom' && (
                    <input
                      type="number"
                      value={customDays}
                      onChange={(e) => setCustomDays(parseInt(e.target.value))}
                      className="ml-2 px-2 py-1 border rounded w-20 text-sm"
                      min="1"
                    />
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setUpgradeDialog({ show: false, user: null })}
                disabled={upgrading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600"
              >
                {upgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade User
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
