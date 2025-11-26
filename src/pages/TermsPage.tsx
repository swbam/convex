import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using SetlistVote ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              SetlistVote is a platform that allows users to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Predict and vote on concert setlists</li>
              <li>Follow artists and track upcoming shows</li>
              <li>View official setlists from past concerts</li>
              <li>Participate in a community of music fans</li>
              <li>Connect with Spotify to import artist preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">User Accounts</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Account Creation</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You must be at least 13 years old to create an account</li>
              <li>You must provide accurate and complete information</li>
              <li>You are responsible for maintaining account security</li>
              <li>You may not share your account with others</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Account Termination</h3>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account if you violate these Terms or engage in abusive behavior.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">User Conduct</h2>
            <p className="text-muted-foreground mb-4">You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Violate any laws or regulations</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Post spam, malware, or malicious content</li>
              <li>Manipulate votes or gaming the system</li>
              <li>Impersonate others or create fake accounts</li>
              <li>Scrape or collect data without permission</li>
              <li>Interfere with the Service's operation</li>
              <li>Use automated tools (bots) without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Content and Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Your Content</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You retain ownership of content you submit (setlist predictions, votes, etc.)</li>
              <li>You grant us a license to use, display, and distribute your content</li>
              <li>You are responsible for the content you post</li>
              <li>You must have rights to any content you submit</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Our Content</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The Service, design, and features are owned by SetlistVote</li>
              <li>You may not copy, modify, or distribute our content</li>
              <li>Artist data is sourced from Spotify and Ticketmaster</li>
              <li>Setlist data is sourced from setlist.fm</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Service integrates with third-party services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Clerk:</strong> Authentication and user management</li>
              <li><strong>Spotify:</strong> Artist data and optional account integration</li>
              <li><strong>Ticketmaster:</strong> Concert and venue information</li>
              <li><strong>Setlist.fm:</strong> Official setlist data</li>
            </ul>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Your use of these services is subject to their respective terms and privacy policies. We are not responsible for third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Disclaimers and Limitations</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Service "As Is"</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
              <li>Uninterrupted or error-free operation</li>
              <li>Accuracy of setlist predictions or data</li>
              <li>Availability of specific features</li>
              <li>Compatibility with all devices</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Limitation of Liability</h3>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, SetlistVote shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . Please review it to understand how we collect, use, and protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Modifications to Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless SetlistVote from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Dispute Resolution</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">Governing Law</h3>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the United States, without regard to conflict of law principles.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Arbitration</h3>
            <p className="text-muted-foreground leading-relaxed">
              Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <p className="text-foreground">Email: legal@setlists.live</p>
              <p className="text-foreground mt-2">Website: https://setlists.live</p>
            </div>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-2xl font-bold mb-4">Acceptable Use Policy</h2>
            <p className="text-muted-foreground mb-4">
              In addition to the User Conduct section above, you specifically agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Create multiple accounts to manipulate votes</li>
              <li>Use the Service for commercial purposes without permission</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Bypass rate limits or security measures</li>
              <li>Post false or misleading setlist information</li>
              <li>Engage in vote brigading or coordinated manipulation</li>
            </ul>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-2xl font-bold mb-4">Data Accuracy</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to provide accurate information, we cannot guarantee the accuracy of:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
              <li>Concert dates, times, and venues</li>
              <li>Setlist predictions and community votes</li>
              <li>Artist information and discographies</li>
              <li>Ticket availability and pricing</li>
            </ul>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Always verify concert information with official sources before making plans or purchases.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="text-2xl font-bold mb-4">Copyright and DMCA</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We respect intellectual property rights. If you believe content on the Service infringes your copyright, please contact us with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Description of the copyrighted work</li>
              <li>Location of the infringing content</li>
              <li>Your contact information</li>
              <li>A statement of good faith belief</li>
              <li>Your electronic or physical signature</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-muted-foreground">
            By using SetlistVote, you agree to these Terms of Service and our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-center text-muted-foreground mt-4 text-sm">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
