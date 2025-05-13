import { useState, useEffect } from "react";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  FileCheck,
  Server,
  ActivitySquare,
  ChevronUp,
  ChevronDown,
  Zap,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { API_ROUTES } from "@/lib/constants";

const systemStats = [
  {
    name: "Users",
    value: 458,
    change: 12.5,
    increasing: true,
    icon: <Users className="h-5 w-5" />,
  },
  {
    name: "Submissions",
    value: 1248,
    change: 8.2,
    increasing: true,
    icon: <FileCheck className="h-5 w-5" />,
  },
  {
    name: "API Calls",
    value: 18432,
    change: 3.1,
    increasing: true,
    icon: <Zap className="h-5 w-5" />,
  },
  {
    name: "Avg. Response Time",
    value: "1.23s",
    change: -5.3,
    increasing: false,
    icon: <Clock className="h-5 w-5" />,
  },
];

const last30DaysData = [
  { date: "Apr 10", users: 350, submissions: 900, apiCalls: 12000 },
  { date: "Apr 15", users: 375, submissions: 950, apiCalls: 13500 },
  { date: "Apr 20", users: 390, submissions: 1000, apiCalls: 15000 },
  { date: "Apr 25", users: 410, submissions: 1100, apiCalls: 16200 },
  { date: "Apr 30", users: 425, submissions: 1150, apiCalls: 17000 },
  { date: "May 5", users: 440, submissions: 1200, apiCalls: 17800 },
  { date: "May 10", users: 458, submissions: 1248, apiCalls: 18432 },
];

const errorDistribution = [
  { name: "Authentication", value: 35 },
  { name: "API Timeouts", value: 25 },
  { name: "Rate Limits", value: 20 },
  { name: "File Processing", value: 15 },
  { name: "Other", value: 5 },
];

const alerts = [
  {
    id: 1,
    severity: "high",
    message: "API rate limit exceeded for OpenAI",
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    severity: "medium",
    message: "Database connection pool near capacity",
    timestamp: "6 hours ago",
  },
  {
    id: 3,
    severity: "low",
    message: "New API version available",
    timestamp: "1 day ago",
  },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Simulate fetching system stats
  const { data: stats = systemStats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: async () => {
      // This would be a real API call in production
      return systemStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            <span className="text-[#8a1a2c]">Admin</span>{" "}
            <span className="text-black">Dashboard</span>
          </h2>
          <p className="text-muted-foreground">
            Monitor system health, user activities, and configuration
          </p>
        </div>

        <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.name}
                    </CardTitle>
                    <div
                      className={`rounded-full p-1 ${
                        stat.name === "API Calls" 
                          ? "bg-blue-100 text-blue-600"
                          : stat.name === "Users" 
                            ? "bg-green-100 text-green-600"
                            : stat.name === "Submissions"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-orange-100 text-orange-600"
                      }`}
                    >
                      {stat.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground flex items-center pt-1">
                      {stat.increasing ? (
                        <ChevronUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span
                        className={
                          stat.increasing ? "text-green-500" : "text-red-500"
                        }
                      >
                        {stat.change}%
                      </span>{" "}
                      from last month
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Usage Over Time</CardTitle>
                  <CardDescription>
                    Tracked metrics over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={last30DaysData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="users"
                          stroke="#10b981"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="submissions"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="apiCalls"
                          stroke="#3b82f6"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Distribution</CardTitle>
                  <CardDescription>Common error types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={errorDistribution}
                        layout="vertical"
                        margin={{ left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>System Alerts</CardTitle>
                  <CardDescription>Recent alerts and warnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start space-x-4 rounded-md border p-4"
                      >
                        <div
                          className={`mt-0.5 rounded-full p-1 ${
                            alert.severity === "high"
                              ? "bg-red-100"
                              : alert.severity === "medium"
                              ? "bg-amber-100"
                              : "bg-blue-100"
                          }`}
                        >
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              alert.severity === "high"
                                ? "text-red-600"
                                : alert.severity === "medium"
                                ? "text-amber-600"
                                : "text-blue-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {alert.message}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {alert.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Current service status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          API Services
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm text-muted-foreground">
                          Operational
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Database</span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm text-muted-foreground">
                          Operational
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Authentication
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm text-muted-foreground">
                          Operational
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          AI Processing
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-amber-500 mr-2"></div>
                        <span className="text-sm text-muted-foreground">
                          Degraded Performance
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>
                  Detailed performance metrics and resource usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Performance metrics will be displayed here
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>
                  All system alerts and notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Full alert log will be displayed here
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}