import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
// Removed lucide-react imports due to TypeScript compatibility issues
import { toast } from "sonner";

interface UserDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
}

export function UserDashboard({ onArtistClick, onShowClick }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "following" | "contributions" | "notifications">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [editedBio, setEditedBio] = useState("");

  const user = useQuery(api.users.getCurrentUser);
  const userStats = useQuery(api.users.getUserStats);
  const userFollows = useQuery(api.users.getUserFollows);
  const userSetlists = useQuery(api.users.getUserSetlists);
  
  const updateProfile = useMutation(api.users.updateProfile);

  React.useEffect(() => {
    if (user && !isEditing) {
      setEditedUsername(user.username || "");
      setEditedBio(user.bio || "");
    }
  }, [user, isEditing]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        username: editedUsername,
        bio: editedBio,
      });
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderProfileTab = () => (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Profile</h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="text-sm">✏️</span>
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => void handleSaveProfile()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <span className="text-sm">💾</span>
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedUsername(user.username || "");
                setEditedBio(user.bio || "");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <span className="text-sm">❌</span>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <div className="w-10 h-10 text-muted-foreground flex items-center justify-center text-2xl">👤</div>
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Bio</label>
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Tell us about yourself"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-semibold">{user.username}</h3>
              <p className="text-muted-foreground mt-1">{user.bio || "No bio yet"}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {userStats?.totalVotes || 0}
          </div>
          <div className="text-sm text-muted-foreground">Votes Cast</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {userStats?.totalFollows || 0}
          </div>
          <div className="text-sm text-muted-foreground">Artists Following</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {userStats?.totalSetlists || 0}
          </div>
          <div className="text-sm text-muted-foreground">Setlists Created</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {userStats?.joinedAt ? Math.floor((Date.now() - userStats.joinedAt) / (1000 * 60 * 60 * 24)) : 0}
          </div>
          <div className="text-sm text-muted-foreground">Days Active</div>
        </div>
      </div>
    </div>
  );

  const renderFollowingTab = () => (
    <div className="dashboard-card">
      <h2 className="text-xl font-bold mb-4">Following Artists</h2>
      {!userFollows || userFollows.length === 0 ? (
        <div className="text-center py-8">
          <div className="mx-auto mb-4 opacity-50 w-12 h-12 flex items-center justify-center text-3xl">❤️</div>
          <p className="text-muted-foreground">You're not following any artists yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Follow artists to get updates on their shows and setlists.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userFollows.map((follow) => (
            <div
              key={follow._id}
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
              onClick={() => onArtistClick(follow.artistId)}
            >
              {follow.artist?.images?.[0] && (
                <img
                  src={follow.artist.images[0]}
                  alt={follow.artist.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-medium">{follow.artist?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {follow.artist?.genres?.slice(0, 2).join(", ") || "Music"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderContributionsTab = () => (
    <div className="dashboard-card">
      <h2 className="text-xl font-bold mb-4">My Contributions</h2>
      {!userSetlists || userSetlists.length === 0 ? (
        <div className="text-center py-8">
          <div className="mx-auto mb-4 opacity-50 w-12 h-12 flex items-center justify-center text-3xl">🎵</div>
          <p className="text-muted-foreground">You haven't created any setlists yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Start contributing by creating setlists for shows you've attended.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {userSetlists.filter(setlist => setlist != null).map((setlist) => (
            <div
              key={setlist._id}
              className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
              onClick={() => onShowClick(setlist.showId)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{setlist.show?.artist?.name || 'Unknown Artist'}</h3>
                <span className="text-sm text-muted-foreground">
                  {setlist.show?.date || 'No date'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {setlist.show?.venue?.name || 'Unknown Venue'}, {setlist.show?.venue?.city || 'Unknown City'}
              </p>
              <p className="text-sm">
                {setlist.songs?.length || 0} songs
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="dashboard-card">
      <h2 className="text-xl font-bold mb-4">Notifications</h2>
      <div className="text-center py-8">
        <div className="mx-auto mb-4 opacity-50 w-12 h-12 flex items-center justify-center text-3xl">🔔</div>
        <p className="text-muted-foreground">No notifications yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          You'll receive notifications about artists you follow and setlist updates.
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your profile, following, and contributions
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "profile"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-sm mr-2">👤</span>
          Profile
        </button>
        <button
          onClick={() => setActiveTab("following")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "following"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-sm mr-2">❤️</span>
          Following ({userFollows?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("contributions")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "contributions"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-sm mr-2">🎵</span>
          Contributions ({userSetlists?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "notifications"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-sm mr-2">🔔</span>
          Notifications
        </button>
      </div>

      {activeTab === "profile" && renderProfileTab()}
      {activeTab === "following" && renderFollowingTab()}
      {activeTab === "contributions" && renderContributionsTab()}
      {activeTab === "notifications" && renderNotificationsTab()}
    </div>
  );
}

// Add CSS for dashboard cards
const styles = `
.dashboard-card {
  @apply bg-card border rounded-lg p-6 shadow-sm;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}