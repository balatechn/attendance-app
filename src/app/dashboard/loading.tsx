import { Skeleton, Card } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Check-in button skeleton */}
      <Card className="flex flex-col items-center py-8">
        <Skeleton className="w-20 h-20 rounded-full" />
      </Card>

      {/* Summary skeleton */}
      <Card>
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-6 w-6 mx-auto rounded-full" />
              <Skeleton className="h-4 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </Card>

      {/* Timeline skeleton */}
      <Card>
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-3 h-3 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
