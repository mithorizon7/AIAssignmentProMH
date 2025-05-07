import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface TooltipInfoProps {
  content: React.ReactNode;
  className?: string;
}

export function TooltipInfo({ content, className }: TooltipInfoProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <HelpCircle className={`h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help inline-block ${className || ""}`} />
        </TooltipTrigger>
        <TooltipContent className="max-w-[320px] p-4 text-sm" side="right">
          <div className="space-y-2">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}