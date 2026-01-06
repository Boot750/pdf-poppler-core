export interface ImageData {
  [key: string]: string;
}

declare function imgdata(file: string): Promise<ImageData[]>;
export = imgdata;
