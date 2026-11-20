import type { TopicConfidence } from "@/core";
import { formatCalendarDate } from "../../entries/format";

/** The Topic's latest Confidence and every earlier rating, from the Learner's Daily Entries. */
export function TopicConfidenceSection({ confidence }: { confidence: TopicConfidence }) {
  const { latest, history } = confidence;
  return (
    <section aria-labelledby="confidence-heading" className="flex flex-col gap-3">
      <h2 id="confidence-heading" className="text-lg font-semibold">
        Confidence
      </h2>
      {latest ? (
        <>
          <p data-testid="latest-confidence" className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{latest.confidence}/5</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">on {formatCalendarDate(latest.date)}</span>
          </p>
          {history.length > 1 && (
            <table data-testid="confidence-history" className="w-full text-left text-sm">
              <caption className="sr-only">Confidence history, newest first</caption>
              <thead className="text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {history.toReversed().map((rating) => (
                  <tr key={rating.date}>
                    <td className="py-1.5">{formatCalendarDate(rating.date)}</td>
                    <td className="py-1.5 text-right tabular-nums">{rating.confidence}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p className="text-zinc-700 dark:text-zinc-300">
          Not rated yet. Tag this Topic in a Daily Entry to rate your Confidence.
        </p>
      )}
    </section>
  );
}
