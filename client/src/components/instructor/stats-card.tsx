import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconColor: string;
  change?: {
    value: string;
    positive?: boolean;
    neutral?: boolean;
    icon?: string;
  };
}

export function StatsCard({ title, value, icon, iconColor, change }: StatsCardProps) {
  const getChangeTextColor = () => {
    if (change?.neutral) return 'text-neutral-600';
    return change?.positive ? 'text-green-600' : 'text-red-600';
  };
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-neutral-500">{title}</div>
          <span className={`material-icons text-${iconColor}`}>{icon}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className={`text-sm ${getChangeTextColor()} mt-2 flex items-center`}>
            <span className="material-icons text-sm">
              {change.icon || (change.neutral 
                ? 'info' 
                : change.positive 
                  ? 'trending_up' 
                  : 'trending_down')}
            </span>
            <span>{change.value}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
