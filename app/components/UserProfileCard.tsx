import type { PublicProfile } from "polymarket-client-ts";
import { truncateAddress } from "../lib/format";

interface UserProfileCardProps {
  profile: PublicProfile;
  address: string;
}

export default function UserProfileCard({
  profile,
  address,
}: UserProfileCardProps) {
  const displayName = profile.name ?? profile.pseudonym ?? truncateAddress(address);
  const avatarUrl = profile.profileImage;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border text-sm font-semibold text-muted">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground truncate">
            {displayName}
          </h2>
          {profile.verifiedBadge && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="#3b82f6"
              className="shrink-0"
            >
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          )}
        </div>
        <p className="text-xs text-muted font-mono">{truncateAddress(address)}</p>
        {profile.bio && (
          <p className="mt-1 text-xs text-muted line-clamp-2">{profile.bio}</p>
        )}
      </div>
    </div>
  );
}
