import {
  IsNumber,
  IsUrl,
  IsString,
  IsMimeType,
  IsDateString,
} from 'class-validator';

export interface FileAnalysisMessage {
  uploadedFileId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  userId: string | number;
  timestamp: string;
}

export interface FileAnalysisResponse {
  uploadedFileId: string;
  analysisResult: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export class FileAnalysisRequestDto {
  uploadedFileId: string;

  @IsUrl()
  fileUrl: string;

  @IsString()
  fileName: string;

  @IsMimeType()
  mimeType: string;

  @IsString()
  userId: string;

  @IsDateString()
  timestamp: string;

  constructor(data: FileAnalysisMessage) {
    this.uploadedFileId = data.uploadedFileId;
    this.fileUrl = data.fileUrl;
    this.fileName = data.fileName;
    this.mimeType = data.mimeType;
    this.userId = String(data.userId);
    this.timestamp = data.timestamp;
  }
}
