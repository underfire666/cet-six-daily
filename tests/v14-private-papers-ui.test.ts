import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLocalPaperId,
  validateTitle,
  parseJsonContent,
  validateImportDraft,
  countContentStats,
  encodePaperIdForUrl,
  hasSpecialPaperIdChars,
  IMPORT_BODY_LIMIT,
} from "../src/lib/private-papers/validation";
import { createPrivatePaper, getPrivatePaper, listPrivatePapers, updatePrivatePaper, deletePrivatePaper } from "../src/content/private-paper-store";
import { prisma } from "../src/lib/db/prisma";
import { randomUUID } from "node:crypto";

// ========== Client-side validation tests ==========

test("1a. validateLocalPaperId: empty rejected", () => {
  assert.equal(validateLocalPaperId(""), "localPaperId 不能为空");
  assert.equal(validateLocalPaperId("   "), "localPaperId 不能为空");
});

test("1b. validateLocalPaperId: too long rejected", () => {
  const long = "a".repeat(129);
  assert.equal(validateLocalPaperId(long), "localPaperId 不能超过 128 字符");
});

test("1c. validateLocalPaperId: colon rejected", () => {
  assert.equal(validateLocalPaperId("my:paper"), "localPaperId 不能包含冒号或控制字符");
});

test("1d. validateLocalPaperId: valid accepted", () => {
  assert.equal(validateLocalPaperId("my-paper-001"), null);
  assert.equal(validateLocalPaperId("paper_123"), null);
  assert.equal(validateLocalPaperId("中文试卷"), null);
});

test("2a. validateTitle: empty rejected", () => {
  assert.equal(validateTitle(""), "标题不能为空");
  assert.equal(validateTitle("   "), "标题不能为空");
});

test("2b. validateTitle: too long rejected", () => {
  const long = "a".repeat(201);
  assert.equal(validateTitle(long), "标题不能超过 200 字符");
});

test("2c. validateTitle: valid accepted", () => {
  assert.equal(validateTitle("我的私有卷"), null);
  assert.equal(validateTitle("A".repeat(200)), null);
});

test("3a. parseJsonContent: empty returns null without error", () => {
  const result = parseJsonContent("");
  assert.equal(result.content, null);
  assert.equal(result.error, "");
});

test("3b. parseJsonContent: invalid JSON returns error", () => {
  const result = parseJsonContent("{invalid json}");
  assert.equal(result.content, null);
  assert.ok(result.error.includes("JSON 格式错误"));
});

test("3c. parseJsonContent: array rejected", () => {
  const result = parseJsonContent("[1, 2, 3]");
  assert.equal(result.content, null);
  assert.ok(result.error.includes("必须是对象"));
});

test("3d. parseJsonContent: valid object parsed", () => {
  const result = parseJsonContent('{"schemaVersion": "1.0.0", "isPartial": true}');
  assert.ok(result.content);
  assert.equal(result.content!.schemaVersion, "1.0.0");
  assert.equal(result.error, "");
});

