import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const sidebar = readFileSync(join(import.meta.dirname, "..", "sidebars", "maestro.swift"), "utf8")

test("sidebar renders one settings gear in a top toolbar", () => {
  assert.match(sidebar, /VStack\(alignment: \.leading, spacing: 0\)/)
  assert.match(sidebar, /HStack \{\s+Text\("Maestro"\)/)
  assert.match(sidebar, /Text\("Maestro"\)\s+\.font\(\.system\(size: 18\)\)\.bold\(\)/)
  assert.match(sidebar, /\.accessibilityLabel\("Settings"\)/)
  assert.match(sidebar, /\.onTapGesture \{\s+cmux\("settings\.open", target: "customSidebars"\)/)
  assert.match(
    sidebar,
    /\}\s+\.padding\(\.horizontal, 4\)\s+Divider\(\)\s+\.offset\(y: -6\)\s+VStack/,
  )
  assert.doesNotMatch(sidebar, /\bScrollView\b/)
  assert.match(sidebar, /\.padding\(\.bottom, 40\)\s+\.offset\(y: -16\)/)
  assert.match(sidebar, /Image\(systemName: "gearshape"\)/)
  assert.equal(sidebar.match(/Image\(systemName: "gearshape"\)/g)?.length, 1)
})
