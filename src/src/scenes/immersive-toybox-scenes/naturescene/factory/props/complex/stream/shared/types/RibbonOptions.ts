export interface RibbonOptions {
  lengthSegments: number;
  widthSegments: number;
  widthFor: (t: number) => number;
  heightFor?: (t: number, bankFactor: number) => number;
  edgeJitter?: number;
}
