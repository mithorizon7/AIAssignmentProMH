import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  Calendar, 
  AlertTriangle, 
  TrendingUp,
  Database,
  Play
} from 'lucide-react';

interface StatusAnalysis {
  stats: {
    total: number;
    upcoming: number;
    active: number;
    completed: number;
    percentages: {
      upcoming: number;
      active: number;
      completed: number;
    };
  };
  assignments: {
    upcoming: any[];
    active: any[];
    completed: any[];
  };
  statusMismatches: any[];
  analysis: {
    automatedStatusPreferred: boolean;
    mismatches: number;
    message: string;
  };
}

export function AssignmentStatusManager() {
  const [preferAutomated, setPreferAutomated] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch status analysis
  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<StatusAnalysis>({
    queryKey: ['/api/assignments/status-analysis', { preferAutomated }],
    queryFn: () => apiRequest(`/api/assignments/status-analysis?preferAutomated=${preferAutomated}`),
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      return apiRequest('/api/assignments/update-statuses', {
        method: 'POST',
        body: JSON.stringify({ dryRun }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      toast({
        title: data.dryRun ? "Status Preview" : "Statuses Updated",
        description: data.message,
        variant: data.updated > 0 ? "default" : "secondary"
      });
      if (!data.dryRun) {
        refetchAnalysis();
        queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update assignment statuses",
        variant: "destructive"
      });
    }
  });

  const handleBulkUpdate = (dryRun: boolean) => {
    bulkUpdateMutation.mutate({ dryRun });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case 'active':
        return <Clock className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (analysisLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Assignment Status Manager
          </CardTitle>
          <CardDescription>Loading status analysis...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Assignment Status Manager
          </CardTitle>
          <CardDescription>
            Manage automated status updates based on assignment due dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant={preferAutomated ? "default" : "outline"}
              size="sm"
              onClick={() => setPreferAutomated(true)}
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Automated Status
            </Button>
            <Button
              variant={!preferAutomated ? "default" : "outline"}
              size="sm"
              onClick={() => setPreferAutomated(false)}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Manual Status
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleBulkUpdate(true)}
              variant="outline"
              size="sm"
              disabled={bulkUpdateMutation.isPending}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${bulkUpdateMutation.isPending ? 'animate-spin' : ''}`} />
              Preview Changes
            </Button>
            <Button
              onClick={() => handleBulkUpdate(false)}
              size="sm"
              disabled={bulkUpdateMutation.isPending}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Apply Updates
            </Button>
            <Button
              onClick={() => refetchAnalysis()}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.stats.upcoming}</p>
                    <p className="text-sm text-muted-foreground">Upcoming</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.stats.active}</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.stats.completed}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-2xl font-bold">{analysis.statusMismatches.length}</p>
                    <p className="text-sm text-muted-foreground">Mismatches</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Mismatches Alert */}
          {analysis.statusMismatches.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {analysis.analysis.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Assignment Lists */}
          <Tabs defaultValue="mismatches" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="mismatches">
                Mismatches ({analysis.statusMismatches.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({analysis.stats.upcoming})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({analysis.stats.active})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({analysis.stats.completed})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mismatches">
              <Card>
                <CardHeader>
                  <CardTitle>Status Mismatches</CardTitle>
                  <CardDescription>
                    Assignments where manual status differs from calculated status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysis.statusMismatches.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No status mismatches found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analysis.statusMismatches.map((assignment: any) => (
                        <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Due: {new Date(assignment.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm">Manual:</p>
                              <Badge variant="outline" className={getStatusColor(assignment.manualStatus)}>
                                {getStatusIcon(assignment.manualStatus)}
                                {assignment.manualStatus}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">Calculated:</p>
                              <Badge variant="outline" className={getStatusColor(assignment.calculatedStatus)}>
                                {getStatusIcon(assignment.calculatedStatus)}
                                {assignment.calculatedStatus}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {(['upcoming', 'active', 'completed'] as const).map((status) => (
              <TabsContent key={status} value={status}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {status.charAt(0).toUpperCase() + status.slice(1)} Assignments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysis.assignments[status].length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No {status} assignments found
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {analysis.assignments[status].map((assignment: any) => (
                          <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{assignment.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Due: {new Date(assignment.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline" className={getStatusColor(assignment.effectiveStatus)}>
                              {getStatusIcon(assignment.effectiveStatus)}
                              {assignment.effectiveStatus}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}