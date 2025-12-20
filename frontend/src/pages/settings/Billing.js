import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';


const BillingSettings = () => {
  const [loading, setLoading] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [formData, setFormData] = useState({
    vat_number: '',
    billing_address: '',
    payment_method: ''
  });
  const [cardData, setCardData] = useState({
    card_number: '',
    card_holder: '',
    expiry_month: '',
    expiry_year: '',
    cvv: ''
  });
  const [savedCards, setSavedCards] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);

  useEffect(() => {
    loadBilling();
    loadBusinessInfo();
  }, []);

  const loadBilling = async () => {
    try {
      const response = await axios.get(`${API_URL}/billing`, {
        withCredentials: true
      });
      if (response.data && response.data.vat_number) {
        setFormData(response.data);
        // Parse saved cards if available
        if (response.data.saved_cards) {
          setSavedCards(JSON.parse(response.data.saved_cards));
        }
      }
    } catch (error) {
      console.error('Failed to load billing:', error);
    }
  };

  const loadBusinessInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/business-info`, {
        withCredentials: true
      });
      if (response.data && response.data.company_name) {
        setBusinessInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/billing`, {
        ...formData,
        saved_cards: JSON.stringify(savedCards)
      }, {
        withCredentials: true
      });
      toast.success('Billing information updated!');
    } catch (error) {
      toast.error('Failed to update billing');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    
    // Validate card number (basic validation)
    if (cardData.card_number.replace(/\s/g, '').length < 13) {
      toast.error('Invalid card number');
      return;
    }

    const newCard = {
      id: Date.now().toString(),
      last4: cardData.card_number.slice(-4),
      brand: detectCardBrand(cardData.card_number),
      expiry: `${cardData.expiry_month}/${cardData.expiry_year}`,
      holder: cardData.card_holder,
      is_default: savedCards.length === 0
    };

    const updatedCards = [...savedCards, newCard];
    setSavedCards(updatedCards);

    // Save to backend
    try {
      await axios.post(`${API_URL}/billing`, {
        ...formData,
        saved_cards: JSON.stringify(updatedCards),
        payment_method: `${newCard.brand} ending in ${newCard.last4}`
      }, {
        withCredentials: true
      });
      toast.success('Card added successfully!');
      setShowAddCard(false);
      setCardData({
        card_number: '',
        card_holder: '',
        expiry_month: '',
        expiry_year: '',
        cvv: ''
      });
    } catch (error) {
      toast.error('Failed to add card');
    }
  };

  const handleSetDefaultCard = async (cardId) => {
    const updatedCards = savedCards.map(card => ({
      ...card,
      is_default: card.id === cardId
    }));
    setSavedCards(updatedCards);

    const defaultCard = updatedCards.find(c => c.id === cardId);
    try {
      await axios.post(`${API_URL}/billing`, {
        ...formData,
        saved_cards: JSON.stringify(updatedCards),
        payment_method: `${defaultCard.brand} ending in ${defaultCard.last4}`
      }, {
        withCredentials: true
      });
      toast.success('Default card updated!');
    } catch (error) {
      toast.error('Failed to update default card');
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!confirm('Are you sure you want to remove this card?')) return;

    const updatedCards = savedCards.filter(card => card.id !== cardId);
    
    // If deleted card was default, make first card default
    if (updatedCards.length > 0) {
      const wasDefault = savedCards.find(c => c.id === cardId)?.is_default;
      if (wasDefault) {
        updatedCards[0].is_default = true;
      }
    }

    setSavedCards(updatedCards);

    try {
      await axios.post(`${API_URL}/billing`, {
        ...formData,
        saved_cards: JSON.stringify(updatedCards),
        payment_method: updatedCards.length > 0 ? `${updatedCards[0].brand} ending in ${updatedCards[0].last4}` : ''
      }, {
        withCredentials: true
      });
      toast.success('Card removed!');
    } catch (error) {
      toast.error('Failed to remove card');
    }
  };

  const detectCardBrand = (number) => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'Amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    return 'Card';
  };

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  return (
    <div className="space-y-6">
      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Billing Information
          </CardTitle>
          <CardDescription>Manage your billing details and tax information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Billing Address</Label>
              {businessInfo ? (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-gray-900">{businessInfo.company_name}</p>
                    {businessInfo.commercial_name && businessInfo.commercial_name !== businessInfo.company_name && (
                      <p className="text-gray-700">({businessInfo.commercial_name})</p>
                    )}
                    <p className="text-gray-700">{businessInfo.address}</p>
                    <p className="text-gray-700">
                      {businessInfo.postal_code} {businessInfo.region}, {businessInfo.country}
                    </p>
                    {businessInfo.vat_number && (
                      <p className="text-gray-700 mt-2">VAT: {businessInfo.vat_number}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    To update billing address, go to <a href="/settings/business" className="text-brand-orange-600 hover:underline">Business Settings</a>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  No billing address set. Complete your business information in <a href="/settings/business" className="text-brand-orange-600 hover:underline">Business Settings</a>.
                </p>
              )}
            </div>

            <Button type="submit" className="bg-brand-orange-500 hover:bg-brand-orange-600" disabled={loading}>
              {loading ? 'Saving...' : 'Save Billing Info'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your credit cards and payment options</CardDescription>
            </div>
            <Button 
              onClick={() => setShowAddCard(!showAddCard)} 
              className="bg-brand-orange-500 hover:bg-brand-orange-600"
              data-testid="add-card-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedCards.length === 0 && !showAddCard && (
            <p className="text-center text-gray-500 py-8">No payment methods added yet</p>
          )}

          {/* Saved Cards */}
          <div className="space-y-3">
            {savedCards.map(card => (
              <div 
                key={card.id} 
                className={`flex items-center justify-between p-4 border-2 rounded-lg ${
                  card.is_default ? 'border-brand-orange-500 bg-brand-orange-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center text-white font-bold">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{card.brand} •••• {card.last4}</p>
                      {card.is_default && (
                        <span className="px-2 py-1 bg-brand-orange-500 text-white text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{card.holder}</p>
                    <p className="text-sm text-gray-500">Expires {card.expiry}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!card.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefaultCard(card.id)}
                      data-testid={`set-default-${card.id}`}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Set Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-card-${card.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Card Form */}
          {showAddCard && (
            <Card className="border-2 border-brand-orange-200 bg-brand-orange-50/50">
              <CardHeader>
                <CardTitle className="text-lg">Add New Card</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCard} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="card_number">Card Number *</Label>
                    <Input
                      id="card_number"
                      value={cardData.card_number}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16));
                        setCardData(prev => ({ ...prev, card_number: formatted }));
                      }}
                      placeholder="1234 5678 9012 3456"
                      required
                      maxLength={19}
                      data-testid="card-number-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="card_holder">Cardholder Name *</Label>
                    <Input
                      id="card_holder"
                      value={cardData.card_holder}
                      onChange={(e) => setCardData(prev => ({ ...prev, card_holder: e.target.value }))}
                      placeholder="John Doe"
                      required
                      data-testid="card-holder-input"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry_month">Month *</Label>
                      <Input
                        id="expiry_month"
                        value={cardData.expiry_month}
                        onChange={(e) => setCardData(prev => ({ ...prev, expiry_month: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                        placeholder="MM"
                        required
                        maxLength={2}
                        data-testid="expiry-month-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry_year">Year *</Label>
                      <Input
                        id="expiry_year"
                        value={cardData.expiry_year}
                        onChange={(e) => setCardData(prev => ({ ...prev, expiry_year: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                        placeholder="YY"
                        required
                        maxLength={2}
                        data-testid="expiry-year-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV *</Label>
                      <Input
                        id="cvv"
                        type="password"
                        value={cardData.cvv}
                        onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="123"
                        required
                        maxLength={4}
                        data-testid="cvv-input"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <Button type="submit" className="bg-brand-orange-500 hover:bg-brand-orange-600" data-testid="save-card-btn">
                      Add Card
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddCard(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              🔒 <strong>Secure Payment:</strong> Your payment information is encrypted and securely stored. We never store your full card number or CVV.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSettings;
