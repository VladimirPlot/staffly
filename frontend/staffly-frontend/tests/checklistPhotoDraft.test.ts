import assert from "node:assert/strict";
import test from "node:test";
import { restorePendingExamplePhotos } from "../src/features/checklists/utils/checklistPhotoDraft.ts";

test("failed photo batch retains pending files and binds newly created server item IDs", () => {
  const file = new File(["photo"], "example.png", { type: "image/png" });
  const recovered = restorePendingExamplePhotos(
    [
      { id: 40, text: "Uploaded", completionPhotoRequired: false, examplePhotoUrl: "saved" },
      { id: 41, text: "New item", completionPhotoRequired: true },
    ],
    [{ index: 1, file }],
    new Set(),
  );
  assert.equal(recovered?.[0].exampleFile, undefined);
  assert.equal(recovered?.[0].examplePhotoUrl, "saved");
  assert.equal(recovered?.[1].id, 41);
  assert.equal(recovered?.[1].exampleFile, file);
});
test("photo deletion failure preserves only deletions that still need retrying", () => {
  const recovered = restorePendingExamplePhotos(
    [
      { id: 40, text: "Deleted", completionPhotoRequired: false },
      { id: 41, text: "Pending", completionPhotoRequired: false },
    ],
    [],
    new Set([41]),
  );
  assert.equal(recovered?.[0].removeExamplePhoto, false);
  assert.equal(recovered?.[1].removeExamplePhoto, true);
});
