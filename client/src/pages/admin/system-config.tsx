import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/layout/admin-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, Key, Network, Lock, Eye, EyeOff } from "lucide-react";
import { API_ROUTES } from "@/lib/constants";

export default function SystemConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [showApiKey, setShowApiKey] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "AI Assignment Feedback Tool",
    adminEmail: "admin@example.com",
    feedbackTimeout: 120,
    defaultLanguage: "en",
    maxSubmissionSize: 10,
  });

  const [aiSettings, setAiSettings] = useState({
    provider: "gemini",
    apiKey: "gem_••••••••••••••••••••••••",
    model: "models/gemini-2.5-flash-preview-05-20", // Updated to use the newest Gemini model
    maxTokens: 4096,
    temperature: 0.7,
    enableContentFiltering: true,
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    enableLms: true,
    lmsProvider: "canvas",
    lmsUrl: "https://canvas.example.edu",
    clientId: "client_1234567890",
    clientSecret: "sec_••••••••••••••••••",
    callbackUrl: "https://feedback.example.edu/auth/callback",
    enableGradeSync: true,
    enableRoster: true,
  });

  const [storageSettings, setStorageSettings] = useState({
    storageProvider: "local",
    bucketName: "",
    region: "",
    accessKey: "",
    secretKey: "",
    retentionPolicy: "90",
    compressionEnabled: true,
    encryptionEnabled: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 30,
    mfaEnabled: false,
    passwordPolicy: "medium",
    rateLimit: 100,
    allowedDomains: "*.edu\n*.org",
    ipRestrictions: "",
  });

  // Submit general settings
  const saveGeneralSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      // This would be a real API call in production
      await new Promise((resolve) => setTimeout(resolve, 500));
      return settings;
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "General settings have been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Submit AI settings
  const saveAiSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      // This would be a real API call in production
      await new Promise((resolve) => setTimeout(resolve, 500));
      return settings;
    },
    onSuccess: () => {
      toast({
        title: "AI settings saved",
        description: "AI configuration has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save AI settings",
        variant: "destructive",
      });
    },
  });

  const handleGeneralSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeneralSettingsMutation.mutate(generalSettings);
  };

  const handleAiSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAiSettingsMutation.mutate(aiSettings);
  };

  const handleIntegrationSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Integration settings saved",
      description: "LMS integration settings have been updated successfully",
    });
  };

  const handleStorageSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Storage settings saved",
      description: "Storage configuration has been updated successfully",
    });
  };

  const handleSecuritySettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Security settings saved",
      description: "Security settings have been updated successfully",
    });
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-muted-foreground">
            Manage application settings and integrations
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="ai">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 mr-2"
              >
                <path d="M12 2a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4" />
                <path d="M8 2a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4" />
                <path d="M10 14h4" />
                <path d="M13 8h3" />
                <path d="M8 8H5.5a1.5 1.5 0 0 0 0 3h5a1.5 1.5 0 0 1 0 3H8" />
              </svg>
              AI Models
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Network className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="storage">
              <Database className="h-4 w-4 mr-2" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <form onSubmit={handleGeneralSettingsSubmit}>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure basic application settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="siteName">Site Name</Label>
                      <Input
                        id="siteName"
                        value={generalSettings.siteName}
                        onChange={(e) =>
                          setGeneralSettings({
                            ...generalSettings,
                            siteName: e.target.value,
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        The name displayed in the browser title and header
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Admin Email</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={generalSettings.adminEmail}
                        onChange={(e) =>
                          setGeneralSettings({
                            ...generalSettings,
                            adminEmail: e.target.value,
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Primary contact for system notifications
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedbackTimeout">
                        Feedback Timeout (seconds)
                      </Label>
                      <Input
                        id="feedbackTimeout"
                        type="number"
                        value={generalSettings.feedbackTimeout}
                        onChange={(e) =>
                          setGeneralSettings({
                            ...generalSettings,
                            feedbackTimeout: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum time allowed for AI feedback generation
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="defaultLanguage">Default Language</Label>
                      <Select
                        value={generalSettings.defaultLanguage}
                        onValueChange={(value) =>
                          setGeneralSettings({
                            ...generalSettings,
                            defaultLanguage: value,
                          })
                        }
                      >
                        <SelectTrigger id="defaultLanguage">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Default language for the application interface
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxSubmissionSize">
                        Max Submission Size (MB)
                      </Label>
                      <Input
                        id="maxSubmissionSize"
                        type="number"
                        value={generalSettings.maxSubmissionSize}
                        onChange={(e) =>
                          setGeneralSettings({
                            ...generalSettings,
                            maxSubmissionSize: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum file size for student submissions
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setGeneralSettings({
                      siteName: "AI Assignment Feedback Tool",
                      adminEmail: "admin@example.com",
                      feedbackTimeout: 120,
                      defaultLanguage: "en",
                      maxSubmissionSize: 10,
                    })}
                  >
                    Reset
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* AI Settings */}
          <TabsContent value="ai">
            <Card>
              <form onSubmit={handleAiSettingsSubmit}>
                <CardHeader>
                  <CardTitle>AI Configuration</CardTitle>
                  <CardDescription>
                    Configure AI model settings and parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="aiProvider">AI Provider</Label>
                      <Select
                        value={aiSettings.provider}
                        onValueChange={(value) =>
                          setAiSettings({
                            ...aiSettings,
                            provider: value,
                          })
                        }
                      >
                        <SelectTrigger id="aiProvider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="azure">Azure OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        AI service provider for feedback generation
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">API Key</Label>
                      <div className="flex">
                        <Input
                          id="apiKey"
                          type={showApiKey ? "text" : "password"}
                          value={aiSettings.apiKey}
                          onChange={(e) =>
                            setAiSettings({
                              ...aiSettings,
                              apiKey: e.target.value,
                            })
                          }
                          className="rounded-r-none"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-l-none"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        API key for authenticating with the AI provider
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Select
                        value={aiSettings.model}
                        onValueChange={(value) =>
                          setAiSettings({
                            ...aiSettings,
                            model: value,
                          })
                        }
                      >
                        <SelectTrigger id="model">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Gemini models */}
                          <SelectItem value="models/gemini-2.5-flash-preview-05-20">Gemini 2.5 Flash (Preview)</SelectItem>
                          <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                          {/* OpenAI models */}
                          <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        AI model to use for generating feedback
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">Max Tokens</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        value={aiSettings.maxTokens}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            maxTokens: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum tokens for AI response generation
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature</Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={aiSettings.temperature}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            temperature: parseFloat(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Controls randomness in the AI output (0-2)
                      </p>
                    </div>
                    <div className="flex items-center justify-between space-y-0 pt-5">
                      <div className="space-y-1">
                        <Label htmlFor="contentFiltering">
                          Content Filtering
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable AI content safety filters
                        </p>
                      </div>
                      <Switch
                        id="contentFiltering"
                        checked={aiSettings.enableContentFiltering}
                        onCheckedChange={(checked) =>
                          setAiSettings({
                            ...aiSettings,
                            enableContentFiltering: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setAiSettings({
                      provider: "gemini", 
                      apiKey: "gem_••••••••••••••••••••••••",
                      model: "models/gemini-2.5-flash-preview-05-20",
                      maxTokens: 4096,
                      temperature: 0.7,
                      enableContentFiltering: true,
                    })}
                  >
                    Reset
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* Integrations Settings */}
          <TabsContent value="integrations">
            <Card>
              <form onSubmit={handleIntegrationSettingsSubmit}>
                <CardHeader>
                  <CardTitle>LMS Integration</CardTitle>
                  <CardDescription>
                    Configure learning management system integration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableLms"
                      checked={integrationSettings.enableLms}
                      onCheckedChange={(checked) =>
                        setIntegrationSettings({
                          ...integrationSettings,
                          enableLms: checked,
                        })
                      }
                    />
                    <Label htmlFor="enableLms">Enable LMS Integration</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="lmsProvider">LMS Provider</Label>
                      <Select
                        value={integrationSettings.lmsProvider}
                        onValueChange={(value) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            lmsProvider: value,
                          })
                        }
                        disabled={!integrationSettings.enableLms}
                      >
                        <SelectTrigger id="lmsProvider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="canvas">Canvas</SelectItem>
                          <SelectItem value="blackboard">Blackboard</SelectItem>
                          <SelectItem value="moodle">Moodle</SelectItem>
                          <SelectItem value="d2l">D2L Brightspace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lmsUrl">LMS URL</Label>
                      <Input
                        id="lmsUrl"
                        value={integrationSettings.lmsUrl}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            lmsUrl: e.target.value,
                          })
                        }
                        disabled={!integrationSettings.enableLms}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client ID</Label>
                      <Input
                        id="clientId"
                        value={integrationSettings.clientId}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            clientId: e.target.value,
                          })
                        }
                        disabled={!integrationSettings.enableLms}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientSecret">Client Secret</Label>
                      <Input
                        id="clientSecret"
                        type="password"
                        value={integrationSettings.clientSecret}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            clientSecret: e.target.value,
                          })
                        }
                        disabled={!integrationSettings.enableLms}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="callbackUrl">Callback URL</Label>
                      <Input
                        id="callbackUrl"
                        value={integrationSettings.callbackUrl}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            callbackUrl: e.target.value,
                          })
                        }
                        disabled={!integrationSettings.enableLms}
                      />
                      <p className="text-sm text-muted-foreground">
                        OAuth callback URL for LMS integration
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-medium mb-3">LMS Features</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableGradeSync">
                            Grade Synchronization
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically sync grades back to the LMS
                          </p>
                        </div>
                        <Switch
                          id="enableGradeSync"
                          checked={integrationSettings.enableGradeSync}
                          onCheckedChange={(checked) =>
                            setIntegrationSettings({
                              ...integrationSettings,
                              enableGradeSync: checked,
                            })
                          }
                          disabled={!integrationSettings.enableLms}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableRoster">
                            Roster Synchronization
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically sync student roster data
                          </p>
                        </div>
                        <Switch
                          id="enableRoster"
                          checked={integrationSettings.enableRoster}
                          onCheckedChange={(checked) =>
                            setIntegrationSettings({
                              ...integrationSettings,
                              enableRoster: checked,
                            })
                          }
                          disabled={!integrationSettings.enableLms}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" disabled={!integrationSettings.enableLms}>
                    Test Connection
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* Storage Settings */}
          <TabsContent value="storage">
            <Card>
              <form onSubmit={handleStorageSettingsSubmit}>
                <CardHeader>
                  <CardTitle>Storage Configuration</CardTitle>
                  <CardDescription>
                    Configure file storage settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="storageProvider">Storage Provider</Label>
                      <Select
                        value={storageSettings.storageProvider}
                        onValueChange={(value) =>
                          setStorageSettings({
                            ...storageSettings,
                            storageProvider: value,
                          })
                        }
                      >
                        <SelectTrigger id="storageProvider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local Filesystem</SelectItem>
                          <SelectItem value="s3">Amazon S3</SelectItem>
                          <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                          <SelectItem value="azure">Azure Blob Storage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {storageSettings.storageProvider !== "local" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="bucketName">Bucket Name</Label>
                          <Input
                            id="bucketName"
                            value={storageSettings.bucketName}
                            onChange={(e) =>
                              setStorageSettings({
                                ...storageSettings,
                                bucketName: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="region">Region</Label>
                          <Input
                            id="region"
                            value={storageSettings.region}
                            onChange={(e) =>
                              setStorageSettings({
                                ...storageSettings,
                                region: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accessKey">Access Key</Label>
                          <Input
                            id="accessKey"
                            value={storageSettings.accessKey}
                            onChange={(e) =>
                              setStorageSettings({
                                ...storageSettings,
                                accessKey: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="secretKey">Secret Key</Label>
                          <Input
                            id="secretKey"
                            type="password"
                            value={storageSettings.secretKey}
                            onChange={(e) =>
                              setStorageSettings({
                                ...storageSettings,
                                secretKey: e.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="retentionPolicy">
                        Retention Policy (days)
                      </Label>
                      <Input
                        id="retentionPolicy"
                        type="number"
                        value={storageSettings.retentionPolicy}
                        onChange={(e) =>
                          setStorageSettings({
                            ...storageSettings,
                            retentionPolicy: e.target.value,
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Number of days to retain files (0 = indefinite)
                      </p>
                    </div>
                    <div className="col-span-2 pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="compressionEnabled">
                            Enable Compression
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Compress files to save storage space
                          </p>
                        </div>
                        <Switch
                          id="compressionEnabled"
                          checked={storageSettings.compressionEnabled}
                          onCheckedChange={(checked) =>
                            setStorageSettings({
                              ...storageSettings,
                              compressionEnabled: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="encryptionEnabled">
                            Enable Encryption
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Encrypt files at rest
                          </p>
                        </div>
                        <Switch
                          id="encryptionEnabled"
                          checked={storageSettings.encryptionEnabled}
                          onCheckedChange={(checked) =>
                            setStorageSettings({
                              ...storageSettings,
                              encryptionEnabled: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear all cached files? This action cannot be undone.")) {
                        toast({
                          title: "Cache cleared",
                          description: "All cached files have been deleted",
                        });
                      }
                    }}
                  >
                    Clear Cache
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <form onSubmit={handleSecuritySettingsSubmit}>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security and authentication settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">
                        Session Timeout (minutes)
                      </Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={securitySettings.sessionTimeout}
                        onChange={(e) =>
                          setSecuritySettings({
                            ...securitySettings,
                            sessionTimeout: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Inactive session timeout duration
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordPolicy">Password Policy</Label>
                      <Select
                        value={securitySettings.passwordPolicy}
                        onValueChange={(value) =>
                          setSecuritySettings({
                            ...securitySettings,
                            passwordPolicy: value,
                          })
                        }
                      >
                        <SelectTrigger id="passwordPolicy">
                          <SelectValue placeholder="Select policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">
                            Low (8+ chars)
                          </SelectItem>
                          <SelectItem value="medium">
                            Medium (8+ chars, mixed case, numbers)
                          </SelectItem>
                          <SelectItem value="high">
                            High (12+ chars, mixed case, numbers, symbols)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Password complexity requirements
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rateLimit">
                        Rate Limit (requests/minute)
                      </Label>
                      <Input
                        id="rateLimit"
                        type="number"
                        value={securitySettings.rateLimit}
                        onChange={(e) =>
                          setSecuritySettings({
                            ...securitySettings,
                            rateLimit: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum API requests per minute per user
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="mfaEnabled">
                          Multi-Factor Authentication
                        </Label>
                        <Switch
                          id="mfaEnabled"
                          checked={securitySettings.mfaEnabled}
                          onCheckedChange={(checked) =>
                            setSecuritySettings({
                              ...securitySettings,
                              mfaEnabled: checked,
                            })
                          }
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Require MFA for administrative accounts
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allowedDomains">Allowed Email Domains</Label>
                      <Textarea
                        id="allowedDomains"
                        value={securitySettings.allowedDomains}
                        onChange={(e) =>
                          setSecuritySettings({
                            ...securitySettings,
                            allowedDomains: e.target.value,
                          })
                        }
                        placeholder="One domain per line, e.g. *.edu"
                      />
                      <p className="text-sm text-muted-foreground">
                        Restrict user registration to specific email domains
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ipRestrictions">IP Restrictions</Label>
                      <Textarea
                        id="ipRestrictions"
                        value={securitySettings.ipRestrictions}
                        onChange={(e) =>
                          setSecuritySettings({
                            ...securitySettings,
                            ipRestrictions: e.target.value,
                          })
                        }
                        placeholder="One IP range per line, e.g. 192.168.1.0/24"
                      />
                      <p className="text-sm text-muted-foreground">
                        Optional IP address restrictions (CIDR format)
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      toast({
                        title: "Security audit initiated",
                        description: "Security audit report will be available in your email shortly",
                      });
                    }}
                  >
                    Run Security Audit
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}