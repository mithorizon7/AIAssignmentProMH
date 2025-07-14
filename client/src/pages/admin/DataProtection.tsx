/**
 * Data Protection Admin Dashboard
 * 
 * Comprehensive GDPR/FERPA compliance management interface
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  FileText,
  Users,
  Eye,
  Download,
  UserX,
  AlertTriangle,
  Check,
  X,
  Clock,
  Search,
  Filter,
} from 'lucide-react';

interface DataSubjectRequest {
  id: number;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  userId: number;
  requesterEmail: string;
  status: 'pending' | 'verified' | 'processing' | 'completed' | 'rejected';
  requestedAt: string;
  completedAt?: string;
  details?: string;
}

interface ComplianceSummary {
  summary: {
    totalUsers: number;
    totalRequests: number;
    pendingRequests: number;
    activeConsents: number;
    recentAudits: number;
  };
  complianceStatus: {
    gdprCompliant: boolean;
    ferpaCompliant: boolean;
    dataRetentionActive: boolean;
    auditingEnabled: boolean;
  };
}

export default function DataProtection() {
  const [selectedRequest, setSelectedRequest] = useState<DataSubjectRequest | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [adminAction, setAdminAction] = useState<'approve' | 'reject' | 'verify'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [requestsFilter, setRequestsFilter] = useState({
    status: '',
    type: '',
    page: 1,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch compliance summary
  const { data: complianceSummary } = useQuery<ComplianceSummary>({
    queryKey: ['/api/data-protection/compliance-summary'],
  });

  // Fetch data subject requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['/api/data-protection/requests', requestsFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (requestsFilter.status) params.append('status', requestsFilter.status);
      if (requestsFilter.type) params.append('type', requestsFilter.type);
      params.append('page', requestsFilter.page.toString());
      
      return apiRequest(`/api/data-protection/requests?${params}`);
    },
  });

  // Process request mutation
  const processRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, notes }: { 
      requestId: number; 
      action: 'approve' | 'reject' | 'verify'; 
      notes: string; 
    }) => {
      return apiRequest(`/api/data-protection/requests/${requestId}/process`, {
        method: 'POST',
        body: JSON.stringify({ action, adminNotes: notes }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Request Processed",
        description: "Data subject request has been processed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/data-protection/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-protection/compliance-summary'] });
      setShowProcessDialog(false);
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Export user data mutation
  const exportUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/data-protection/users/${userId}/export`);
    },
    onSuccess: (data) => {
      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-data-export-${data.user_info.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "User data has been exported successfully.",
      });
    },
  });

  // Anonymize user mutation
  const anonymizeUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/data-protection/users/${userId}/anonymize`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      toast({
        title: "User Anonymized",
        description: "User data has been anonymized while preserving educational content.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/data-protection'] });
    },
  });

  // Delete user data mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/data-protection/users/${userId}/data`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmDelete: true }),
      });
    },
    onSuccess: () => {
      toast({
        title: "User Data Deleted",
        description: "User data has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/data-protection'] });
      setShowDeleteDialog(false);
      setSelectedUserId(null);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      verified: 'outline',
      processing: 'default',
      completed: 'default',
      rejected: 'destructive',
    } as const;

    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getRequestTypeIcon = (type: string) => {
    const icons = {
      access: <Eye className="h-4 w-4" />,
      portability: <Download className="h-4 w-4" />,
      erasure: <UserX className="h-4 w-4" />,
      rectification: <FileText className="h-4 w-4" />,
      restriction: <Shield className="h-4 w-4" />,
      objection: <AlertTriangle className="h-4 w-4" />,
    };

    return icons[type as keyof typeof icons] || <FileText className="h-4 w-4" />;
  };

  const handleProcessRequest = () => {
    if (!selectedRequest) return;

    processRequestMutation.mutate({
      requestId: selectedRequest.id,
      action: adminAction,
      notes: adminNotes,
    });
  };

  const handleDeleteUser = () => {
    if (!selectedUserId) return;
    deleteUserMutation.mutate(selectedUserId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Protection</h1>
          <p className="text-muted-foreground">
            GDPR and FERPA compliance management
          </p>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceSummary?.summary.totalUsers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceSummary?.summary.pendingRequests || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceSummary?.summary.activeConsents || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Audits</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceSummary?.summary.recentAudits || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Data Subject Requests</TabsTrigger>
          <TabsTrigger value="consent">Consent Management</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Subject Requests</CardTitle>
              <CardDescription>
                Manage GDPR Article 15-22 requests from users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <Select
                  value={requestsFilter.status}
                  onValueChange={(value) =>
                    setRequestsFilter(prev => ({ ...prev, status: value, page: 1 }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={requestsFilter.type}
                  onValueChange={(value) =>
                    setRequestsFilter(prev => ({ ...prev, type: value, page: 1 }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="access">Access</SelectItem>
                    <SelectItem value="portability">Portability</SelectItem>
                    <SelectItem value="erasure">Erasure</SelectItem>
                    <SelectItem value="rectification">Rectification</SelectItem>
                    <SelectItem value="restriction">Restriction</SelectItem>
                    <SelectItem value="objection">Objection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsData?.requests?.map((request: DataSubjectRequest) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRequestTypeIcon(request.type)}
                          <span className="capitalize">{request.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{request.userId}</TableCell>
                      <TableCell>{request.requesterEmail}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setAdminAction('verify');
                                setShowProcessDialog(true);
                              }}
                            >
                              Verify
                            </Button>
                          )}
                          {request.status === 'verified' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setAdminAction('approve');
                                setShowProcessDialog(true);
                              }}
                            >
                              Process
                            </Button>
                          )}
                          {request.type === 'access' && request.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportUserMutation.mutate(request.userId)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent">
          <Card>
            <CardHeader>
              <CardTitle>Consent Management</CardTitle>
              <CardDescription>
                Track and manage user consent for data processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Consent management interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Complete audit log of all data protection activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Audit trail interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Request Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Data Subject Request</DialogTitle>
            <DialogDescription>
              Review and process this data subject request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p><strong>Type:</strong> {selectedRequest.type}</p>
                <p><strong>User ID:</strong> {selectedRequest.userId}</p>
                <p><strong>Email:</strong> {selectedRequest.requesterEmail}</p>
                {selectedRequest.details && (
                  <p><strong>Details:</strong> {selectedRequest.details}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Action</label>
                <Select value={adminAction} onValueChange={(value: any) => setAdminAction(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verify">Verify Request</SelectItem>
                    <SelectItem value="approve">Approve & Process</SelectItem>
                    <SelectItem value="reject">Reject Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this decision..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProcessRequest}
              disabled={processRequestMutation.isPending}
            >
              {processRequestMutation.isPending ? 'Processing...' : 'Process Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data for user ID {selectedUserId}. 
              This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}