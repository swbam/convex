import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import {
  Loader2,
  CheckCircle,
  Mail,
  User,
  Building,
  Globe,
  ArrowRight,
  ArrowLeft,
  Music,
} from "lucide-react";
import { toast } from "sonner";

type ClaimStep = "loading" | "email" | "verify" | "details" | "review" | "submitted";

const ROLES = [
  { value: "artist", label: "I am the artist", description: "You are the actual performing artist" },
  { value: "manager", label: "Manager", description: "You manage this artist" },
  { value: "agent", label: "Booking Agent", description: "You book shows for this artist" },
  { value: "label", label: "Label Representative", description: "You represent the artist's label" },
  { value: "publicist", label: "Publicist / PR", description: "You handle PR for this artist" },
  { value: "team", label: "Other Team Member", description: "You work with this artist" },
] as const;

export function ArtistClaimPage() {
  const navigate = useNavigate();
  const { artistId } = useParams();
  const { user, isLoaded } = useUser();

  // State
  const [step, setStep] = useState<ClaimStep>("loading");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string>("artist");
  const [organization, setOrganization] = useState("");
  const [website, setWebsite] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);

  // Convex
  const startClaim = useMutation((api as any).artistClaims.startClaim);
  const requestVerification = useAction((api as any).artistClaims.requestEmailVerification);
  const verifyCode = useMutation((api as any).artistClaims.verifyEmailCode);
  const updateDetails = useMutation((api as any).artistClaims.updateClaimDetails);
  const submitClaim = useMutation((api as any).artistClaims.submitClaim);
  
  const claim = useQuery(
    (api as any).artistClaims.getClaim,
    claimId ? { claimId } : "skip"
  );

  // Get artist info
  const artist = useQuery(
    (api as any).artists.getById,
    artistId ? { id: artistId } : "skip"
  );

  // Initialize claim on mount
  useEffect(() => {
    if (!artistId || !isLoaded || !user) return;

    const initClaim = async () => {
      try {
        const result = await startClaim({ artistId });
        if (result.success && result.claimId) {
          setClaimId(result.claimId);
          // Resume at correct step based on status
          if (result.status === "verifying") {
            setStep("verify");
          } else {
            setStep("email");
          }
        } else if (result.status === "already_member") {
          toast.info("You already have access to this artist");
          navigate(`/for-artists/${artistId}`);
        } else if (result.status === "pending") {
          toast.info("Your claim is pending review");
          navigate("/for-artists");
        } else if (result.status === "approved") {
          navigate(`/for-artists/${artistId}`);
        } else {
          toast.error(result.message || "Failed to start claim");
          navigate("/for-artists");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to start claim");
        navigate("/for-artists");
      }
    };

    initClaim();
  }, [artistId, isLoaded, user]);

  // Update step when claim data changes
  useEffect(() => {
    if (!claim) return;
    
    if (claim.emailVerified && !claim.officialRole) {
      setStep("details");
    } else if (claim.emailVerified && claim.officialRole && claim.status === "verifying") {
      setStep("review");
    } else if (claim.status === "pending") {
      setStep("submitted");
    }
  }, [claim]);

  // Handlers
  const handleSendCode = async () => {
    if (!claimId || !email) return;
    setLoading(true);
    try {
      const result = await requestVerification({ claimId, email });
      if (result.success) {
        toast.success("Verification code sent!");
        setStep("verify");
      } else {
        toast.error(result.message || "Failed to send code");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send code");
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!claimId || !code) return;
    setLoading(true);
    try {
      const result = await verifyCode({ claimId, code });
      if (result.success) {
        toast.success("Email verified!");
        setStep("details");
      } else {
        toast.error(result.message || "Invalid code");
      }
    } catch (error: any) {
      toast.error(error.message || "Verification failed");
    }
    setLoading(false);
  };

  const handleSaveDetails = async () => {
    if (!claimId || !role) return;
    setLoading(true);
    try {
      const links = socialLinks.split("\n").map(s => s.trim()).filter(Boolean);
      const result = await updateDetails({
        claimId,
        officialRole: role as any,
        organizationName: organization || undefined,
        officialWebsite: website || undefined,
        socialLinks: links.length > 0 ? links : undefined,
        additionalContext: context || undefined,
      });
      if (result.success) {
        setStep("review");
      } else {
        toast.error(result.message || "Failed to save");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const result = await submitClaim({ claimId });
      if (result.success) {
        toast.success("Claim submitted for review!");
        setStep("submitted");
      } else {
        toast.error(result.message || "Failed to submit");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit");
    }
    setLoading(false);
  };

  // Render loading
  if (!isLoaded || step === "loading") {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Setting up your claim...</p>
        </div>
      </AppLayout>
    );
  }

  // Header with artist info
  const artistHeader = artist && (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
        {artist.images?.[0] ? (
          <img src={artist.images[0]} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <Music className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold">{artist.name}</h1>
        <p className="text-muted-foreground">Claim artist access</p>
      </div>
    </div>
  );

  // Step indicator
  const steps = [
    { id: "email", label: "Email" },
    { id: "verify", label: "Verify" },
    { id: "details", label: "Details" },
    { id: "review", label: "Review" },
  ];
  const currentStepIndex = steps.findIndex(s => s.id === step);

  const stepIndicator = step !== "submitted" && (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              i <= currentStepIndex
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {i < currentStepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 ${i < currentStepIndex ? "bg-primary" : "bg-secondary"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/for-artists")}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {artistHeader}
        {stepIndicator}

        {/* Step: Email */}
        {step === "email" && (
          <MagicCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your official email address
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 rounded-lg bg-secondary border border-border px-4 text-foreground"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use your official email (management, label, or personal if you're the artist)
                </p>
              </div>

              <Button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send verification code
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </MagicCard>
        )}

        {/* Step: Verify Code */}
        {step === "verify" && (
          <MagicCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Enter verification code</h2>
                <p className="text-sm text-muted-foreground">
                  Check your email for the 6-digit code
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Verification code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full h-14 rounded-lg bg-secondary border border-border px-4 text-2xl text-center tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setStep("email")}
                className="w-full"
              >
                Use different email
              </Button>
            </div>
          </MagicCard>
        )}

        {/* Step: Details */}
        {step === "details" && (
          <MagicCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Your connection</h2>
                <p className="text-sm text-muted-foreground">
                  How are you connected to this artist?
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Role selection */}
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      role === r.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{r.label}</div>
                      <div className="text-sm text-muted-foreground">{r.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Organization (if not artist) */}
              {role !== "artist" && (
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Organization (optional)
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g., Republic Records, WME"
                    className="w-full h-12 rounded-lg bg-secondary border border-border px-4 text-foreground"
                  />
                </div>
              )}

              {/* Website */}
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Official website (optional)
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="w-full h-12 rounded-lg bg-secondary border border-border px-4 text-foreground"
                />
              </div>

              {/* Social links */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Social media links (optional)
                </label>
                <textarea
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  placeholder="One link per line:&#10;https://instagram.com/artist&#10;https://twitter.com/artist"
                  rows={3}
                  className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-foreground resize-none"
                />
              </div>

              {/* Additional context */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Anything else? (optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Any additional info that helps verify your connection..."
                  rows={2}
                  className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-foreground resize-none"
                />
              </div>

              <Button
                onClick={handleSaveDetails}
                disabled={loading || !role}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </MagicCard>
        )}

        {/* Step: Review */}
        {step === "review" && claim && (
          <MagicCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Review & submit</h2>
                <p className="text-sm text-muted-foreground">
                  Make sure everything looks right
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{claim.verificationEmail}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{claim.officialRole}</span>
              </div>
              {claim.organizationName && (
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium">{claim.organizationName}</span>
                </div>
              )}
              {claim.officialWebsite && (
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Website</span>
                  <a href={claim.officialWebsite} className="font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {claim.officialWebsite}
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit for review"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep("details")}
                className="w-full"
              >
                Edit details
              </Button>
            </div>
          </MagicCard>
        )}

        {/* Step: Submitted */}
        {step === "submitted" && (
          <MagicCard className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Claim submitted!</h2>
            <p className="text-muted-foreground mb-8">
              We'll review your request and email you when it's approved.
              This usually takes less than 24 hours.
            </p>
            <Button onClick={() => navigate("/for-artists")} className="w-full" size="lg">
              Back to For Artists
            </Button>
          </MagicCard>
        )}
      </div>
    </AppLayout>
  );
}
