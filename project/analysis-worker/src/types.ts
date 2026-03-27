export interface BatchAnalysisJob {
  id: string;
  user_id: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  total_files: number;
  processed_files: number;
  results: AnalysisResult[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AnalysisResult {
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  analysis?: {
    title: string;
    description: string;
    category: string;
    tags: string[];
    estimatedValue?: {
      min: number;
      max: number;
    };
  };
  error?: string;
}

export interface IronDriveAnalysisRequest {
  imageUrl: string;
  fileName: string;
}

export interface IronDriveAnalysisResponse {
  title: string;
  description: string;
  category: string;
  tags: string[];
  estimatedValue?: {
    min: number;
    max: number;
  };
}
