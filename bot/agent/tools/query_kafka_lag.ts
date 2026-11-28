import { defineTool } from "eve/tools";
import { z } from "zod";
import { aivenCa } from "../lib/aiven_ca";

// Aiven Kafka service keysy-kafka, SASL listener. The host and user are not secrets.
const broker = "keysy-kafka-keysy.i.aivencloud.com:11980";
const username = "keysy-bot";
const group = "notify";
const topic = "keysy.email";

export default defineTool({
  description: `Get the consumer lag of keysy-notify on the keysy.email Kafka topic.
keysy-api writes one record to keysy.email for each email, and keysy-notify reads the records and sends the emails through Resend.
Use it to answer whether emails are stuck.

Output:
- checkedAt: the UTC time of the check.
- partitions: for each partition, committedOffset (the next record keysy-notify will read; null if keysy-notify never committed), endOffset (the offset after the last record), and lag (records that keysy-notify has not read yet).
- totalLag: the sum of lag over all partitions.

How to read it:
- totalLag 0 means keysy-notify read every email request. It does not prove that Resend delivered the emails.
- A lag above 0 that stays or grows on later checks means keysy-notify is down or stuck. Check its logs with query_grafana_logs and the machine with query_fly_logs.
- A lag above 0 right after a burst of emails is normal for a short time.`,
  inputSchema: z.object({}),
  label: { start: () => "Query Kafka lag" },
  async execute() {
    const password = process.env.KAFKA_PASSWORD;
    if (!password) throw new Error("KAFKA_PASSWORD is not set");

    const { Admin, ListOffsetTimestamps } = await import("@platformatic/kafka");
    const admin = new Admin({
      clientId: "keysy-bot",
      bootstrapBrokers: [broker],
      tls: { ca: aivenCa },
      sasl: { mechanism: "SCRAM-SHA-512", username, password },
      timeout: 10_000,
    });
    try {
      const metadata = await admin.metadata({ topics: [topic] });
      const partitionCount = metadata.topics.get(topic)?.partitionsCount ?? 0;
      const partitionIndexes = Array.from({ length: partitionCount }, (_, i) => i);

      const [ends, commits] = await Promise.all([
        admin.listOffsets({
          topics: [
            {
              name: topic,
              partitions: partitionIndexes.map((partitionIndex) => ({
                partitionIndex,
                timestamp: ListOffsetTimestamps.LATEST,
              })),
            },
          ],
        }),
        admin.listConsumerGroupOffsets({ groups: [group] }),
      ]);

      const endOffsets = new Map(
        ends.find((t) => t.name === topic)?.partitions.map((p) => [p.partitionIndex, p.offset]) ?? [],
      );
      const committedOffsets = new Map(
        commits
          .find((g) => g.groupId === group)
          ?.topics.find((t) => t.name === topic)
          ?.partitions.filter((p) => p.committedOffset >= 0n)
          .map((p) => [p.partitionIndex, p.committedOffset]) ?? [],
      );

      const partitions = partitionIndexes.map((partition) => {
        const endOffset = endOffsets.get(partition) ?? 0n;
        const committedOffset = committedOffsets.get(partition);
        return {
          partition,
          committedOffset: committedOffset === undefined ? null : Number(committedOffset),
          endOffset: Number(endOffset),
          lag: Number(endOffset - (committedOffset ?? 0n)),
        };
      });
      return {
        checkedAt: new Date().toISOString(),
        group,
        topic,
        partitions,
        totalLag: partitions.reduce((sum, p) => sum + p.lag, 0),
      };
    } finally {
      await admin.close();
    }
  },
});
