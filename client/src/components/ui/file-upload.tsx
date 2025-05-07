import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { getFileErrorMessage, formatFileSize } from "@/lib/utils/file";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface FileUploadProps {
  onFileSelected: (file: File | null) => void;
  selectedFile: File | null;
  accept?: string;
  maxSize?: number;
}

export function FileUpload({ 
  onFileSelected, 
  selectedFile, 
  accept = ".py,.java,.cpp,.ipynb,.zip", 
  maxSize = 10 * 1024 * 1024 
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const file = acceptedFiles[0];
    const errorMessage = getFileErrorMessage(file);
    
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    
    onFileSelected(file);
  }, [onFileSelected]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, curr) => {
      acc[curr] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    multiple: false,
  });
  
  const handleRemoveFile = () => {
    onFileSelected(null);
    setError(null);
  };
  
  return (
    <div>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center 
            ${isDragActive ? 'bg-blue-50' : 'hover:bg-neutral-50'} 
            transition-all cursor-pointer`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <span className="material-icons text-4xl text-neutral-400 mb-2">cloud_upload</span>
            <p className="text-neutral-800 font-medium mb-1">
              {isDragActive ? 'Drop your file here' : 'Drag and drop your file here'}
            </p>
            <p className="text-neutral-600 text-sm mb-3">or</p>
            <Button>Browse Files</Button>
            <p className="text-neutral-500 text-sm mt-3">
              Supported formats: {accept} (max {formatFileSize(maxSize)})
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="material-icons text-2xl text-neutral-500 mr-2">description</span>
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-neutral-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRemoveFile}>
              Remove
            </Button>
          </div>
        </div>
      )}
      
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
