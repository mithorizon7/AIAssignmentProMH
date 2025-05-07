import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { APP_ROUTES } from "@/lib/constants";

interface ShareableLinkProps {
  assignmentId: number;
  shareableCode: string;
}

export function ShareableLink({ assignmentId, shareableCode }: ShareableLinkProps) {
  const [copied, setCopied] = useState(false);
  
  const fullUrl = `${window.location.origin}${APP_ROUTES.SUBMIT_BY_CODE(shareableCode)}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl)
      .then(() => {
        setCopied(true);
        toast({
          title: "Copied!",
          description: "Link copied to clipboard",
        });
        
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast({
          title: "Error",
          description: "Failed to copy link to clipboard",
          variant: "destructive",
        });
      });
  };
  
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Shareable Link</CardTitle>
        <CardDescription>
          Share this link with students who need to submit to this assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2">
          <Input 
            value={fullUrl} 
            readOnly 
            className="bg-secondary/10 font-mono text-sm" 
          />
          <Button
            onClick={handleCopy}
            variant={copied ? "secondary" : "default"}
            className="whitespace-nowrap"
          >
            <span className="material-icons-outlined text-sm mr-1">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          <span className="material-icons-outlined text-sm align-middle mr-1">info</span>
          Students don't need to create an account to submit using this link
        </p>
      </CardContent>
    </Card>
  );
}