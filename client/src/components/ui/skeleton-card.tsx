import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * SkeletonCard component 
 * 
 * Renders a card skeleton with customizable content layout
 * Uses shimmer animation effect for better user experience
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5 shimmer">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          
          <Skeleton className="h-4 w-1/2" />
          
          <div className="flex">
            <Skeleton className="h-4 w-4 mr-2 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
      
      <div className="p-5 bg-blue-50/40 shimmer">
        <div className="flex justify-between items-center mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        
        <Skeleton className="h-4 w-full" />
      </div>
    </Card>
  );
}