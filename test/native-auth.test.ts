import assert from "node:assert/strict"
import { test } from "node:test"
import { generateKeyPair, SignJWT } from "jose"
import { verifyNativeIdentity, nativeRoute, NATIVE_ISSUER, NATIVE_AUDIENCE, NATIVE_CLIENT_ID } from "../src/lib/native-auth.ts"
const { privateKey, publicKey } = await generateKeyPair("RS256")
const key = async () => publicKey
const identity = (sub = "user-1", verified = true) => (async () => Response.json({ sub, email: "member@example.test", email_verified: verified, name: "Member", roles: ["Repair Member"] })) as typeof fetch
const sign = (claims: Record<string, unknown> = {}, issuer = NATIVE_ISSUER, audience = NATIVE_AUDIENCE, expiration = "1h") =>
  new SignJWT({ sub: "user-1", client_id: NATIVE_CLIENT_ID, ...claims }).setProtectedHeader({ alg: "RS256" }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiration).sign(privateKey)
test("accepts matching resource and UserInfo identity", async () => {
  assert.deepEqual((await verifyNativeIdentity(await sign(), "opaque", key, identity())).roles, ["Repair Member"])
})
test("rejects forged token", async () => {
  const other = await generateKeyPair("RS256")
  const token = await new SignJWT({ sub: "user-1", client_id: NATIVE_CLIENT_ID }).setProtectedHeader({ alg: "RS256" }).setIssuer(NATIVE_ISSUER).setAudience(NATIVE_AUDIENCE).setIssuedAt().setExpirationTime("1h").sign(other.privateKey)
  await assert.rejects(verifyNativeIdentity(token,"opaque",key,identity()))
})
test("rejects wrong audience, issuer, client and expired token", async () => {
  for (const token of [await sign({},NATIVE_ISSUER,"other"),await sign({},"https://attacker.test"),await sign({client_id:"other"}),await sign({},NATIVE_ISSUER,NATIVE_AUDIENCE,"-1h")]) {
    await assert.rejects(verifyNativeIdentity(token,"opaque",key,identity()))
  }
})
test("rejects mismatched subjects and unverified email", async () => {
  await assert.rejects(verifyNativeIdentity(await sign(),"opaque",key,identity("other")))
  await assert.rejects(verifyNativeIdentity(await sign(),"opaque",key,identity("user-1",false)))
})
test("native routing only exposes approved routes and methods", () => {
  assert.ok(nativeRoute("/media/members/id/background-123.thumb.webp","GET"))
  assert.ok(nativeRoute("/api/me/media","PUT"))
  for (const path of ["/login","/api/unknown","/e/new/edit","/media/events/a.mp4","/media/members/../secret.png","/media/members/%2e%2e/secret.png"]) assert.equal(nativeRoute(path,"GET"),false)
  assert.equal(nativeRoute("/members","POST"),false)
})

// Upstream outages must not be reported as bad user credentials.
test("distinguishes identity service failure from rejected credentials", async () => {
  const { NativeAuthUnavailable } = await import("../src/lib/native-auth.ts")
  await assert.rejects(verifyNativeIdentity(await sign(), "opaque", key, (async () => new Response(null, { status: 503 })) as typeof fetch), NativeAuthUnavailable)
  await assert.rejects(verifyNativeIdentity(await sign(), "opaque", key, (async () => new Response(null, { status: 302 })) as typeof fetch), NativeAuthUnavailable)
  await assert.rejects(verifyNativeIdentity(await sign(), "opaque", key, (async () => new Response(null, { status: 401 })) as typeof fetch), /Invalid identity token/)
})
