import test from "node:test";
import assert from "node:assert/strict";
import { getPhotoPath, createPhotoUrlResolver } from "../src/profilePhotos.js";

function fixture() {
  const calls = [];
  let time = 0;
  let failure = false;
  const client = { storage: { from(bucket) {
    assert.equal(bucket, "profile-photos");
    return { async createSignedUrl(path, ttl) {
      calls.push({ path, ttl });
      return failure ? { error: new Error("unavailable") } : {
        data: { signedUrl: `https://example.test/${path}?version=${calls.length}` },
      };
    } };
  } } };
  return { resolve: createPhotoUrlResolver(client, () => time), calls,
    advance: (ms) => { time += ms; }, fail: (value) => { failure = value; } };
}

test("legacy public and expired signed URLs resolve to the original object path", () => {
  for (const type of ["public", "sign", "authenticated"]) {
    assert.equal(getPhotoPath(`https://project.test/storage/v1/object/${type}/profile-photos/user/my%20photo.jpg?token=expired`), "user/my photo.jpg");
  }
  assert.equal(getPhotoPath("user/profile"), "user/profile");
  assert.equal(getPhotoPath("https://external.test/photo.png"), "https://external.test/photo.png");
  assert.equal(getPhotoPath("https://project.test/profile-photos/%broken"), "");
  assert.equal(getPhotoPath(null), "");
});

test("cached URLs are renewed before the one-hour token expires", async () => {
  const f = fixture();
  const first = await f.resolve("user/profile");
  f.advance(44 * 60 * 1000);
  assert.equal(await f.resolve("user/profile"), first);
  f.advance(60 * 1000);
  assert.notEqual(await f.resolve("user/profile"), first);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].ttl, 3600);
});

test("image errors can force renewal even with an unexpired cache entry", async () => {
  const f = fixture();
  const first = await f.resolve("user/profile");
  assert.notEqual(await f.resolve("user/profile", { force: true }), first);
});

test("concurrent thumbnails share a signing request and changed upload paths get new URLs", async () => {
  const f = fixture();
  const urls = await Promise.all([f.resolve("user/profile"), f.resolve("user/profile")]);
  assert.equal(urls[0], urls[1]);
  assert.equal(f.calls.length, 1);
  assert.notEqual(await f.resolve("user/profile-new"), urls[0]);
});

test("signing failure does not reuse an expired URL and can recover", async () => {
  const f = fixture();
  f.fail(true);
  assert.equal(await f.resolve("https://project.test/storage/v1/object/sign/profile-photos/user/profile?token=expired"), "");
  f.fail(false);
  assert.ok(await f.resolve("user/profile"));
});
