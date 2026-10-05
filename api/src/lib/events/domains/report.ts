import { registerEvent } from '../index.js';

export const ReportTeamGenerated = registerEvent<{ team_id: string }>('report.team.generated');

export const ReportUserGenerated = registerEvent<{ user_id: string }>('report.user.generated');
