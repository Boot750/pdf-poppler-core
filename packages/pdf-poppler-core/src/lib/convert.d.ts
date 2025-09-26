export interface ConvertOptions {
  format?: 'png' | 'jpeg' | 'tiff' | 'pdf' | 'ps' | 'eps' | 'svg';
  scale?: number | null;
  out_dir?: string | null;
  out_prefix?: string | null;
  page?: number | null;
}

declare function convert(file: string, options: ConvertOptions): Promise<string>;
export = convert;
