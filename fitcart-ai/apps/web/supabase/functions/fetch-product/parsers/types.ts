export interface ParsedProduct {
  name: string;
  brand: string;
  price: number;
  mrp: number;
  color: string;
  imageUrl: string | null;
  sizeChart: unknown | null;
}

export type Parser = (html: string, url: string) => ParsedProduct | null;
