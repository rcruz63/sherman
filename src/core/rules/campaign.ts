/**
 * Campaign Mode Rules & Transition Engine
 * Rulebook Page 19: «SELECCIÓN DE MISIÓN Y CREACIÓN DE LA CAMPAÑA»
 */

import { BoardState, CampaignProgress, CampaignType, CrewRole, MissionJSON, ShermanState } from '../../types/game';
import { loadMissionState } from './missionLoader';

export const ALL_MISSION_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/**
 * Creates a new campaign progress state based on type and options
 */
export function createCampaign(
  type: CampaignType,
  options?: { missionIds?: number[]; count?: number }
): CampaignProgress {
  let sequence: number[] = [];

  if (type === 'sequential') {
    sequence = [...ALL_MISSION_IDS];
  } else if (type === 'custom' && options?.missionIds && options.missionIds.length > 0) {
    sequence = [...options.missionIds];
  } else if (type === 'random') {
    const totalCount = Math.min(13, Math.max(2, options?.count ?? 3));
    const shuffled = [...ALL_MISSION_IDS].sort(() => Math.random() - 0.5);
    sequence = shuffled.slice(0, totalCount);
  } else {
    sequence = [...ALL_MISSION_IDS];
  }

  return {
    active: true,
    type,
    missionSequence: sequence,
    currentMissionIndex: 0,
    completedMissionIds: [],
    pendingCrewReplacement: false,
    campaignStats: {
      totalTurns: 0,
      tanksDestroyed: 0,
      infantryEliminated: 0,
      crewCasualtiesCount: 0,
    },
  };
}

/**
 * Extracts a concise summary of Sherman damage and casualties for carry-over debriefing
 */
export function getShermanCarryOverSummary(sherman: ShermanState): {
  isTurretDamaged: boolean;
  isImmobilized: boolean;
  fireLevel: number;
  isLoaded: boolean;
  kiaCrew: { role: CrewRole; name: string }[];
  activeCrewCount: number;
} {
  const crewRoles: CrewRole[] = ['commander', 'loader', 'gunner', 'driver', 'assistant'];
  const kiaCrew: { role: CrewRole; name: string }[] = [];
  let activeCrewCount = 0;

  crewRoles.forEach((role) => {
    const member = sherman.crew[role];
    if (member.status === 'kia') {
      kiaCrew.push({ role, name: member.name });
    } else {
      activeCrewCount++;
    }
  });

  return {
    isTurretDamaged: sherman.isTurretDamaged,
    isImmobilized: sherman.isImmobilized,
    fireLevel: sherman.fireLevel,
    isLoaded: sherman.isLoaded,
    kiaCrew,
    activeCrewCount,
  };
}

/**
 * Transitions to the next campaign mission following official book rules (page 19):
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

/**
 * Checks whether all missions in the campaign have been completed
 */
export function isCampaignCompleted(campaign: CampaignProgress): boolean {
  if (!campaign.active) return false;
  return campaign.currentMissionIndex >= campaign.missionSequence.length;
}

/**
 * Advances campaign progress to the next mission and aggregates statistics
 */
export function advanceCampaignProgress(
  campaign: CampaignProgress,
  completedMissionId: number,
  missionStats?: {
    turns?: number;
    tanksDestroyed?: number;
    infantryEliminated?: number;
    crewCasualtiesCount?: number;
  }
): CampaignProgress {
  const nextIndex = campaign.currentMissionIndex + 1;
  const completedIds = campaign.completedMissionIds.includes(completedMissionId)
    ? campaign.completedMissionIds
    : [...campaign.completedMissionIds, completedMissionId];

  return {
    ...campaign,
    currentMissionIndex: nextIndex,
    completedMissionIds: completedIds,
    pendingCrewReplacement: false,
    campaignStats: {
      totalTurns: campaign.campaignStats.totalTurns + (missionStats?.turns ?? 0),
      tanksDestroyed: campaign.campaignStats.tanksDestroyed + (missionStats?.tanksDestroyed ?? 0),
      infantryEliminated: campaign.campaignStats.infantryEliminated + (missionStats?.infantryEliminated ?? 0),
      crewCasualtiesCount: campaign.campaignStats.crewCasualtiesCount + (missionStats?.crewCasualtiesCount ?? 0),
    },
  };
}
