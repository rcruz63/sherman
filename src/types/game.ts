/**
 * Sherman Solitario - System Data Types
 */

export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

export interface AxialCoord {
  q: number;
  r: number;
}

export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

export type ArmorSector = 'D' | 'LD' | 'LT' | 'T';

export type TerrainType = 'field' | 'road' | 'mud' | 'woods' | 'building' | 'water';
export type RawTerrainType = 'FIELD' | 'ROAD' | 'MUD' | 'WOODS' | 'BUILDING' | 'WATER';

export type EdgeFeature = 'none' | 'treeline';

export interface BoardHex {
  coord: AxialCoord;
  terrain: TerrainType;
  /** Edges indexed 0 to 5 matching the 6 axial directions */
  edges: [EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature];
  hasBuilding?: boolean;
  buildingType?: string;
  roadEdges?: Facing[];
  treeLines?: Facing[];
  blackSpawnNumber?: number;
  blackSpawnFacing?: Facing;
  redSpawnNumber?: number;
  isEntryHex?: boolean;
  isExitHex?: boolean;
  isBridge?: boolean;
}

export type HexTile = BoardHex;

export type CrewRole = 'commander' | 'loader' | 'gunner' | 'driver' | 'assistant';
export type CrewStatus = 'active' | 'kia';
export type CommanderPosition = 'hatched' | 'unhatched'; // Asomado (A) / Interior (I)

export interface CrewMember {
  id?: number;
  role: CrewRole;
  name: string;
  status: CrewStatus;
  position?: 'INTERIOR' | 'ASOMADO';
}

export interface ArmorStats {
  D: number;  // Delantero (Frontal)
  LD: number; // Lateral Delantero
  LT: number; // Lateral Trasero
  T: number;  // Trasero
}

export interface ShermanState {
  coord: AxialCoord;
  facing: Facing;
  crew: Record<CrewRole, CrewMember>;
  commanderPosition: CommanderPosition;
  isLoaded: boolean;
  isTurretDamaged: boolean;
  isImmobilized: boolean;
  fireLevel: number;
  hasSmoke: boolean;
  isHullDown: boolean;
  armor: ArmorStats;
  gunPenetration: number;
}

export type EnemyType = 'tiger' | 'panzerIV' | 'panzerIII' | 'infantry' | 'truck' | 'disabledSherman';
export type EnemyStatus = 'operational' | 'damaged' | 'destroyed';

export interface BaseEnemy {
  id: string;
  type: EnemyType;
  coord: AxialCoord;
}

export interface EnemyTank extends BaseEnemy {
  type: 'tiger' | 'panzerIV' | 'panzerIII';
  facing: Facing;
  status: EnemyStatus;
  hasSmoke: boolean;
  isHullDown: boolean;
  size: number; // TAM
  armor: ArmorStats;
  penetration: number; // PEN
  baseDice: number;
  spawnNumber?: number;
}

export interface EnemyTruck extends BaseEnemy {
  type: 'truck';
  facing: Facing;
  status: EnemyStatus;
  moveIndex: number;
  maxMoves: number;
  size: number;
  armor: ArmorStats;
  roadPath: AxialCoord[];
}

export interface EnemyInfantry extends BaseEnemy {
  type: 'infantry';
  status: 'active' | 'eliminated';
  spawnNumber?: number;
  isObjective?: boolean;
}

export type EnemyUnit = EnemyTank | EnemyTruck | EnemyInfantry;

export enum TurnPhase {
  SHERMAN_SMOKE_CLEANUP = 1,
  COMMANDER_ASSIGNMENT = 2,
  SHERMAN_OPERATIONS = 3,
  GERMAN_SMOKE_CLEANUP = 4,
  FIRE_CHECK = 5,
  GERMAN_OPERATIONS = 6,
  END_TURN_EVENTS = 7,
}

// Map & Spawn Point Specifications from mission JSON
export interface BlackSpawnPoint {
  number: number;
  hex: AxialCoord;
  facing: Facing;
}

export interface RedSpawnPoint {
  number: number;
  hex: AxialCoord;
}

export interface MissionSpawnPoints {
  blackNumbers: BlackSpawnPoint[];
  redNumbers: RedSpawnPoint[];
}

export interface DiceTerrainPool {
  road: number;
  field: number;
  mud: number;
}

export interface ShermanDicePoolConfig {
  maneuver: DiceTerrainPool;
  attack: DiceTerrainPool;
  misc: DiceTerrainPool;
}

export type EndTurnEventType =
  | 'SNIPER'
  | 'COMMANDER_ORDER'
  | 'SPAWN_INFANTRY'
  | 'INFANTRY_ATTACK'
  | 'MECHANICAL_FAILURE'
  | 'STUKA'
  | 'SPAWN_PANZER_III'
  | 'SPAWN_PANZER_IV'
  | 'MOVE_TRUCK'
  | 'MINES'
  | 'NO_EVENT'
  | string;