test("4a. validateImportDraft: all valid", () => {
  const result = validateImportDraft({
    localPaperId: "test-001",
    title: "Test Paper",
    content: { schemaVersion: "1.0.0" },
    parseError: "",
    acknowledged: true,
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("4b. validateImportDraft: missing fields all caught", () => {
  const result = validateImportDraft({
    localPaperId: "",
    title: "",
    content: null,
    parseError: "",
    acknowledged: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "localPaperId"));
  assert.ok(result.errors.some((e) => e.field === "title"));
  assert.ok(result.errors.some((e) => e.field === "content"));
  assert.ok(result.errors.some((e) => e.field === "acknowledgement"));
});

test("4c. validateImportDraft: parseError propagated", () => {
  const result = validateImportDraft({
    localPaperId: "test",
    title: "Test",
    content: null,
    parseError: "JSON 格式错误",
    acknowledged: true,
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, "content");
  assert.equal(result.errors[0].message, "JSON 格式错误");
});

test("5a. countContentStats: empty draft", () => {
  const stats = countContentStats({ schemaVersion: "1.0.0", isPartial: true, sections: [] });
  assert.equal(stats.sections, 0);
  assert.equal(stats.groups, 0);
  assert.equal(stats.questions, 0);
  assert.equal(stats.isPartial, true);
});

test("5b. countContentStats: with sections/groups/questions", () => {
  const content = {
    sections: [
      {
        sectionId: "s1",
        groups: [
          { groupId: "g1", questions: [{ id: "q1" }, { id: "q2" }] },
          { groupId: "g2", questions: [{ id: "q3" }] },
        ],
      },
      {
        sectionId: "s2",
        groups: [{ groupId: "g3", questions: [{ id: "q4" }, { id: "q5" }, { id: "q6" }] }],
      },
    ],
  };
  const stats = countContentStats(content);
  assert.equal(stats.sections, 2);
  assert.equal(stats.groups, 3);
  assert.equal(stats.questions, 6);
});

test("6a. encodePaperIdForUrl: normal ID unchanged", () => {
  assert.equal(encodePaperIdForUrl("private:abc:test-001"), "private%3Aabc%3Atest-001");
});

test("6b. encodePaperIdForUrl: special chars encoded", () => {
  const encoded = encodePaperIdForUrl("private:abc:测试 卷%25");
  assert.ok(encoded.includes("%"));
  assert.ok(!encoded.includes(" "));
});

test("6c. hasSpecialPaperIdChars: detects Chinese and spaces", () => {
  assert.equal(hasSpecialPaperIdChars("private:abc:test"), false);
  assert.equal(hasSpecialPaperIdChars("private:abc:测试"), true);
  assert.equal(hasSpecialPaperIdChars("private:abc:test 1"), true);
});

test("7a. IMPORT_BODY_LIMIT is 1 MiB", () => {
  assert.equal(IMPORT_BODY_LIMIT, 1024 * 1024);
});

// ========== API / Store integration tests ==========

function makeValidContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    isPartial: true,
    sections: [],
    ...overrides,
  };
}

function makeRightsAck() {
  return {
    acknowledged: true as const,
    acknowledgedAt: new Date().toISOString(),
    statementVersion: "1.0" as const,
  };
}

async function createTestUser(prefix: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" },
  });
}

async function cleanupUser(userId: string) {
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

test("8a. unauthenticated create rejected (empty userId)", async () => {
  await assert.rejects(
    createPrivatePaper("", { localPaperId: "x", title: "X", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() }),
    (err: { code: string }) => err.code === "UNAUTHORIZED",
  );
});

test("8b. unauthenticated get rejected", async () => {
  await assert.rejects(
    getPrivatePaper("", "private:abc:test"),
    (err: { code: string }) => err.code === "UNAUTHORIZED",
  );
});

test("9a. create + get + list full flow with empty draft", async () => {
  const user = await createTestUser("flow-empty");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "empty-draft",
      title: "Empty Draft",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    assert.ok(created.paperId);
    assert.equal(created.title, "Empty Draft");

    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.title, "Empty Draft");
    assert.equal(fetched.content.isPartial, true);
    assert.equal(fetched.content.authenticity, "user_import");
    assert.equal(fetched.content.visibility, "private");

    const list = await listPrivatePapers(user.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].paperId, created.paperId);
  } finally {
    await cleanupUser(user.id);
  }
});

test("9b. create with valid content containing sections", async () => {
  const user = await createTestUser("flow-sections");
  try {
    const content = makeValidContent({
      isPartial: false,
      sections: [
        { sectionId: "writing", type: "writing", order: 0, groups: [] },
        { sectionId: "reading", type: "reading", order: 1, groups: [] },
      ],
    });
    const created = await createPrivatePaper(user.id, {
      localPaperId: "with-sections",
      title: "With Sections",
      content,
      rightsAcknowledgement: makeRightsAck(),
    });
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.content.isPartial, false);
    assert.ok(Array.isArray(fetched.content.sections));
    assert.equal((fetched.content.sections as unknown[]).length, 2);
  } finally {
    await cleanupUser(user.id);
  }
});

