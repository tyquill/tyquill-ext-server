export interface FileAnalysisMessage {
  uploadedFileId: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  userId: number;
  timestamp: string;
}

export interface FileAnalysisResponse {
  uploadedFileId: number;
  analysisResult: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export class FileAnalysisRequestDto {
  uploadedFileId: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  userId: number;
  timestamp: string;

  constructor(data: FileAnalysisMessage) {
    this.uploadedFileId = data.uploadedFileId;
    this.fileUrl = data.fileUrl;
    this.fileName = data.fileName;
    this.mimeType = data.mimeType;
    this.userId = data.userId;
    this.timestamp = data.timestamp;
  }
}