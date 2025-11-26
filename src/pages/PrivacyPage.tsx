import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to SetlistVote ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our concert setlist voting platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Account Information</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Email address (via Clerk authentication)</li>
              <li>Username or display name</li>
              <li>Profile information you choose to provide</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Usage Data</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Setlist predictions and votes</li>
              <li>Artist preferences and follows</li>
              <li>Show attendance and interactions</li>
              <li>Activity logs and timestamps</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Optional Integrations</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Spotify account data (if you connect Spotify)</li>
              <li>Followed artists and listening preferences</li>
              <li>Google account information (if you sign in with Google)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Technical Data</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>IP address and browser information</li>
              <li>Device type and operating system</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Provide Services:</strong> Enable setlist voting, predictions, and community features</li>
              <li><strong>Personalization:</strong> Show relevant artists, shows, and recommendations</li>
              <li><strong>Communication:</strong> Send notifications about shows, votes, and updates (if enabled)</li>
              <li><strong>Analytics:</strong> Improve our platform and understand user behavior</li>
              <li><strong>Security:</strong> Prevent fraud, abuse, and unauthorized access</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Data Sharing and Third Parties</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">We Share Data With:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Clerk:</strong> Authentication and user management</li>
              <li><strong>Convex:</strong> Database and backend infrastructure</li>
              <li><strong>Spotify:</strong> Artist data and optional account integration</li>
              <li><strong>Ticketmaster:</strong> Concert and venue information</li>
              <li><strong>Setlist.fm:</strong> Official setlist data</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">We Do NOT:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Sell your personal data to third parties</li>
              <li>Share your data for advertising purposes</li>
              <li>Use your data for purposes other than stated here</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
            <p className="text-muted-foreground mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Download your data in a portable format</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from email notifications</li>
              <li><strong>Object:</strong> Object to certain data processing activities</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, please contact us at [your-email@example.com]
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
              <li>Encryption in transit (HTTPS/TLS)</li>
              <li>Secure authentication via Clerk</li>
              <li>Role-based access controls</li>
              <li>Regular security audits</li>
              <li>Secure database infrastructure via Convex</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Maintain your login session</li>
              <li>Remember your preferences</li>
              <li>Analyze site usage and performance</li>
              <li>Provide personalized content</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You can control cookies through your browser settings, but some features may not work properly if cookies are disabled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this privacy policy and applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of the service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this privacy policy or our data practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <p className="text-foreground">Email: privacy@setlists.live</p>
              <p className="text-foreground mt-2">Website: https://setlists.live</p>
            </div>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-2xl font-bold mb-4">GDPR Compliance (EU Users)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Right to data portability</li>
              <li>Right to restrict processing</li>
              <li>Right to object to automated decision-making</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-2xl font-bold mb-4">CCPA Compliance (California Users)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to opt-out of the sale of personal information</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              <strong>Note:</strong> We do not sell your personal information.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-muted-foreground">
            By using SetlistVote, you agree to this Privacy Policy and our{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
