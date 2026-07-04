import Skeleton from "../../components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-4 h-8 w-96" />
      <div className="mb-6 flex gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      <div className="mb-8 flex gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 flex-1 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mb-4 h-6 w-32" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
