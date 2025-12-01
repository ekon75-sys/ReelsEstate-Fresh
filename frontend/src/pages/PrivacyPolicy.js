import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <Link to="/" className="inline-flex items-center text-brand-orange-600 hover:text-brand-orange-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: November 15, 2024</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to ReelsEstate. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, and safeguard your information when you use our 
              AI-powered video creation platform for real estate professionals.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, and password when you register</li>
              <li><strong>Profile Information:</strong> Business name, contact details, and subscription plan</li>
              <li><strong>Content:</strong> Photos, videos, and descriptions you upload to create property videos</li>
              <li><strong>Social Media Connections:</strong> OAuth tokens when you connect LinkedIn, YouTube, Instagram, or Facebook</li>
              <li><strong>Usage Data:</strong> How you interact with our platform, features used, and performance metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and maintain our video creation services</li>
              <li>Generate AI-powered video descriptions and content</li>
              <li>Post videos to your connected social media accounts</li>
              <li>Process your subscription and payments</li>
              <li>Improve our services and develop new features</li>
              <li>Send you service updates and support communications</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Third-Party Integrations</h2>
            <p className="mb-3">We integrate with the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>LinkedIn:</strong> To post videos to your profile or company pages</li>
              <li><strong>YouTube:</strong> To upload videos to your YouTube channel</li>
              <li><strong>Instagram:</strong> To share videos to your Instagram feed and reels</li>
              <li><strong>Facebook:</strong> To post videos to your Facebook page or profile</li>
              <li><strong>AI Services:</strong> For generating video descriptions and metadata</li>
            </ul>
            <p className="mt-3">
              Each integration requires your explicit authorization via OAuth, and we only access the permissions 
              necessary for our services. You can revoke these connections at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Data Storage and Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption. We use MongoDB for data storage 
              and implement appropriate technical and organizational measures to protect your information against 
              unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data only as long as necessary to provide our services and fulfill the 
              purposes outlined in this privacy policy. You can request deletion of your account and associated 
              data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Disconnect social media integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember your preferences, 
              and analyze platform usage. You can control cookie settings through your browser.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
            <p>
              Our services are not intended for users under 18 years of age. We do not knowingly collect 
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of significant changes 
              via email or through our platform. Continued use of our services after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this privacy policy or how we handle your data, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              <p><strong>Email:</strong> privacy@reelsestate.com</p>
              <p><strong>Website:</strong> https://reelsestate.com</p>
            </div>
          </section>

          <section className="border-t pt-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">GDPR Compliance</h2>
            <p>
              For users in the European Union, we comply with the General Data Protection Regulation (GDPR). 
              You have additional rights under GDPR, including the right to lodge a complaint with a supervisory 
              authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
