export interface PdfInfo {
  [key: string]: string;
  pages: string;
  page_size: string;
  width_in_pts: number;
  height_in_pts: number;
}

declare function info(file: string): Promise<PdfInfo>;
export = info;
