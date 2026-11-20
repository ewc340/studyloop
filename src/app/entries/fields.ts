// Field names shared by the Daily Entry form and the action that reads it.

/** Repeated once per tagged Topic, holding its id. */
export const TOPIC_FIELD = "topicId";

/** Holds the Confidence (1–5) in the tagged Topic with this id. */
export function confidenceField(id: string): string {
  return `confidence-${id}`;
}
