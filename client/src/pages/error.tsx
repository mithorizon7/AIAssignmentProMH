import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