test("10a. duplicate localPaperId rejected", async () => {
  const user = await createTestUser("dup-id");
  try {
    await createPrivatePaper(user.id, {
      localPaperId: "dup",
      title: "First",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await assert.rejects(
      createPrivatePaper(user.id, {
        localPaperId: "dup",
        title: "Second",
        content: makeValidContent(),
        rightsAcknowledgement: makeRightsAck(),
      }),
      (err: { code: string }) => err.code === "DUPLICATE_ID",
    );
  } finally {
    await cleanupUser(user.id);
  }
});

test("10b. missing rights acknowledgement rejected", async () => {
  const user = await createTestUser("no-ack");
  try {
    await assert.rejects(
      createPrivatePaper(user.id, {
        localPaperId: "noack",
        title: "No Ack",
        content: makeValidContent(),
        rightsAcknowledgement: { acknowledged: false, statementVersion: "1.0" },
      }),
      (err: { code: string }) => err.code === "VALIDATION_ERROR",
    );
  } finally {
    await cleanupUser(user.id);
  }
});

test("11a. update title keeps DB and content.title consistent", async () => {
  const user = await createTestUser("update-title");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "title-test",
      title: "Original Title",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await updatePrivatePaper(user.id, created.paperId, { title: "Updated Title" });
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.title, "Updated Title");
    assert.equal(fetched.content.title, "Updated Title");
  } finally {
    await cleanupUser(user.id);
  }
});

test("11b. delete removes record, subsequent get returns NOT_FOUND", async () => {
  const user = await createTestUser("delete-test");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "del-test",
      title: "To Delete",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await deletePrivatePaper(user.id, created.paperId);
    await assert.rejects(
      getPrivatePaper(user.id, created.paperId),
      (err: { code: string }) => err.code === "NOT_FOUND",
    );
  } finally {
    await cleanupUser(user.id);
  }
});

test("12a. cross-owner isolation: B cannot read A's paper", async () => {
  const userA = await createTestUser("owner-a");
  const userB = await createTestUser("owner-b");
  try {
    const created = await createPrivatePaper(userA.id, {
      localPaperId: "cross-test",
      title: "A's Paper",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await assert.rejects(
      getPrivatePaper(userB.id, created.paperId),
      (err: { code: string }) => err.code === "NOT_FOUND",
    );
  } finally {
    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  }
});

test("12b. cross-owner isolation: B cannot update or delete A's paper", async () => {
  const userA = await createTestUser("owner-a2");
  const userB = await createTestUser("owner-b2");
  try {
    const created = await createPrivatePaper(userA.id, {
      localPaperId: "cross-test2",
      title: "A's Paper 2",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await assert.rejects(
      updatePrivatePaper(userB.id, created.paperId, { title: "Hacked" }),
      (err: { code: string }) => err.code === "NOT_FOUND",
    );
    await assert.rejects(
      deletePrivatePaper(userB.id, created.paperId),
      (err: { code: string }) => err.code === "NOT_FOUND",
    );
    // A's paper still intact
    const fetched = await getPrivatePaper(userA.id, created.paperId);
    assert.equal(fetched.title, "A's Paper 2");
  } finally {
    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  }
});

test("13a. special character localPaperId with Chinese works", async () => {
  const user = await createTestUser("special-cn");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "我的试卷-001",
      title: "中文 ID 测试",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    assert.ok(created.paperId.includes("%") || created.paperId.includes("我的"));
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.title, "中文 ID 测试");
  } finally {
    await cleanupUser(user.id);
  }
});

test("13b. server forces authenticity=user_import and visibility=private", async () => {
  const user = await createTestUser("force-fields");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "force-test",
      title: "Force Test",
      content: makeValidContent({ authenticity: "past_exam", visibility: "public", productionEligible: true }),
      rightsAcknowledgement: makeRightsAck(),
    });
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.content.authenticity, "user_import");
    assert.equal(fetched.content.visibility, "private");
    assert.equal(fetched.content.productionEligible, false);
  } finally {
    await cleanupUser(user.id);
  }
});

test("14a. refresh re-reads from server (list after create)", async () => {
  const user = await createTestUser("refresh");
  try {
    await createPrivatePaper(user.id, {
      localPaperId: "refresh-1",
      title: "Refresh 1",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await createPrivatePaper(user.id, {
      localPaperId: "refresh-2",
      title: "Refresh 2",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    // Simulate refresh: new list call
    const list = await listPrivatePapers(user.id);
    assert.equal(list.length, 2);
  } finally {
    await cleanupUser(user.id);
  }
});

// Cleanup prisma connection after all tests
test.after(async () => {
  await prisma.$disconnect();
});
