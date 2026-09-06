/**
 * Campaign Mode Rules & Transition Engine
 */

import { BoardState, CrewRole, MissionJSON, ShermanState } from '../../types/game';
import { loadMissionState } from './missionLoader';

export interface CampaignProgress {
  active: boolean;
  currentMissionId: number;
  completedMissionIds: number[];
  pendingCrewReplacement: boolean;
}

/**
 * Transitions to the next campaign mission following official book rules:
 * 1. Carries over: Turret Damaged, Immobilized, Fire Level, and Loaded status.
 * 2. Allows replacing 1 KIA crew member if requested.
 */
export function prepareCampaignNextMission(
  nextMissionData: MissionJSON,
  previousSherman: ShermanState,
  replacedCrewRole?: CrewRole
): BoardState {
  const newBoardState = loadMissionState(nextMissionData);

  // Carry over damage & state flags from previous mission
  newBoardState.sherman.isTurretDamaged = previousSherman.isTurretDamaged;
  newBoardState.sherman.isImmobilized = previousSherman.isImmobilized;
  newBoardState.sherman.fireLevel = previousSherman.fireLevel;
  newBoardState.sherman.isLoaded = previousSherman.isLoaded;

  // Copy previous crew statuses
  const crewRoles: CrewRole[] = ['commander', 'loader', 'gunner', 'driver', 'assistant'];
  crewRoles.forEach((role) => {
    const prevMember = previousSherman.crew[role];
    if (prevMember) {
      newBoardState.sherman.crew[role] = {
        ...newBoardState.sherman.crew[role],
        status: prevMember.status,
      };
    }
  });

  // Replace 1 KIA crew member if specified
  if (replacedCrewRole && newBoardState.sherman.crew[replacedCrewRole]) {
    newBoardState.sherman.crew[replacedCrewRole].status = 'active';
  }

  return newBoardState;
}
