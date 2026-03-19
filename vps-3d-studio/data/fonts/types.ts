

export interface CharacterRatios {
  [char: string]: number;
}

export interface FontMetrics {
  defaultRatio: number;
  chars: CharacterRatios;
}

export interface FontData {
  name: string;
  font: string | object;
  widthFactor: number;
  style?: 'sans' | 'serif';
  cssFamily?: string;
  cssWeight?: string;
  metrics: FontMetrics;
}