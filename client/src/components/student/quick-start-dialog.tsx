import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function QuickStartDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Quick Start
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Getting Started</DialogTitle>
          <DialogDescription>
            Learn the basics of submitting work and viewing AI feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p><strong>1.</strong> Browse available assignments from the Assignments page.</p>
          <p><strong>2.</strong> Submit your work to receive instant AI-powered feedback.</p>
          <p><strong>3.</strong> Review feedback anytime in your Submission History.</p>
          <p>
            For more details, see our{' '}
            <a href="/documentation" className="text-primary hover:underline">documentation</a>{' '}
            or visit the{' '}
            <a href="/help" className="text-primary hover:underline">help center</a>.
          </p>
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
