import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <Link to="/" className="inline-flex items-center text-brand-orange-600 hover:text-brand-orange-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: November 15, 2024</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ReelsEstate, you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              ReelsEstate is an AI-powered video creation platform designed for real estate professionals. 
              Our service allows you to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Create professional property videos from photos</li>
              <li>Generate AI-powered video descriptions and metadata</li>
              <li>Share videos to LinkedIn, YouTube, Instagram, and Facebook</li>
              <li>Enhance photos with AI-powered tools</li>
              <li>Apply custom branding to your videos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <p className="mb-3">When you create an account, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Be responsible for all activities under your account</li>
              <li>Use the service only for lawful purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Subscription Plans</h2>
            <p className="mb-3">ReelsEstate offers various subscription tiers:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Free Trial:</strong> 3-day trial with limited features</li>
              <li><strong>Professional:</strong> €20/month with enhanced features</li>
              <li><strong>Enterprise:</strong> €50/month with advanced features</li>
              <li><strong>Ultimate:</strong> €100/month with full access</li>
            </ul>
            <p className="mt-3">
              Subscriptions are billed monthly and automatically renew unless cancelled. 
              You can cancel your subscription at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Content Ownership and License</h2>
            <p className="mb-3"><strong>Your Content:</strong></p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You retain all rights to photos and videos you upload</li>
              <li>You grant us a license to process and display your content for service delivery</li>
              <li>You are responsible for ensuring you have rights to all uploaded content</li>
              <li>You may not upload copyrighted material without proper authorization</li>
            </ul>
            <p className="mt-3"><strong>Generated Content:</strong></p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Videos and AI-generated descriptions created by our platform belong to you</li>
              <li>You may use generated content for any lawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Acceptable Use Policy</h2>
            <p className="mb-3">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Upload content that infringes on intellectual property rights</li>
              <li>Upload offensive, defamatory, or inappropriate content</li>
              <li>Attempt to hack, reverse engineer, or compromise our systems</li>
              <li>Use automated systems to scrape or data mine our platform</li>
              <li>Resell or redistribute our services without permission</li>
              <li>Impersonate others or provide false information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Third-Party Integrations</h2>
            <p>
              Our platform integrates with third-party services (LinkedIn, YouTube, Instagram, Facebook). 
              Your use of these integrations is subject to their respective terms of service and privacy policies. 
              We are not responsible for the actions or policies of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. Disclaimers and Limitations</h2>
            <p className="mb-3"><strong>Service Availability:</strong></p>
            <p>
              ReelsEstate is provided "as is" without warranties of any kind. We do not guarantee uninterrupted 
              or error-free service. We reserve the right to modify or discontinue features at any time.
            </p>
            <p className="mt-3"><strong>AI-Generated Content:</strong></p>
            <p>
              AI-generated descriptions and metadata are suggestions only. You are responsible for reviewing 
              and verifying all AI-generated content before publishing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, ReelsEstate shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including loss of profits, data, 
              or business opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Refunds and Cancellations</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You may cancel your subscription at any time</li>
              <li>Cancellations take effect at the end of the current billing period</li>
              <li>No refunds for partial months</li>
              <li>Free trial cancellations must occur before the trial period ends</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account for violations of these terms, 
              fraudulent activity, or any other reason at our discretion. Upon termination, your right 
              to use the service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms of Service at any time. Significant changes will be communicated 
              via email or platform notification. Continued use after changes constitutes acceptance of 
              the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">13. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws. 
              Any disputes shall be resolved in the appropriate jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">14. Contact Information</h2>
            <p>
              For questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              <p><strong>Email:</strong> support@reelsestate.com</p>
              <p><strong>Website:</strong> https://reelsestate.com</p>
            </div>
          </section>

          <section className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-600">
              By using ReelsEstate, you acknowledge that you have read, understood, and agree to be bound 
              by these Terms of Service and our Privacy Policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