export interface EventRule {
  rollMin: number;
  rollMax: number;
  type: EndTurnEventType;
  description: string;
}

export interface InitialShermanStatus {
  loaded: boolean;
  fireLevel: number;
  turretDamaged: boolean;
  immobilized: boolean;
  smoke: boolean;
  hullDown: boolean;
}

export interface InitialCrewConfig {
  id: number;
  name: string;
  position?: 'INTERIOR' | 'ASOMADO';
  kia: boolean;
}

export interface PlayerDeploymentConfig {
  unit: string;
  hex: AxialCoord | { col: number; row: number };
  facing: Facing;
  initialStatus: InitialShermanStatus;
  crew: InitialCrewConfig[];
}

export interface TankSpawnConfig {
  type: 'PANZER_IV' | 'PANZER_III' | 'TIGER';
  spawnMethod: 'RANDOM_UNIQUE_BLACK_NUMBERS' | 'RESTRICTED_BLACK_NUMBERS' | 'FIXED' | string;
  allowedNumbers?: number[];
  count: number;
}

export interface SpecialUnitSpawnConfig {
  type: 'TRUCK' | string;
  hex: AxialCoord | { col: number; row: number };
  facing: Facing;
  status: string;
}

export interface InfantrySpawnConfig {
  id?: string;
  spawnMethod: 'ALL_BUILDING_HEXES' | 'FIXED_RED_NUMBER' | 'FIXED_HEX' | 'RANDOM_UNIQUE_RED_NUMBERS' | string;
  number?: number;
  hex?: AxialCoord | { col: number; row: number };
  count?: number;
  isObjective?: boolean;
}

export interface EnemyDeploymentConfig {
  tanks?: TankSpawnConfig[];
  specialUnits?: SpecialUnitSpawnConfig[];
  infantry?: InfantrySpawnConfig[];
}

export interface RawHexConfig {
  col: number;
  row: number;
  terrain: string;
  hasBuilding?: boolean;
  buildingType?: string;
  roadEdges?: string[];
  treeLines?: string[];
  blackSpot?: { number: number; facing: Facing };
  redSpot?: number;
  isEntry?: boolean;
  isExit?: boolean;
}

export interface GridColumnConfig {
  col: number;
  rows: number;
}

export interface MissionGridConfig {
  orientation: 'pointy-topped' | 'flat-topped';
  columns: GridColumnConfig[];
}

export interface MissionMapConfig {
  orientation: 'pointy-topped' | 'flat-topped';
  columns: number;
  rows: number;
  defaultTerrain: RawTerrainType;
}

export interface VictoryConditions {
  destroyAllEnemiesOfType?: string[];
  destroyAllInfantry?: boolean;
  destroySpecificUnit?: string;
  clearAllEnemyTanks?: boolean;
  clearAllEnemies?: boolean;
  crewRescued?: boolean;
  requireMapExit: boolean;
  exitHex?: AxialCoord | { col: number; row: number };
}

export interface DefeatConditions {
  shermanDestroyed: boolean;
  crewAllKIA: boolean;
  truckEscapedMoves?: number;
}

export interface TruckSpecialRule {
  stats: { tam: number; d: number; ld: number; lt: number; t: number; pen: number };
  roadPath: AxialCoord[];
  moveIndex: number;
  maxMoves: number;
  skipTankBlock: boolean;
}

export interface BridgeSpecialRule {
  hex: AxialCoord;
  isRoad: boolean;
  allowedEntryDirections: Facing[];
  allowedExitDirections: Facing[];
}

export interface DisabledShermanSpecialRule {
  hex: AxialCoord;
  rescued: boolean;
  requiresMiscDieAtHex: boolean;
}

export interface SpecialRulesConfig {
  truck?: TruckSpecialRule;
  bridge?: BridgeSpecialRule;
  disabledSherman?: DisabledShermanSpecialRule;
}

export interface MissionJSON {
  id: number;
  title: string;
  briefing: string;
  grid?: MissionGridConfig;
  map?: MissionMapConfig;
  victoryConditions: VictoryConditions;
  defeatConditions: DefeatConditions;
  specialRules?: SpecialRulesConfig;
  playerDeployment: PlayerDeploymentConfig;
  enemyDeployment: EnemyDeploymentConfig;
  spawnPoints?: MissionSpawnPoints;
  hexes?: RawHexConfig[];
  shermanDicePool: ShermanDicePoolConfig;
  endOfTurnEvents: EventRule[];
}

export interface Mission extends MissionJSON {
  tiles: BoardHex[];
  initialSherman: Partial<ShermanState>;
  initialEnemies: EnemyUnit[];
}

export interface BoardState {
  tiles: Map<string, BoardHex>;
  sherman: ShermanState;
  enemyTanks: EnemyTank[];
  enemyTrucks?: EnemyTruck[];
  enemyInfantry: EnemyInfantry[];
  currentTurn: number;
  currentPhase: TurnPhase;
  missionData?: MissionJSON;
}
