import assert from "node:assert/strict";
import test from "node:test";
import {
  constrainPhoto,
  zoomPhoto,
  photoPinch,
  PHOTO_INITIAL_TRANSFORM,
} from "../src/features/training/utils/knowledgePhotoZoom.ts";

const viewport = { width: 400, height: 300 };
const image = { width: 1200, height: 900 };

test("zoom follows the cursor rather than jumping to the centre", () => {
  const anchor = { x: 60, y: -30 };
  assert.deepEqual(zoomPhoto(PHOTO_INITIAL_TRANSFORM, 2, anchor, anchor, viewport, image), { scale: 2, x: -60, y: 30 });
});

test("a moving two-finger pinch preserves the image point under its midpoint", () => {
  const before = photoPinch([
    { x: -50, y: 0 },
    { x: 50, y: 0 },
  ]);
  const after = photoPinch([
    { x: -75, y: 30 },
    { x: 125, y: 30 },
  ]);
  const next = zoomPhoto(
    PHOTO_INITIAL_TRANSFORM,
    after.distance / before.distance,
    before.centre,
    after.centre,
    viewport,
    image,
  );
  assert.deepEqual(next, { scale: 2, x: 25, y: 30 });
});

test("bounds prevent panning past the photo and shrinking below the fitted view", () => {
  assert.deepEqual(constrainPhoto({ scale: 2, x: 10000, y: -10000 }, viewport, image), { scale: 2, x: 200, y: -150 });
  assert.deepEqual(constrainPhoto({ scale: 0.2, x: 50, y: -20 }, viewport, image), PHOTO_INITIAL_TRANSFORM);
  assert.equal(constrainPhoto({ scale: 20, x: 0, y: 0 }, viewport, image).scale, 4);
});

test("letterboxed portrait and landscape photos stay centred along the short axis", () => {
  assert.deepEqual(constrainPhoto({ scale: 2, x: 100, y: 100 }, viewport, { width: 300, height: 1200 }), {
    scale: 2,
    x: 0,
    y: 100,
  });
  assert.deepEqual(constrainPhoto({ scale: 2, x: 100, y: 100 }, viewport, { width: 1600, height: 300 }), {
    scale: 2,
    x: 100,
    y: 0,
  });
});

test("zooming back to minimum clears pan offsets and later resizing clamps them", () => {
  assert.deepEqual(
    zoomPhoto({ scale: 3, x: 200, y: -150 }, 0.5, { x: 100, y: 50 }, { x: 100, y: 50 }, viewport, image),
    PHOTO_INITIAL_TRANSFORM,
  );
  const resized = constrainPhoto({ scale: 2, x: 200, y: -150 }, { width: 800, height: 300 }, image);
  assert.deepEqual(resized, { scale: 2, x: 0, y: -150 });
});
