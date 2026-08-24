import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const sidebar = readFileSync(join(import.meta.dirname, "..", "sidebars", "maestro.swift"), "utf8")

test("sidebar renders one settings gear in a top toolbar", () => {
  assert.match(sidebar, /VStack\(alignment: \.leading, spacing: 0\)/)
  assert.match(sidebar, /HStack \{\s+Text\("Maestro"\)/)
  assert.match(
    sidebar,
    /Text\("Maestro"\)\s+\.font\(\.system\(size: 18, design: \.monospaced\)\)\.bold\(\)/,
  )
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

test("sidebar uses a stateful workspace stage icon", () => {
  assert.match(sidebar, /if let d = w\.description \{\s+if anyRunning\(d\) \{\s+ZStack \{/)
  assert.match(
    sidebar,
    /RoundedRectangle\(cornerRadius: 3\)\.fill\(w\.selected \? \.accentColor : \.green\)/,
  )
  assert.match(
    sidebar,
    /Circle\(\)\.fill\(\.green\)\.frame\(width: 6, height: 6\)\s+\.shadow\(color: "#30D158", radius: 3, x: 0, y: 0\)/,
  )
  assert.match(
    sidebar,
    /Image\(systemName: "rectangle\.stack\.fill"\)\s+\.imageScale\(\.small\)\s+\.foregroundColor\(w\.selected \? \.accentColor : \.secondary\)/,
  )
  assert.doesNotMatch(sidebar, /Image\(systemName: "folder\.fill"\)/)
})

test("sidebar derives and renders explicit subagent tree connectors", () => {
  assert.match(sidebar, /func depthOf\(_ row: String\) -> Int/)
  assert.match(
    sidebar,
    /func hasSiblingAfter\(_ rows: \[String\], _ i: Int, _ depth: Int\) -> Bool/,
  )
  assert.match(sidebar, /for j in \(i \+ 1\)\.\.<rows\.count/)
  assert.match(sidebar, /func treeContinueSlot\(\) -> some View/)
  assert.match(sidebar, /func treeBranchSlot\(_ hasNext: Bool\) -> some View/)
  assert.match(
    sidebar,
    /let rows = liveRowsFor\(d, t\.id\)\s+let visibleRows = Array\(rows\.prefix\(10\)\.enumerated\(\)\)\s+ForEach\(visibleRows, id: \\.offset\)/,
  )
  assert.match(sidebar, /let rowKeepsGoing = hasSiblingAfter\(rows, i, depth\)/)
  assert.match(sidebar, /if keep0 \{ treeContinueSlot\(\) \} else \{ treeBlankSlot\(\) \}/)
  assert.match(sidebar, /treeBranchSlot\(rowKeepsGoing\)/)
})

test("sidebar uses dots for subagent row status while preserving behavior", () => {
  assert.match(sidebar, /func runningDot\(\) -> some View/)
  assert.match(
    sidebar,
    /Circle\(\)\.fill\(\.green\)\.frame\(width: 6, height: 6\)\s+\.shadow\(color: "#30D158", radius: 4, x: 0, y: 0\)/,
  )
  assert.match(sidebar, /func stoppedDot\(\) -> some View/)
  assert.match(
    sidebar,
    /if status == "v" \{[\s\S]*stoppedDot\(\)[\s\S]*\.help\("Click to dismiss"\)[\s\S]*description: without\(d, row\)/,
  )
  assert.match(
    sidebar,
    /if status == ">" \{\s+runningDot\(\)\s+\} else \{\s+Image\(systemName: "xmark"\)/,
  )
  assert.match(
    sidebar,
    /\.help\(title\)[\s\S]*cmux\("workspace\.select", workspace_id: w\.id\)[\s\S]*cmux\("surface\.focus", surface_id: t\.id\)/,
  )
  assert.match(
    sidebar,
    /if rows\.count > 10 \{[\s\S]*treeContinueSlot\(\)[\s\S]*treeBranchSlot\(false\)/,
  )
  assert.ok(sidebar.includes('Text("+ \\(rows.count - 10) more")'))
  assert.doesNotMatch(sidebar, /\.scaleEffect\(0\.42\)/)
})

// A working mascot's eyes GLOW rather than blink.
//
// The blink recomputed once per tick, and `clock.epoch` is in seconds, so it
// rendered as a stutter rather than as life. A steady green glow carries the
// same signal at zero animation cost and reuses the running-subagent colour,
// so one colour means one thing across the whole sidebar. Idle stays unlit.
test("working mascot eyes glow green instead of blinking", () => {
  assert.match(sidebar, /func eyesOpen\(_ d: String\) -> Bool \{\s+return working\(d\)\s+\}/)
  assert.doesNotMatch(sidebar, /eyesOpen\(d, clock\.epoch\)/)

  const open = sidebar.match(/Capsule\(\)\.fill\(\.green\)\.frame\(width: 2, height: 4\)/g)
  assert.equal(open?.length, 4, "both mascot variants light both eyes")

  const shut = sidebar.match(/Capsule\(\)\.fill\(\.secondary\)\.frame\(width: 2, height: 1\)/g)
  assert.equal(shut?.length, 4, "both mascot variants keep a dim grey shut eye")

  const glowingEyes = sidebar.match(
    /Capsule\(\)\.fill\(\.green\)\.frame\(width: 2, height: 4\)\.offset\(x: -?\d+\)\s+\.shadow\(color: "#30D158", radius: 3, x: 0, y: 0\)/g,
  )
  assert.equal(glowingEyes?.length, 4, "each open eye carries the running-green glow")
})

// A Session and its subagents are ONE selectable unit.
//
// They used to be siblings, so the selection background and accent stripe
// stopped at the tab row and the subagent rows below read as unrelated,
// unselected work. The styling now wraps both, matching actual ownership.
test("selection styling wraps the Session and its subagent tree together", () => {
  const wrapped = sidebar.match(
    /\.background \{\s+if t\.focused && w\.selected \{\s+Rectangle\(\)\.fill\(\.secondary\)\.opacity\(0\.07\)/g,
  )
  assert.equal(wrapped?.length, 1, "exactly one selection background for the whole unit")

  // The tap target stays on the tab row itself, not the wrapper, so tapping a
  // subagent row keeps its own behaviour (dismiss, or focus the owning surface).
  assert.match(
    sidebar,
    /\.padding\(4\)\s+\.onTapGesture \{\s+cmux\("workspace\.select", workspace_id: w\.id\)\s+cmux\("surface\.focus", surface_id: t\.id\)/,
  )
})

// ---------------------------------------------------------------------------
// Wire format v2: the sidebar half of the contract
//
// The interpreter fails SILENTLY, so a mismatch between what the plugin encodes
// and what the sidebar parses renders a blank or wrong row while
// `cmux sidebar validate` still reports OK. These tests hold the two halves
// together at the only place a test can reach: the source of both.
// ---------------------------------------------------------------------------

test("a subagent row's name is read from field 4, and an owner/attention name from field 2", () => {
  // encodeTree publishes `<depth> <glyph> <model> <activity> <name>`; owner and
  // attention rows keep three fields. Two helpers, deliberately not merged.
  assert.match(sidebar, /func agentNameOf\(_ row: String\) -> String \{[\s\S]*?dropFirst\(4\)/)
  assert.match(sidebar, /func nameOf\(_ row: String\) -> String \{[\s\S]*?dropFirst\(2\)/)
  assert.match(sidebar, /let title = agentNameOf\(row\)/)
  // The attention label is NOT a subagent row and must keep the 3-field reader.
  assert.match(sidebar, /func attnLabel\([\s\S]*?nameOf\(hits\[0\]\)/)
})

test("model and activity are read from their fixed positions, with the absent sentinel", () => {
  assert.match(
    sidebar,
    /func modelOf\(_ row: String\) -> String \{\s+let m = part\(row, 2\)\s+return m == "-" \? "" : m/,
  )
  assert.match(
    sidebar,
    /func activityOf\(_ row: String\) -> String \{\s+let a = part\(row, 3\)\s+return a == "-" \? "" : a/,
  )
})

test("an absent model or activity renders nothing rather than an empty gap", () => {
  assert.match(sidebar, /if doing != "" \{\s+Text\(doing\)/)
  const modelBadges = sidebar.match(/if model != "" \{\s+Text\(model\)/g)
  assert.equal(modelBadges?.length, 2, "a badge on the running row and on the finished row")
})

test("a tab claims only the block its own surface published", () => {
  // Comparing against the FIRST owner row left every co-resident Session
  // rendering as a plain terminal, and showed another Session's subagents
  // under this one's tab (#54).
  assert.match(sidebar, /func ownsSurface\(_ d: String, _ id: String\) -> Bool/)
  assert.doesNotMatch(sidebar, /ownerOf\(d\) == t\.id/)
  assert.equal(sidebar.match(/if ownsSurface\(d, t\.id\)/g)?.length, 2)
  assert.match(sidebar, /func liveRowsFor\(_ d: String, _ id: String\) -> \[String\]/)
  assert.match(sidebar, /func blockEnd\(_ rows: \[String\], _ from: Int\) -> Int/)
  // Measured: a function call inside a ternary renders NOTHING, silently. Each
  // call gets its own `let`, so the block bound survives future edits.
  assert.match(
    sidebar,
    /let start = ownerIndex\(rows, id\) \+ 1\s+let end = blockEnd\(rows, start\)/,
  )
})
