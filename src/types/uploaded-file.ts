export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export interface UploadFields {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}
