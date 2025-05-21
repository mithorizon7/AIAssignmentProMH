import { getUserInitials } from "@/lib/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ name, size = "md", className = "" }: UserAvatarProps) {
  const initials = getUserInitials(name);
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };
  
  const imgSizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };
  
  return (
    <Avatar className={`${sizeClasses[size]} bg-white border border-gray-200 ${className}`}>
      <AvatarImage src="/AcademusLogo.webp" alt={name} />
      <AvatarFallback className="bg-white p-1">
        <img src="/AcademusLogo.webp" alt="Academus Logo" className={imgSizeClasses[size]} />
      </AvatarFallback>
    </Avatar>
  );
}
