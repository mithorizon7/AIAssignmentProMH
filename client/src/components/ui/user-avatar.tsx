import { getUserInitials } from "@/lib/utils/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, size = "md", className = "" }: UserAvatarProps) {
  const initials = getUserInitials(name);
  
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };
  
  return (
    <Avatar className={`${sizeClasses[size]} bg-primary text-white ${className}`}>
      <AvatarFallback className="bg-primary text-white">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
