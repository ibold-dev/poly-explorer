import Skeleton from "../components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="mb-1 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <Skeleton className="mb-6 h-8 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
