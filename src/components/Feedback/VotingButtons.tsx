import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { submitVote, getVoteSummary } from "../../lib/feedback";

interface VotingButtonsProps {
  bookId: number;
  chapter: number;
  verse: number;
  translationId: string;
}

export function VotingButtons({ bookId, chapter, verse, translationId }: VotingButtonsProps) {
  const { t } = useTranslation();
  const [votes, setVotes] = useState({ upvotes: 0, downvotes: 0 });
  const [voted, setVoted] = useState<1 | -1 | null>(null);

  useEffect(() => {
    getVoteSummary(bookId, chapter, verse, translationId).then(setVotes);
  }, [bookId, chapter, verse, translationId]);

  const handleVote = async (vote: 1 | -1) => {
    if (voted) return;
    setVoted(vote);
    await submitVote(bookId, chapter, verse, translationId, vote);
    setVotes((prev) => ({
      upvotes: prev.upvotes + (vote === 1 ? 1 : 0),
      downvotes: prev.downvotes + (vote === -1 ? 1 : 0),
    }));
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={() => handleVote(1)}
        disabled={voted !== null}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${
          voted === 1
            ? "bg-green-100 text-green-700"
            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
        } disabled:cursor-default`}
        title={t("feedback.helpful")}
      >
        <span>👍</span>
        <span>{votes.upvotes}</span>
      </button>
      <button
        onClick={() => handleVote(-1)}
        disabled={voted !== null}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${
          voted === -1
            ? "bg-red-100 text-red-700"
            : "text-gray-400 hover:text-red-600 hover:bg-red-50"
        } disabled:cursor-default`}
        title={t("feedback.notHelpful")}
      >
        <span>👎</span>
        <span>{votes.downvotes}</span>
      </button>
    </div>
  );
}
