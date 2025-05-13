import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareableLinkProps {
  assignmentId: number;
  shareableCode: string;
}

export function ShareableLink({ assignmentId, shareableCode }: ShareableLinkProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  // Create the shareable URL
  const shareableUrl = `${window.location.origin}/submit/${shareableCode}`;
  
  // Copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The link has been copied to your clipboard",
        className: "success-pulse",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Shareable Link</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50 flex items-center gap-1 press-effect"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: "Submit your assignment",
                text: "Use this link to submit your assignment",
                url: shareableUrl,
              }).catch(() => {
                // Fallback to copy if share fails
                copyToClipboard();
              });
            } else {
              // Fallback for browsers that don't support share API
              copyToClipboard();
            }
          }}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
      
      <div className="flex items-center">
        <Input
          value={shareableUrl}
          readOnly
          className="rounded-r-none field-focus-animation"
        />
        <Button 
          type="button"
          onClick={copyToClipboard}
          className={`rounded-l-none border border-l-0 px-3 h-10 press-effect ${copied ? 'bg-green-50 text-green-600 border-green-200' : ''}`}
          variant="outline"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Share this link with students who need to submit this assignment. No login required.
      </p>
    </div>
  );
}