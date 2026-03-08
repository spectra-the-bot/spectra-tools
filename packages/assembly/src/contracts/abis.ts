import type { Abi } from 'viem';
import councilSeatsAbiJson from './CouncilSeats.abi.json' with { type: 'json' };
import forumAbiJson from './Forum.abi.json' with { type: 'json' };
import governanceAbiJson from './Governance.abi.json' with { type: 'json' };
import registryAbiJson from './Registry.abi.json' with { type: 'json' };
import treasuryAbiJson from './Treasury.abi.json' with { type: 'json' };

export const registryAbi = registryAbiJson as Abi;
export const councilSeatsAbi = councilSeatsAbiJson as Abi;
export const forumAbi = forumAbiJson as Abi;
export const governanceAbi = governanceAbiJson as Abi;
export const treasuryAbi = treasuryAbiJson as Abi;
