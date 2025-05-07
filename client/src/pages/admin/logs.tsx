import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/layout/admin-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_ROUTES } from "@/lib/constants";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Download,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";

// Sample log data
const systemLogs = [
  {
    id: 1,
    timestamp: "2023-05-10T08:45:12Z",
    level: "error",
    message: "Failed to connect to OpenAI API: Rate limit exceeded",
    source: "ai-service",
    user: "system",
    ip: "10.0.1.4",
  },
  {
    id: 2,
    timestamp: "2023-05-10T09:15:45Z",
    level: "warning",
    message: "Slow database query detected (523ms): SELECT * FROM submissions WHERE ...",
    source: "database",
    user: "system",
    ip: "10.0.1.4",
  },
  {
    id: 3,
    timestamp: "2023-05-10T09:32:21Z",
    level: "info",
    message: "User jsmith@example.edu logged in successfully",
    source: "auth",
    user: "jsmith@example.edu",
    ip: "192.168.1.102",
  },
  {
    id: 4,
    timestamp: "2023-05-10T10:05:33Z",
    level: "info",
    message: "Assignment 'Programming Basics' created by instructor",
    source: "assignment",
    user: "professor@example.edu",
    ip: "192.168.1.105",
  },
  {
    id: 5,
    timestamp: "2023-05-10T11:12:09Z",
    level: "warning",
    message: "File upload exceeds recommended size: submission_final.zip (15.4MB)",
    source: "storage",
    user: "student123@example.edu",
    ip: "192.168.1.110",
  },
  {
    id: 6,
    timestamp: "2023-05-10T12:01:45Z",
    level: "error",
    message: "Database connection pool exhausted",
    source: "database",
    user: "system",
    ip: "10.0.1.4",
  },
  {
    id: 7,
    timestamp: "2023-05-10T13:23:11Z",
    level: "debug",
    message: "Cache hit ratio: 78.5% over last hour",
    source: "cache",
    user: "system",
    ip: "10.0.1.4",
  },
  {
    id: 8,
    timestamp: "2023-05-10T14:15:02Z",
    level: "info",
    message: "System backup completed successfully",
    source: "backup",
    user: "system",
    ip: "10.0.1.4",
  },
  {
    id: 9,
    timestamp: "2023-05-10T15:08:57Z",
    level: "error",
    message: "Failed to process submission: AI service timeout",
    source: "ai-service",
    user: "student456@example.edu",
    ip: "192.168.1.120",
  },
  {
    id: 10,
    timestamp: "2023-05-10T16:45:33Z",
    level: "info",
    message: "Config change: Updated max submission size to 20MB",
    source: "config",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
];

// Sample audit logs
const auditLogs = [
  {
    id: 1,
    timestamp: "2023-05-10T09:05:12Z",
    action: "settings.update",
    details: "Changed AI provider from 'openai' to 'gemini'",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
  {
    id: 2,
    timestamp: "2023-05-10T10:12:45Z",
    action: "user.role.update",
    details: "Changed user role: jsmith@example.edu from 'student' to 'instructor'",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
  {
    id: 3,
    timestamp: "2023-05-10T11:30:21Z",
    action: "api_key.regenerate",
    details: "Regenerated API key for OpenAI integration",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
  {
    id: 4,
    timestamp: "2023-05-10T13:45:33Z",
    action: "security.login_attempt",
    details: "Failed login attempt for user: unknown@example.com",
    user: "system",
    ip: "203.0.113.42",
  },
  {
    id: 5,
    timestamp: "2023-05-10T14:22:09Z",
    action: "course.delete",
    details: "Deleted course: 'Introduction to Computer Science (CS101)'",
    user: "professor@example.edu",
    ip: "192.168.1.105",
  },
  {
    id: 6,
    timestamp: "2023-05-10T15:18:45Z",
    action: "security.mfa.update",
    details: "Enabled multi-factor authentication for administrative accounts",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
  {
    id: 7,
    timestamp: "2023-05-10T16:33:11Z",
    action: "user.bulk_import",
    details: "Imported 42 users from CSV file",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
  {
    id: 8,
    timestamp: "2023-05-10T17:05:02Z",
    action: "integration.lms.update",
    details: "Updated Canvas LMS integration settings",
    user: "admin@example.edu",
    ip: "192.168.1.100",
  },
];

// Sample API metrics
const apiMetrics = [
  {
    endpoint: "/api/assignments",
    method: "GET",
    count: 5243,
    avgTime: 42,
    errorRate: 0.2,
    p95Time: 98,
  },
  {
    endpoint: "/api/submissions",
    method: "POST",
    count: 1872,
    avgTime: 128,
    errorRate: 1.5,
    p95Time: 312,
  },
  {
    endpoint: "/api/auth/login",
    method: "POST",
    count: 845,
    avgTime: 85,
    errorRate: 5.2,
    p95Time: 154,
  },
  {
    endpoint: "/api/ai/analyze",
    method: "POST",
    count: 1562,
    avgTime: 4250,
    errorRate: 8.3,
    p95Time: 8450,
  },
  {
    endpoint: "/api/courses",
    method: "GET",
    count: 3210,
    avgTime: 65,
    errorRate: 0.4,
    p95Time: 120,
  },
];

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState("system");
  const [page, setPage] = useState(1);
  const [logLevel, setLogLevel] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch system logs (would be real API in production)
  const { data: logs = systemLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/admin/logs", activeTab, page, logLevel, searchTerm],
    queryFn: async () => {
      // In a real app, this would fetch from an API
      if (activeTab === "system") {
        return systemLogs;
      } else if (activeTab === "audit") {
        return auditLogs;
      } else {
        return [];
      }
    },
    staleTime: 30000, // 30 seconds
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </Badge>
        );
      case "info":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Info
          </Badge>
        );
      case "debug":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Debug
          </Badge>
        );
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes("update")) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{action}</Badge>;
    } else if (action.includes("delete")) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">{action}</Badge>;
    } else if (action.includes("create") || action.includes("import")) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">{action}</Badge>;
    } else {
      return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Logs & Monitoring</h2>
            <p className="text-muted-foreground">
              View system logs, audit trail, and performance metrics
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="system">System Logs</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="api">API Metrics</TabsTrigger>
          </TabsList>

          {/* System Logs */}
          <TabsContent value="system">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>System Logs</CardTitle>
                <CardDescription>
                  Application logs from all system components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 pb-4">
                  <div className="flex-1 max-w-sm">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search logs..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <Select value={logLevel} onValueChange={setLogLevel}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Timestamp</TableHead>
                        <TableHead className="w-[100px]">Level</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[180px]">User</TableHead>
                        <TableHead className="w-[120px]">IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            {getLevelBadge(log.level)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.message}
                          </TableCell>
                          <TableCell>{log.source}</TableCell>
                          <TableCell>{log.user}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ip}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">2</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">3</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#" />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>
                  Administrative action audit trail
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 pb-4">
                  <div className="flex-1 max-w-sm">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search audit logs..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Timestamp</TableHead>
                        <TableHead className="w-[180px]">Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-[180px]">User</TableHead>
                        <TableHead className="w-[120px]">IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            {getActionBadge(log.action)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.details}
                          </TableCell>
                          <TableCell>{log.user}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ip}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#" />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Metrics */}
          <TabsContent value="api">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>API Performance Metrics</CardTitle>
                <CardDescription>
                  API endpoint performance and error rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Avg Time (ms)</TableHead>
                        <TableHead className="text-right">p95 Time (ms)</TableHead>
                        <TableHead className="text-right">Error Rate (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiMetrics.map((metric, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium font-mono text-sm">
                            {metric.endpoint}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                metric.method === "GET"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : metric.method === "POST"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : metric.method === "PUT"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }
                            >
                              {metric.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {metric.count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                metric.avgTime > 1000
                                  ? "text-red-600 font-medium"
                                  : metric.avgTime > 300
                                  ? "text-amber-600 font-medium"
                                  : ""
                              }
                            >
                              {metric.avgTime}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                metric.p95Time > 5000
                                  ? "text-red-600 font-medium"
                                  : metric.p95Time > 1000
                                  ? "text-amber-600 font-medium"
                                  : ""
                              }
                            >
                              {metric.p95Time}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                metric.errorRate > 5
                                  ? "text-red-600 font-medium"
                                  : metric.errorRate > 1
                                  ? "text-amber-600 font-medium"
                                  : "text-green-600 font-medium"
                              }
                            >
                              {metric.errorRate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> API metrics are collected over the
                    last 24 hours. The p95 time represents the 95th percentile
                    response time.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}