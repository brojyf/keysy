import { afterEach, expect, mock, test } from "bun:test";
import { aivenCa } from "../agent/lib/aiven_ca";

type Committed = { partitionIndex: number; committedOffset: bigint }[];

const adminOptions: unknown[] = [];
const closed: boolean[] = [];
let committed: Committed = [];
let earliest = [0n, 0n];
// Simulates notify committing between two Kafka reads.
let afterEndOffsetsRead: (() => void) | undefined;

mock.module("@platformatic/kafka", () => ({
  ListOffsetTimestamps: { LATEST: -1n, EARLIEST: -2n },
  Admin: class {
    constructor(options: unknown) {
      adminOptions.push(options);
    }
    async metadata() {
      return { topics: new Map([["keysy.email", { partitionsCount: 2 }]]) };
    }
    async listOffsets(options: { topics: { partitions: { timestamp: bigint }[] }[] }) {
      if (options.topics[0].partitions[0].timestamp === -2n) {
        return [
          {
            name: "keysy.email",
            partitions: earliest.map((offset, partitionIndex) => ({ partitionIndex, offset })),
          },
        ];
      }
      afterEndOffsetsRead?.();
      return [
        {
          name: "keysy.email",
          partitions: [
            { partitionIndex: 0, offset: 8n },
            { partitionIndex: 1, offset: 5n },
          ],
        },
      ];
    }
    async listConsumerGroupOffsets() {
      await Promise.resolve();
      return [{ groupId: "notify", topics: [{ name: "keysy.email", partitions: committed }] }];
    }
    async close() {
      closed.push(true);
    }
  },
}));

const { default: queryKafkaLag } = await import("../agent/tools/query_kafka_lag");
const execute = queryKafkaLag.execute as (input: object) => Promise<unknown>;

afterEach(() => {
  adminOptions.length = 0;
  closed.length = 0;
  afterEndOffsetsRead = undefined;
  earliest = [0n, 0n];
  delete process.env.KAFKA_PASSWORD;
});

test("returns the lag of notify per partition over SASL and the Aiven CA, and closes the client", async () => {
  process.env.KAFKA_PASSWORD = "kafka_password";
  committed = [
    { partitionIndex: 0, committedOffset: 8n },
    { partitionIndex: 1, committedOffset: 2n },
  ];

  const output = await execute({});

  expect(adminOptions).toEqual([
    {
      clientId: "keysy-bot",
      bootstrapBrokers: ["keysy-kafka-keysy.i.aivencloud.com:11980"],
      tls: { ca: aivenCa },
      sasl: { mechanism: "SCRAM-SHA-512", username: "keysy-bot", password: "kafka_password" },
      timeout: 10_000,
    },
  ]);
  expect(output).toMatchObject({
    group: "notify",
    topic: "keysy.email",
    partitions: [
      { partition: 0, committedOffset: 8, endOffset: 8, lag: 0 },
      { partition: 1, committedOffset: 2, endOffset: 5, lag: 3 },
    ],
    totalLag: 3,
  });
  expect((output as { checkedAt: string }).checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(closed).toEqual([true]);
});

test("reports a null committed offset when notify never committed on a partition", async () => {
  process.env.KAFKA_PASSWORD = "kafka_password";
  committed = [{ partitionIndex: 0, committedOffset: -1n }];

  const output = await execute({});

  expect(output).toMatchObject({
    partitions: [
      { partition: 0, committedOffset: null, endOffset: 8, lag: 8 },
      { partition: 1, committedOffset: null, endOffset: 5, lag: 5 },
    ],
    totalLag: 13,
  });
});

test("reads the committed offsets before the end offsets so a commit between reads cannot give a negative lag", async () => {
  process.env.KAFKA_PASSWORD = "kafka_password";
  committed = [
    { partitionIndex: 0, committedOffset: 8n },
    { partitionIndex: 1, committedOffset: 2n },
  ];
  afterEndOffsetsRead = () => {
    committed = [
      { partitionIndex: 0, committedOffset: 10n },
      { partitionIndex: 1, committedOffset: 2n },
    ];
  };

  const output = await execute({});

  expect(output).toMatchObject({
    partitions: [
      { partition: 0, committedOffset: 8, endOffset: 8, lag: 0 },
      { partition: 1, committedOffset: 2, endOffset: 5, lag: 3 },
    ],
    totalLag: 3,
  });
});

test("counts the lag from the earliest offset when records before it were deleted", async () => {
  process.env.KAFKA_PASSWORD = "kafka_password";
  committed = [
    { partitionIndex: 0, committedOffset: -1n },
    { partitionIndex: 1, committedOffset: 1n },
  ];
  earliest = [3n, 4n];

  const output = await execute({});

  expect(output).toMatchObject({
    partitions: [
      { partition: 0, earliestOffset: 3, committedOffset: null, endOffset: 8, lag: 5 },
      { partition: 1, earliestOffset: 4, committedOffset: 1, endOffset: 5, lag: 1 },
    ],
    totalLag: 6,
  });
});

test("fails without KAFKA_PASSWORD", async () => {
  await expect(execute({})).rejects.toThrow("KAFKA_PASSWORD is not set");
});
