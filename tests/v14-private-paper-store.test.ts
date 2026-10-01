/**
 * V14 Phase 1B: PrivatePaper 存储层回归测试。
 *
 * 覆盖：
 * - 未登录/无效 userId 拒绝
 * - 正常 CRUD 与持久化
 * - A/B 用户跨 owner 访问及修改被拒绝
 * - 伪造 ownerId、非法 authenticity 被拒绝
 * - 禁止更新身份字段
 * - 非法内容和缺失 rightsAcknowledgement 被拒绝
 * - 重复 ID、删除后读取、不存在记录
 * - PRIVATE 不进入 production selector
 * - 既有公开 Paper 行为不回归
 *
 * 使用隔离测试数据（随机 UUID 用户），测试后清理。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import {
  createPrivatePaper,
  getPrivatePaper,
  updatePrivatePaper,
  deletePrivatePaper,
  listPrivatePapers,
  PrivatePaperStoreError,
} from "../src/content/private-paper-store";
import { isPrivateContent } from "../src/content/private-content";
import { getPublishableItems, getItems, getPapers } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";

// ============================================================================
// 测试辅助
// ============================================================================

async function createTestUser(prefix: string) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" },
  });
  return user;
}

function makeValidContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sections: [], isPartial: true,
    ...overrides,
  };
}

function makeRightsAck() {
  return {
    acknowledged: true,
    acknowledgedAt: new Date().toISOString(),
    statementVersion: "1.0",
  };
}

// ============================================================================
// 1. 未登录 / 无效 userId 拒绝
// ============================================================================

test("1a. createPrivatePaper: 空 userId 拒绝 (UNAUTHORIZED)", async () => {
  await assert.rejects(
    createPrivatePaper("", {
      localPaperId: "test",
      title: "Test",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    }),
    (err: PrivatePaperStoreError) => err.code === "UNAUTHORIZED",
  );
});

test("1b. getPrivatePaper: 空 userId 拒绝 (UNAUTHORIZED)", async () => {
  await assert.rejects(
    getPrivatePaper("", "private:user:test"),
    (err: PrivatePaperStoreError) => err.code === "UNAUTHORIZED",
  );
});

test("1c. updatePrivatePaper: 空 userId 拒绝 (UNAUTHORIZED)", async () => {
  await assert.rejects(
    updatePrivatePaper("", "private:user:test", { title: "x" }),
    (err: PrivatePaperStoreError) => err.code === "UNAUTHORIZED",
  );
});

test("1d. deletePrivatePaper: 空 userId 拒绝 (UNAUTHORIZED)", async () => {
  await assert.rejects(
    deletePrivatePaper("", "private:user:test"),
    (err: PrivatePaperStoreError) => err.code === "UNAUTHORIZED",
  );
});

// ============================================================================
// 2. 正常 CRUD 与持久化
// ============================================================================

test("2a. create + get + 持久化验证", async () => {
  const user = await createTestUser("p1b-crud");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "my-paper-1",
      title: "My Private Paper",
      content: makeValidContent({ custom: "data" }),
      rightsAcknowledgement: makeRightsAck(),
    });

    assert.ok(created.id, "id should be returned");
    assert.ok(created.paperId.startsWith("private:"), "paperId should use private namespace");
    assert.equal(created.title, "My Private Paper");

    // 从数据库读取验证持久化
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.paperId, created.paperId);
    assert.equal(fetched.title, "My Private Paper");
    assert.equal(fetched.content.custom, "data");
    assert.equal(fetched.content.authenticity, "user_import");
    assert.equal(fetched.content.visibility, "private");
    assert.equal(fetched.content.ownerId, user.id);
    assert.equal(fetched.content.productionEligible, false);
    assert.equal(fetched.content.globalSelectorEligible, false);

    // 直接查数据库验证
    const dbRecord = await prisma.privatePaper.findUnique({
      where: { userId_paperId: { userId: user.id, paperId: created.paperId } },
    });
    assert.ok(dbRecord, "record should exist in database");
    assert.equal(dbRecord!.userId, user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("2b. listPrivatePapers 返回用户所有私有卷", async () => {
  const user = await createTestUser("p1b-list");
  try {
    await createPrivatePaper(user.id, {
      localPaperId: "paper-a",
      title: "Paper A",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });
    await createPrivatePaper(user.id, {
      localPaperId: "paper-b",
      title: "Paper B",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    const list = await listPrivatePapers(user.id);
    assert.equal(list.length, 2);
    assert.ok(list.some((p) => p.title === "Paper A"));
    assert.ok(list.some((p) => p.title === "Paper B"));
    // list 不返回完整 content
    assert.ok(!("content" in list[0]), "list should not include full content");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("2c. updatePrivatePaper 更新 title 和 content", async () => {
  const user = await createTestUser("p1b-update");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "upd-paper",
      title: "Original Title",
      content: makeValidContent({ field: "old" }),
      rightsAcknowledgement: makeRightsAck(),
    });

    const updated = await updatePrivatePaper(user.id, created.paperId, {
      title: "Updated Title",
      content: makeValidContent({ field: "new" }),
    });

    assert.equal(updated.title, "Updated Title");

    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.title, "Updated Title");
    assert.equal(fetched.content.field, "new");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("2d. deletePrivatePaper 删除后读取返回 NOT_FOUND", async () => {
  const user = await createTestUser("p1b-delete");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "del-paper",
      title: "To Delete",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    const result = await deletePrivatePaper(user.id, created.paperId);
    assert.equal(result.success, true);

    await assert.rejects(
      getPrivatePaper(user.id, created.paperId),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

// ============================================================================
// 3. A/B 用户跨 owner 访问及修改被拒绝
// ============================================================================

test("3a. User B 不能读取 User A 的私有卷 (一致 NOT_FOUND)", async () => {
  const userA = await createTestUser("p1b-ownerA");
  const userB = await createTestUser("p1b-ownerB");
  try {
    const paperA = await createPrivatePaper(userA.id, {
      localPaperId: "secret-paper",
      title: "A's Secret",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    // B 尝试读取 A 的 paper
    await assert.rejects(
      getPrivatePaper(userB.id, paperA.paperId),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }
});

test("3b. User B 不能更新 User A 的私有卷", async () => {
  const userA = await createTestUser("p1b-ownerA2");
  const userB = await createTestUser("p1b-ownerB2");
  try {
    const paperA = await createPrivatePaper(userA.id, {
      localPaperId: "upd-secret",
      title: "A's Paper",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    await assert.rejects(
      updatePrivatePaper(userB.id, paperA.paperId, { title: "Hacked" }),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );

    // 验证 A 的 paper 未被修改
    const fetched = await getPrivatePaper(userA.id, paperA.paperId);
    assert.equal(fetched.title, "A's Paper");
  } finally {
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }
});

test("3c. User B 不能删除 User A 的私有卷", async () => {
  const userA = await createTestUser("p1b-ownerA3");
  const userB = await createTestUser("p1b-ownerB3");
  try {
    const paperA = await createPrivatePaper(userA.id, {
      localPaperId: "del-secret",
      title: "A's Paper",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    await assert.rejects(
      deletePrivatePaper(userB.id, paperA.paperId),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );

    // 验证 A 的 paper 仍然存在
    const fetched = await getPrivatePaper(userA.id, paperA.paperId);
    assert.equal(fetched.title, "A's Paper");
  } finally {
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }
});

// ============================================================================
// 4. 伪造 ownerId / 非法 authenticity 被拒绝
// ============================================================================

test("4a. create 时 content 中伪造 ownerId 会被 server 覆盖", async () => {
  const user = await createTestUser("p1b-forge");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "forge-paper",
      title: "Forge Test",
      content: makeValidContent({ ownerId: "someone-else-id", authenticity: "past_exam" }),
      rightsAcknowledgement: makeRightsAck(),
    });

    const fetched = await getPrivatePaper(user.id, created.paperId);
    // server 派生的 ownerId 覆盖了客户端伪造的值
    assert.equal(fetched.content.ownerId, user.id);
    assert.notEqual(fetched.content.ownerId, "someone-else-id");
    // authenticity 被强制设为 user_import
    assert.equal(fetched.content.authenticity, "user_import");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("4b. update 时不能修改 authenticity 为 past_exam", async () => {
  const user = await createTestUser("p1b-auth");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "auth-paper",
      title: "Auth Test",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    // 尝试在 content 中修改 authenticity
    await updatePrivatePaper(user.id, created.paperId, {
      content: makeValidContent({ authenticity: "past_exam" }),
    });

    const fetched = await getPrivatePaper(user.id, created.paperId);
    // authenticity 被强制保留为 user_import
    assert.equal(fetched.content.authenticity, "user_import");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

// ============================================================================
// 5. 禁止更新身份字段
// ============================================================================

test("5a. update 不能修改 ownerId / paperId / visibility", async () => {
  const user = await createTestUser("p1b-identity");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "id-paper",
      title: "Identity Test",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    const originalPaperId = created.paperId;

    await updatePrivatePaper(user.id, originalPaperId, {
      content: makeValidContent({
        ownerId: "hacked-owner",
        paperId: "hacked-paper-id",
        visibility: "public",
      }),
    });

    const fetched = await getPrivatePaper(user.id, originalPaperId);
    assert.equal(fetched.content.ownerId, user.id);
    assert.equal(fetched.content.paperId, originalPaperId);
    assert.equal(fetched.content.visibility, "private");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

// ============================================================================
// 6. 非法内容和缺失 rightsAcknowledgement 被拒绝
// ============================================================================

test("6a. create 缺失 rightsAcknowledgement 拒绝", async () => {
  const user = await createTestUser("p1b-rights");
  try {
    await assert.rejects(
      createPrivatePaper(user.id, {
        localPaperId: "no-rights",
        title: "No Rights",
        content: makeValidContent(),
        rightsAcknowledgement: { acknowledged: false, acknowledgedAt: "", statementVersion: "" },
      }),
      (err: PrivatePaperStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("6b. server 强制覆盖 productionEligible=false（即使客户端设为 true）", async () => {
  const user = await createTestUser("p1b-prod-elig");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "prod-elig",
      title: "Prod Elig",
      content: makeValidContent({ productionEligible: true }),
      rightsAcknowledgement: makeRightsAck(),
    });
    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(fetched.content.productionEligible, false, "server must force productionEligible=false");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("6c. create localPaperId 含冒号拒绝", async () => {
  const user = await createTestUser("p1b-colon");
  try {
    await assert.rejects(
      createPrivatePaper(user.id, {
        localPaperId: "invalid:id",
        title: "Colon",
        content: makeValidContent(),
        rightsAcknowledgement: makeRightsAck(),
      }),
      (err: PrivatePaperStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

// ============================================================================
// 7. 重复 ID / 不存在记录
// ============================================================================

test("7a. 重复 localPaperId 创建返回 DUPLICATE_ID", async () => {
  const user = await createTestUser("p1b-dup");
  try {
    await createPrivatePaper(user.id, {
      localPaperId: "same-id",
      title: "First",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    await assert.rejects(
      createPrivatePaper(user.id, {
        localPaperId: "same-id",
        title: "Second",
        content: makeValidContent(),
        rightsAcknowledgement: makeRightsAck(),
      }),
      (err: PrivatePaperStoreError) => err.code === "DUPLICATE_ID",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("7b. 读取不存在的 paper 返回 NOT_FOUND", async () => {
  const user = await createTestUser("p1b-notfound");
  try {
    await assert.rejects(
      getPrivatePaper(user.id, "private:nonexistent:paper"),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("7c. 更新不存在的 paper 返回 NOT_FOUND", async () => {
  const user = await createTestUser("p1b-upd-notfound");
  try {
    await assert.rejects(
      updatePrivatePaper(user.id, "private:nonexistent:paper", { title: "x" }),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("7d. 删除不存在的 paper 返回 NOT_FOUND", async () => {
  const user = await createTestUser("p1b-del-notfound");
  try {
    await assert.rejects(
      deletePrivatePaper(user.id, "private:nonexistent:paper"),
      (err: PrivatePaperStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

// ============================================================================
// 8. PRIVATE 不进入 production selector
// ============================================================================

test("8a. isPrivateContent 识别私有卷", async () => {
  const user = await createTestUser("p1b-selector");
  try {
    const created = await createPrivatePaper(user.id, {
      localPaperId: "selector-paper",
      title: "Selector Test",
      content: makeValidContent(),
      rightsAcknowledgement: makeRightsAck(),
    });

    const fetched = await getPrivatePaper(user.id, created.paperId);
    assert.equal(isPrivateContent(fetched.content as { visibility?: string; id?: string }), true);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("8b. getItems / getPublishableItems 不包含私有卷", async () => {
  // 私有卷存储在数据库，不注册到 content registry
  const allItems = getItems();
  const allIds = allItems.map((i) => (i as { id?: string; paperId?: string }).id ?? (i as { paperId?: string }).paperId);
  const privateInAll = allIds.filter((id) => typeof id === "string" && id.startsWith("private:"));
  assert.equal(privateInAll.length, 0, "no private items should be in registry");

  const publishable = getPublishableItems();
  const pubIds = publishable.map((i) => (i as { id?: string; paperId?: string }).id ?? (i as { paperId?: string }).paperId);
  const privateInPub = pubIds.filter((id) => typeof id === "string" && id.startsWith("private:"));
  assert.equal(privateInPub.length, 0, "no private items should be in publishable items");
});

// ============================================================================
// 9. 既有公开 Paper 行为不回归
// ============================================================================

test("9a. Paper001 仍然可通过 registry 访问（无回归）", async () => {
  const papers = getPapers();
  const paper001 = papers.find((p) => (p as { paperId?: string }).paperId === "cet6:mock:paper-001");
  assert.ok(paper001, "Paper001 should exist in registry");
  assert.equal((paper001 as { authenticity?: string }).authenticity, "original");
});

// 注册内置内容包（用于 Paper001 无回归测试）
test.before(async () => {
  registerBuiltinPacks();
});

// 清理 prisma 连接
test.after(async () => {
  await prisma.$disconnect();
});


// Phase 1B.1: real database regressions, scoped to newly generated owners.
test("1B.1 runtime validation, titles and server acknowledgement", async () => {
  const user = await createTestUser("hardening");
  const input = { localPaperId: "draft", title: "Draft", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() };
  const invalid = (e: PrivatePaperStoreError) => e.code === "VALIDATION_ERROR";
  try {
    for (const title of ["", "   ", 42, "x".repeat(201)]) await assert.rejects(createPrivatePaper(user.id, { ...input, title }), invalid);
    for (const content of [[], null, { schemaVersion: 1, sections: "bad" }]) await assert.rejects(createPrivatePaper(user.id, { ...input, content }), invalid);
    for (const statementVersion of ["", "99", null]) await assert.rejects(createPrivatePaper(user.id, { ...input, rightsAcknowledgement: { ...makeRightsAck(), statementVersion } }), invalid);
    const start = Date.now();
    const created = await createPrivatePaper(user.id, { ...input, rightsAcknowledgement: { ...makeRightsAck(), acknowledgedAt: "1900-01-01" } });
    const before = await getPrivatePaper(user.id, created.paperId);
    const ack = before.content.rightsAcknowledgement as { acknowledgedAt: string };
    assert.ok(Date.parse(ack.acknowledgedAt) >= start); assert.ok(!created.paperId.includes(user.id));
    await updatePrivatePaper(user.id, created.paperId, { content: { title: "Nested title", rightsAcknowledgement: { acknowledged: false }, importedAt: "forged" } });
    const after = await getPrivatePaper(user.id, created.paperId);
    assert.equal(after.title, "Nested title"); assert.equal(after.content.title, after.title);
    assert.deepEqual(after.content.rightsAcknowledgement, before.content.rightsAcknowledgement); assert.equal(after.content.importedAt, before.content.importedAt);
    await updatePrivatePaper(user.id, created.paperId, { title: "Top title" });
    assert.equal((await getPrivatePaper(user.id, created.paperId)).content.title, "Top title");
    for (const updates of [[], { title: "" }, { title: "   " }, { content: [] }, { content: { sections: {} } }, { title: "A", content: { title: "B" } }, { rightsAcknowledgement: { acknowledged: true, statementVersion: "99" } }]) await assert.rejects(updatePrivatePaper(user.id, created.paperId, updates), invalid);
    assert.equal((await getPrivatePaper(user.id, created.paperId)).title, "Top title");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
test("1B.1 special local IDs survive all CRUD operations", async () => {
  const user = await createTestUser("special-id");
  try {
    for (const localPaperId of ["paper%", "paper%25", "中文卷", "with space"]) {
      const p = await createPrivatePaper(user.id, { localPaperId, title: "Special", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() });
      assert.equal((await getPrivatePaper(user.id, p.paperId)).paperId, p.paperId);
      await updatePrivatePaper(user.id, p.paperId, { title: "Updated" });
      assert.equal((await getPrivatePaper(user.id, p.paperId)).title, "Updated");
      await deletePrivatePaper(user.id, p.paperId);
    }
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
test("1B.1 concurrent duplicate creates produce exactly one success", async () => {
  const user = await createTestUser("race");
  try {
    const input = { localPaperId: "race", title: "Race", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() };
    const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => createPrivatePaper(user.id, input)));
    assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
    for (const o of outcomes) if (o.status === "rejected") assert.equal(o.reason.code, "DUPLICATE_ID");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
test("1B.1 legacy ID remains accessible, immutable and cannot be duplicated", async () => {
  const user = await createTestUser("legacy");
  const paperId = `private:${user.id}:old`;
  try {
    const content = { ...makeValidContent(), sections: { writing: [], listening: [], reading: [], translation: [] }, id: paperId, paperId, title: "Old", ownerId: user.id, ownerNamespace: `user:${user.id}`, visibility: "private", authenticity: "user_import", importedAt: new Date().toISOString(), rightsAcknowledgement: makeRightsAck() };
    await prisma.privatePaper.create({ data: { userId: user.id, paperId, title: "Old", content } });
    assert.equal((await getPrivatePaper(user.id, paperId)).paperId, paperId);
    await updatePrivatePaper(user.id, paperId, { title: "Legacy updated" });
    const updated = await getPrivatePaper(user.id, paperId);
    assert.equal(updated.paperId, paperId); assert.equal(updated.content.ownerNamespace, content.ownerNamespace); assert.ok(Array.isArray(updated.content.sections));
    await assert.rejects(createPrivatePaper(user.id, { localPaperId: "old", title: "Dup", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() }), (e: PrivatePaperStoreError) => e.code === "DUPLICATE_ID");
    await deletePrivatePaper(user.id, paperId);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("1B.1 storage failures remain INTERNAL_ERROR for every operation", async () => {
  for (const [method, operation] of [
    ["findFirst", () => createPrivatePaper("owner", { localPaperId: "x", title: "X", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() })],
    ["findUnique", () => getPrivatePaper("owner", "private:owner:x")],
    ["findMany", () => listPrivatePapers("owner")],
    ["findUnique", () => updatePrivatePaper("owner", "private:owner:x", { title: "X" })],
  ] as const) {
    const original = prisma.privatePaper[method];
    Object.assign(prisma.privatePaper, { [method]: async () => { throw Error("DB disconnected"); } });
    try { await assert.rejects(operation(), (e: PrivatePaperStoreError) => e.code === "INTERNAL_ERROR"); }
    finally { Object.assign(prisma.privatePaper, { [method]: original }); }
  }
  const transaction = prisma.$transaction;
  Object.assign(prisma, { $transaction: async () => { throw Error("DB disconnected"); } });
  try { await assert.rejects(deletePrivatePaper("owner", "private:owner:x"), (e: PrivatePaperStoreError) => e.code === "INTERNAL_ERROR"); }
  finally { Object.assign(prisma, { $transaction: transaction }); }

});
test("1B.1 Prisma duplicate and concurrent missing-row codes are normalized", async () => {
  const { Prisma } = await import("@prisma/client");
  const user = await createTestUser("db-code");
  try {
    const input = { localPaperId: "x", title: "X", content: makeValidContent(), rightsAcknowledgement: makeRightsAck() };
    const originalCreate = prisma.privatePaper.create;
    Object.assign(prisma.privatePaper, { create: async () => { throw new Prisma.PrismaClientKnownRequestError("not an English unique message", { code: "P2002", clientVersion: "6.19.3" }); } });
    try { await assert.rejects(createPrivatePaper(user.id, input), (e: PrivatePaperStoreError) => e.code === "DUPLICATE_ID"); } finally { Object.assign(prisma.privatePaper, { create: originalCreate }); }
    const paper = await createPrivatePaper(user.id, input);
    const originalUpdate = prisma.privatePaper.update;
    Object.assign(prisma.privatePaper, { update: async () => { throw new Prisma.PrismaClientKnownRequestError("concurrent deletion", { code: "P2025", clientVersion: "6.19.3" }); } });
    try { await assert.rejects(updatePrivatePaper(user.id, paper.paperId, { title: "Y" }), (e: PrivatePaperStoreError) => e.code === "NOT_FOUND"); } finally { Object.assign(prisma.privatePaper, { update: originalUpdate }); }
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
