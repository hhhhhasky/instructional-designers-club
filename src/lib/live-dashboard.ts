import type { AdminLiveQuestion, LiveResponse, LiveSession } from "@/lib/live";
import { summarizeLiveResults, type LiveResultsSummary } from "@/lib/live";

export interface AdminLiveQuestionDashboard extends LiveResultsSummary {
  question: AdminLiveQuestion;
  responseRate: number;
}

export interface AdminLiveSessionDashboard {
  session: LiveSession;
  participantCount: number;
  answeredParticipantCount: number;
  totalResponses: number;
  questionCount: number;
  overallParticipationRate: number;
  questions: AdminLiveQuestionDashboard[];
}

export interface LiveRoomAudienceSummary {
  liveId: string;
  currentQuestionId: string | null;
  joinedCount: number;
  answeredCount: number;
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

export function buildAdminLiveSessionDashboard(
  session: LiveSession,
  questions: AdminLiveQuestion[],
  responses: LiveResponse[],
  participantCount: number,
): AdminLiveSessionDashboard {
  const answeredParticipantCount = new Set(responses.map((response) => response.user_id)).size;
  const questionDashboards = questions.map((question) => {
    const questionResponses = responses.filter((response) => response.question_id === question.id);
    return {
      question,
      ...summarizeLiveResults(question, question.correct_answer, questionResponses),
      responseRate: percentage(questionResponses.length, participantCount),
    };
  });

  return {
    session,
    participantCount,
    answeredParticipantCount,
    totalResponses: responses.length,
    questionCount: questions.length,
    overallParticipationRate: percentage(answeredParticipantCount, participantCount),
    questions: questionDashboards,
  };
}
