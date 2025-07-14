import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  Server, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  validateApiResponseWithFallback,
  systemHealthSchema,
  productionReadinessSchema,
  securityHealthSchema,
  recoveryStatusSchema,
  defaultSystemHealth,
  defaultProductionReadiness,
  defaultSecurityHealth,
  defaultRecoveryStatus,
  type SystemHealth,
  type ProductionReadiness,
  type SecurityHealth,
  type RecoveryStatus,
  type HealthCheck
} from '@/lib/api-schemas';

// Type definitions are now imported from api-schemas.ts

// Status badge component with proper typing
interface StatusBadgeProps {
  status: 'pass' | 'fail' | 'warn' | 'healthy' | 'degraded' | 'unhealthy' | 'secure' | 'monitoring' | 'threat_detected';
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const variants = {
    pass: { color: 'bg-green-500', text: 'Healthy', textColor: 'text-green-700' },
    healthy: { color: 'bg-green-500', text: 'Healthy', textColor: 'text-green-700' },
    secure: { color: 'bg-green-500', text: 'Secure', textColor: 'text-green-700' },
    warn: { color: 'bg-yellow-500', text: 'Warning', textColor: 'text-yellow-700' },
    degraded: { color: 'bg-yellow-500', text: 'Degraded', textColor: 'text-yellow-700' },
    monitoring: { color: 'bg-yellow-500', text: 'Monitoring', textColor: 'text-yellow-700' },
    fail: { color: 'bg-red-500', text: 'Failed', textColor: 'text-red-700' },
    unhealthy: { color: 'bg-red-500', text: 'Unhealthy', textColor: 'text-red-700' },
    threat_detected: { color: 'bg-red-500', text: 'Threat Detected', textColor: 'text-red-700' }
  } as const;

