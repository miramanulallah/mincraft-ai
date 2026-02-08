
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum MinecraftBiome {
  PLAINS = 'PLAINS',
  NETHER = 'NETHER',
  END = 'END',
  FOREST = 'FOREST',
  CAVE = 'CAVE'
}
