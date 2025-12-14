import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const DataDeletion = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-3xl font-bold mb-6">Data Deletion Instructions</h1>
            
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-2xl font-semibold mb-3">How to Request Data Deletion</h2>
                <p className="mb-4">
                  At ReelsEstate, we respect your privacy and provide you with full control over your personal data. 
                  If you wish to delete your account and all associated data, please follow the instructions below.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Automatic Data Deletion</h2>
                <p className="mb-4">
                  You can delete your account and data directly from within the application:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to your ReelsEstate account</li>
                  <li>Navigate to Settings → Account Settings</li>
                  <li>Click on "Delete Account"</li>
                  <li>Confirm your decision</li>
                  <li>Your account and all associated data will be permanently deleted within 24 hours</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Manual Data Deletion Request</h2>
                <p className="mb-4">
                  Alternatively, you can request data deletion by contacting us directly:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Email:</strong> privacy@reels-estate.app</li>
                  <li><strong>Subject Line:</strong> "Data Deletion Request"</li>
                  <li><strong>Include:</strong> Your registered email address and full name</li>
                </ul>
                <p className="mt-4">
                  We will process your request within 30 days and send you a confirmation email once completed.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">What Data is Deleted</h2>
                <p className="mb-4">When you request data deletion, the following information will be permanently removed:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Your account profile information (name, email, phone number)</li>
                  <li>Business information provided during onboarding</li>
                  <li>Branding preferences and uploaded logos</li>
                  <li>Connected social media accounts and access tokens</li>
                  <li>All created real estate listings and projects</li>
                  <li>Uploaded photos and generated videos</li>
                  <li>Subscription and billing history</li>
                  <li>Usage analytics and activity logs</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Facebook Data</h2>
                <p className="mb-4">
                  If you connected your Facebook account to ReelsEstate, deleting your account will:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Revoke all access tokens stored by ReelsEstate</li>
                  <li>Remove the connection between your Facebook account and ReelsEstate</li>
                  <li>Delete any Facebook Page information stored in our database</li>
                </ul>
                <p className="mt-4">
                  <strong>Note:</strong> Content already posted to Facebook will remain on Facebook. 
                  You will need to delete posts directly from Facebook if desired.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Data Retention</h2>
                <p className="mb-4">
                  After deletion, we may retain certain information for legal compliance purposes only:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Transaction records (required for tax and financial regulations): 7 years</li>
                  <li>Backup copies: Automatically deleted within 90 days</li>
                  <li>Aggregated, anonymized analytics: May be retained indefinitely</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about data deletion or our privacy practices, please contact us:
                </p>
                <ul className="list-none space-y-2">
                  <li><strong>Email:</strong> privacy@reels-estate.app</li>
                  <li><strong>Support:</strong> support@reels-estate.app</li>
                </ul>
              </section>

              <section className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataDeletion;
