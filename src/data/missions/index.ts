import mission1Raw from './mission1.json';
import mission2Raw from './mission2.json';
import mission3Raw from './mission3.json';
import mission4Raw from './mission4.json';
import mission5Raw from './mission5.json';
import mission6Raw from './mission6.json';
import mission7Raw from './mission7.json';
import mission8Raw from './mission8.json';
import mission9Raw from './mission9.json';
import mission10Raw from './mission10.json';
import mission11Raw from './mission11.json';
import mission12Raw from './mission12.json';
import mission13Raw from './mission13.json';

import { MissionJSON } from '../../types/game';

export const mission1 = mission1Raw as MissionJSON;
export const mission2 = mission2Raw as MissionJSON;
export const mission3 = mission3Raw as MissionJSON;
export const mission4 = mission4Raw as MissionJSON;
export const mission5 = mission5Raw as MissionJSON;
export const mission6 = mission6Raw as MissionJSON;
export const mission7 = mission7Raw as MissionJSON;
export const mission8 = mission8Raw as MissionJSON;
export const mission9 = mission9Raw as MissionJSON;
export const mission10 = mission10Raw as MissionJSON;
export const mission11 = mission11Raw as MissionJSON;
export const mission12 = mission12Raw as MissionJSON;
export const mission13 = mission13Raw as MissionJSON;

export const missions: MissionJSON[] = [
  mission1,
  mission2,
  mission3,
  mission4,
  mission5,
  mission6,
  mission7,
  mission8,
  mission9,
  mission10,
  mission11,
  mission12,
  mission13,
];
