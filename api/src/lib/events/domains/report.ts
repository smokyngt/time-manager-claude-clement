import { registerEvent } from '../base/registry.js';

export const ReportTeamGenerated = registerEvent<{ actor: string; team_id: string }>({
  code: 'report.team.generated',
});

export const ReportUserGenerated = registerEvent<{ actor: string; user_id: string }>({
  code: 'report.user.generated',
});
