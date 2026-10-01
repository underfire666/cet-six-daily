import test from "node:test";
import assert from "node:assert/strict";
import { loginReturnPath } from "../src/lib/auth/callback-url";
test("login resumes private page including encoded literal percent IDs", () => { const path="/me/private-papers/private%3Aowner%3Apaper%2525%25"; assert.equal(loginReturnPath(path), path); assert.equal(loginReturnPath("/me/private-papers/import"), "/me/private-papers/import"); });
test("login return path rejects external and malformed destinations", () => { for (const value of [null,"","https://evil.invalid","//evil.invalid","/\\evil.invalid","/\nevil.invalid","javascript:alert(1)"]) assert.equal(loginReturnPath(value),"/me"); });
