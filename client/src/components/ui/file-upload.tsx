import { useState, useCallback, useMemo } from "react";
import { useDropzone, FileRejection, DropEvent, FileError } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, File, Image, FileCode, FileText, Video, Music, PieChart, FileJson, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

export interface FileUploadProps {
  onValueChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  className?: string;
  showPreviews?: boolean;
  processingStatus?: "idle" | "uploading" | "processing" | "complete" | "error";
  processingProgress?: number;
}

export function FileUpload({
  onValueChange,
  disabled = false,
  maxFiles = 1,
  maxSize = 5 * 1024 * 1024, // 5MB default
  accept,
  className,
  showPreviews = true,
  processingStatus = "idle",
  processingProgress = 0,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filePreviews, setFilePreviews] = useState<{[key: string]: string}>({});

  // Generate file previews when files change
  const generatePreviews = useCallback((fileList: File[]) => {
    const previews: {[key: string]: string} = {};
    
    fileList.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews(prev => ({
            ...prev,
            [file.name]: reader.result as string
          }));
        };
        reader.readAsDataURL(file);
      }
      // For other preview types we could add handlers here
      // PDF previews, text file contents, etc.
    });
    
    return previews;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[], event: DropEvent) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors: string[] = [];
        rejectedFiles.forEach((fileRejection) => {
          fileRejection.errors.forEach((err) => {
            if (err.code === "file-too-large") {
              errors.push(`File "${fileRejection.file.name}" is too large. Max size is ${formatSize(maxSize)}.`);
            } else if (err.code === "file-invalid-type") {
              errors.push(`File "${fileRejection.file.name}" has an invalid type.`);
            } else {
              errors.push(`File "${fileRejection.file.name}": ${err.message}`);
            }
          });
        });
        setError(errors[0]);
        return;
      }

      // Reset error state
      setError(null);

      // Limit number of files
      const newFiles = acceptedFiles.slice(0, maxFiles);
      setFiles(newFiles);
      onValueChange(newFiles);

      // Generate previews for the accepted files
      if (showPreviews) {
        generatePreviews(newFiles);
      }
    },
    [maxFiles, maxSize, onValueChange, showPreviews, generatePreviews]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxFiles,
    maxSize,
    accept: accept
      ? accept.split(",").reduce((acc: Record<string, string[]>, type) => {
          // Parse accept string like ".jpg,.png,.pdf"
          if (type.startsWith(".")) {
            // File extensions
            acc["application/octet-stream"] = [
              ...(acc["application/octet-stream"] || []),
              type,
            ];
          } else {
            // MIME types
            const [category, subtype] = type.split("/");
            if (!acc[category]) acc[category] = [];
            acc[category].push(subtype);
          }
          return acc;
        }, {})
      : undefined,
  });

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    onValueChange(newFiles);
    
    // Remove preview if it exists
    if (fileToRemove && filePreviews[fileToRemove.name]) {
      setFilePreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[fileToRemove.name];
        return newPreviews;
      });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-input hover:border-primary/50 hover:bg-secondary/50",
          disabled && "opacity-50 cursor-not-allowed hover:border-input hover:bg-transparent",
          error && "border-destructive hover:border-destructive/50"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <div className="p-2 rounded-full bg-secondary/50">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? "Drop the files here" : "Upload file"}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag and drop or click to browse
            </p>
            {!disabled && maxSize && (
              <p className="text-xs text-muted-foreground">
                Max file size: {formatSize(maxSize)}
              </p>
            )}
            {!disabled && accept && (
              <p className="text-xs text-muted-foreground">
                Accepted types: {accept}
              </p>
            )}
            {!disabled && (
              <p className="text-xs text-muted-foreground font-medium mt-2 text-primary/80">
                Supports images, videos, audio, documents, and code files
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-4">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex flex-col border rounded-md text-sm overflow-hidden transition-all duration-300 hover:shadow-sm scale-in"
              style={{animationDelay: `${index * 50}ms`}}
            >
              {/* File Preview Section */}
              {showPreviews && filePreviews[file.name] && file.type.startsWith('image/') && (
                <div className="border-b relative overflow-hidden bg-neutral-50">
                  <img 
                    src={filePreviews[file.name]} 
                    alt={file.name}
                    className="w-full h-36 object-contain"
                  />
                </div>
              )}
              
              {/* File Info Section */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-2 truncate">
                  <div className="p-1.5 rounded-md bg-secondary">
                    {getFileIcon(file)}
                  </div>
                  <div className="truncate">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {/* Processing status indicators */}
                  {processingStatus !== "idle" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mr-2">
                            {processingStatus === "uploading" && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Uploading
                              </span>
                            )}
                            {processingStatus === "processing" && (
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Processing
                              </span>
                            )}
                            {processingStatus === "complete" && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </span>
                            )}
                            {processingStatus === "error" && (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {processingStatus === "uploading" && `Uploading: ${processingProgress}%`}
                          {processingStatus === "processing" && "AI is analyzing your file"}
                          {processingStatus === "complete" && "Processing complete"}
                          {processingStatus === "error" && "Error processing file"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    disabled={disabled || processingStatus === "uploading" || processingStatus === "processing"}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    <X size={16} className="text-muted-foreground" />
                  </Button>
                </div>
              </div>
              
              {/* Progress bar for processing */}
              {processingStatus === "uploading" && (
                <Progress value={processingProgress} className="h-1 rounded-none" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Helper to get the file type icon
function getFileIcon(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const type = file.type;
  
  if (type.startsWith('image/')) {
    return <Image size={16} className="text-blue-600" />;
  } else if (type.startsWith('video/')) {
    return <Video size={16} className="text-purple-600" />;
  } else if (type.startsWith('audio/')) {
    return <Music size={16} className="text-amber-600" />;
  } else if (type.startsWith('text/')) {
    return <FileText size={16} className="text-gray-600" />;
  } else if (['application/pdf'].includes(type)) {
    return <FileText size={16} className="text-red-600" />;
  } else if (['application/json'].includes(type) || extension === 'json') {
    return <FileJson size={16} className="text-green-600" />;
  } else if ([
    'application/javascript', 
    'application/typescript',
    'application/x-python',
    'text/x-python',
    'application/x-java',
    'text/x-java'
  ].includes(type) || ['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css'].includes(extension)) {
    return <FileCode size={16} className="text-indigo-600" />;
  } else if (['csv', 'xls', 'xlsx', 'numbers'].includes(extension)) {
    return <PieChart size={16} className="text-emerald-600" />;
  }
  
  return <File size={16} className="text-muted-foreground" />;
}