  const variant = variants[status] || variants.fail;
  
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${variant.color}`} />
      <span className={`text-sm font-medium ${variant.textColor}`}>{variant.text}</span>
    </div>
  );
};

export default function SystemStatusPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/health/detailed'],
    refetchInterval: autoRefresh ? 30000 : false
  });

  const { data: productionReadiness, isLoading: readinessLoading } = useQuery({
    queryKey: ['/api/admin/production-readiness'],
    refetchInterval: autoRefresh ? 60000 : false
  });

  const { data: securityHealth, isLoading: securityLoading } = useQuery({
    queryKey: ['/api/admin/security-health'],
    refetchInterval: autoRefresh ? 15000 : false
  });

  const { data: recoveryStatus, isLoading: recoveryLoading } = useQuery({
    queryKey: ['/api/admin/recovery-status'],
    refetchInterval: autoRefresh ? 30000 : false
  });

  // Mutations
  const triggerRecovery = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest('/api/admin/trigger-recovery', {
        method: 'POST',
        body: { actionId }
      });
    },
    onSuccess: (data, actionId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/recovery-status'] });
      toast({
        title: "Recovery Triggered",
        description: `Recovery action "${actionId}" has been successfully triggered.`,
        variant: "default"
      });
    },
    onError: (error: any, actionId) => {
      // Error logging handled by toast notification in production
      toast({
        title: "Recovery Failed",
        description: `Failed to trigger recovery action "${actionId}": ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/health/detailed'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/production-readiness'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/security-health'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/recovery-status'] });
  };

  // Validate API responses with proper error handling and fallbacks
  const health = validateApiResponseWithFallback(
    systemHealthSchema, 
    systemHealth, 
    defaultSystemHealth
  );
  
  const readiness = validateApiResponseWithFallback(
    productionReadinessSchema, 
    productionReadiness, 
    defaultProductionReadiness
  );
  
  const security = validateApiResponseWithFallback(
    securityHealthSchema, 
    securityHealth, 
    defaultSecurityHealth
  );
  
  const recovery = validateApiResponseWithFallback(
    recoveryStatusSchema, 
    recoveryStatus, 
    defaultRecoveryStatus
  );

  // Create skeleton loader component
  const SkeletonCard = ({ className = "" }: { className?: string }) => (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-24 animate-pulse" />
            <div className="h-8 bg-muted rounded w-16 animate-pulse" />
          </div>
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );

  const TabSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-6 bg-muted rounded w-16" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-muted rounded w-16" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Status</h1>
          <p className="text-muted-foreground">
            Monitor system health, security, and performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200 text-green-700' : ''}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthLoading ? (
          <SkeletonCard />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">System Health</p>
                  <StatusBadge status={health.status} />
                </div>
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {readinessLoading ? (
          <SkeletonCard />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Production Ready</p>
                  <StatusBadge status={readiness.isValid ? 'pass' : 'fail'} />
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {securityLoading ? (
          <SkeletonCard />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Security</p>
                  <StatusBadge status={security.status} />
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {healthLoading ? (
          <SkeletonCard />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-2xl font-bold">{health.metrics.memory_usage}MB</p>
                    {health.metrics.memory_usage > 500 && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="readiness">Production Readiness</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          {healthLoading ? (
            <TabSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(health.checks).map(([key, check]) => (
              <Card key={key} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium capitalize">
                      {key.replace('_', ' ')}
                    </CardTitle>
                    <StatusBadge status={check.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Response Time</span>
                      <span className={`font-medium ${
                        check.response_time > 1000 ? 'text-red-600' : 
                        check.response_time > 500 ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {check.response_time}ms
                      </span>
                    </div>
                    {check.message && (
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                    )}
                    {check.details && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground transition-colors">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {securityLoading ? (
            <TabSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Blocked Requests</span>
                    <Badge variant="destructive">{security.metrics.blockedRequests}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suspicious Activity</span>
                    <Badge variant="secondary">{security.metrics.suspiciousActivity}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rate Limit Hits</span>
                    <Badge variant="outline">{security.metrics.rateLimit}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CSRF Failures</span>
                    <Badge variant="destructive">{security.metrics.csrfFailures}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Threats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {security.recentThreats.length > 0 ? (
                    security.recentThreats.map((threat, index) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{threat.type}</span>
                            <Badge variant={threat.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {threat.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {threat.description}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent threats detected</p>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          {recoveryLoading ? (
            <TabSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recovery Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recovery.status.actions.map((action) => (
                    <div key={action.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{action.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className={`font-medium ${action.enabled ? 'text-green-600' : 'text-red-600'}`}>
                            {action.enabled ? 'Enabled' : 'Disabled'}
                          </span> • {action.retries} retries
                          {action.lastAttempt && (
                            <span className="block mt-1">
                              Last attempt: {new Date(action.lastAttempt).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerRecovery.mutate(action.id)}
                        disabled={triggerRecovery.isPending || !action.enabled}
                        className={triggerRecovery.isPending ? 'opacity-50' : ''}
                      >
                        <Zap className={`h-4 w-4 mr-1 ${triggerRecovery.isPending ? 'animate-pulse' : ''}`} />
                        {triggerRecovery.isPending ? 'Running...' : 'Trigger'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recovery Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Attempts</span>
                    <span className="text-sm font-medium">{recovery.metrics.totalAttempts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Successful Recoveries</span>
                    <span className="text-sm font-medium text-green-600">{recovery.metrics.successfulRecoveries}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed Recoveries</span>
                    <span className="text-sm font-medium text-red-600">{recovery.metrics.failedRecoveries}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recent Activity</span>
                    <span className="text-sm font-medium">{recovery.metrics.recentActivity}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="readiness" className="space-y-4">
          {readinessLoading ? (
            <TabSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Production Checks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(readiness.checks).map(([key, passed]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
                      {passed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Issues & Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {readiness.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ))}
                  {readiness.warnings.map((warning, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                  {(!readiness.errors.length && !readiness.warnings.length) && (
                    <p className="text-sm text-muted-foreground">No issues found</p>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}