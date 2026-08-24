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
    /\}\s+\.padding\(\.horizontal, 4\)[\s\S]*?Divider\(\)\s+\.offset\(y: -6\)\s+VStack/,
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
  // An attention row is `! <kind> <detail> <label>` - four leading fields, so
  // its label has its own reader and must NOT use either of the other two.
  assert.match(sidebar, /func attnLabel\([\s\S]*?dropFirst\(3\)/)
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
  // Three call sites: the icon branch, the tree branch, and the ports branch,
  // which shows ports only where they are NOT a Copilot runtime's own.
  assert.equal(sidebar.match(/if ownsSurface\(d, t\.id\)/g)?.length, 3)
  assert.match(sidebar, /func liveRowsFor\(_ d: String, _ id: String\) -> \[String\]/)
  assert.match(sidebar, /func blockEnd\(_ rows: \[String\], _ from: Int\) -> Int/)
  // Measured: a function call inside a ternary renders NOTHING, silently. Each
  // call gets its own `let`, so the block bound survives future edits.
  assert.match(
    sidebar,
    /let start = ownerIndex\(rows, id\) \+ 1\s+let end = blockEnd\(rows, start\)/,
  )
})

test("the workspace row keeps a small UNIFORM padding, never an edge-specific one", () => {
  // Measured: on these nested containers an edge-specific padding ADDS inset
  // rather than restricting it. `.padding(4)` put the workspace icon at x=35,
  // `.padding(.vertical, 4)` at x=61, and `.padding(.top, 4).padding(.bottom, 4)`
  // at x=93. Only turning the uniform value down reclaims width.
  assert.match(sidebar, /\.padding\(2\)\s+\.onTapGesture \{ cmux\("workspace\.select"/)
  // Comments name the forbidden constructs on purpose, so check code only.
  const code = sidebar
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
  assert.doesNotMatch(code, /\.padding\(\.vertical,/)
  assert.doesNotMatch(code, /\.padding\(\.top,/)
})

test("the permission badge shows WHY approval is being asked", () => {
  // The runtime publishes a closed vocabulary in field 2 of the attention row.
  assert.match(sidebar, /func attnDetail\(_ d: String\) -> String/)
  assert.match(sidebar, /func permGlyph\(_ k: String\) -> String/)
  for (const kind of ["shell", "write", "read", "url", "mcp", "factory"]) {
    assert.match(sidebar, new RegExp(`if k == "${kind}"`), `${kind} has no glyph`)
  }
  // An unknown kind keeps the generic raised hand rather than rendering nothing.
  assert.match(sidebar, /return "hand\.raised\.fill"/)
  // Two lets, never Image(systemName: permGlyph(attnDetail(d))): a nested call
  // as a modifier argument is skipped in silence by this interpreter.
  assert.match(sidebar, /let pk = attnDetail\(d\)\s+let pg = permGlyph\(pk\)/)
  assert.match(sidebar, /Image\(systemName: pg\)/)
  const code = sidebar
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
  assert.doesNotMatch(code, /permGlyph\(attnDetail\(/)
})

test("no variable-length Text is made incompressible", () => {
  // `.fixedSize()` overrides truncation, so one long value - a git branch, a
  // model - makes its row refuse to shrink, and the list then sizes to that row
  // and scrolls horizontally, shifting EVERY row off its left edge. Observed
  // live on branch `users/dylanmccurry/review-console-ad-dau`. Only genuinely
  // fixed-width content may carry it.
  const code = sidebar
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
  for (const variable of [
    "Text(b)",
    "Text(tb)",
    "Text(baseName(dir))",
    "Text(dir)",
    "Text(title)",
    "Text(doing)",
    "Text(model)",
  ]) {
    const at = code.findIndex((line) => line.trim() === variable)
    assert.notEqual(at, -1, `${variable} not found`)
    // Only the modifier chain, which is the run of lines beginning with a dot.
    // Stopping there matters: the NEXT sibling view legitimately carries
    // `.fixedSize()` because its width really is fixed.
    const chain: string[] = []
    for (let i = at + 1; i < code.length; i++) {
      const line = code[i]?.trim() ?? ""
      if (!line.startsWith(".")) break
      chain.push(line)
    }
    assert.equal(
      chain.join("\n").includes(".fixedSize()"),
      false,
      `${variable} must stay compressible`,
    )
  }
})

test("the sidebar renders the plugin-health badge on the Session row", () => {
  // Verified live: `cmux sidebar validate` reported OK on a sidebar that
  // rendered nothing at all, so the shape is asserted here and the badge was
  // separately confirmed present in the rendered accessibility tree while a
  // deliberately broken parser was installed.
  assert.match(sidebar, /func stalledFor\(_ d: String, _ id: String\) -> String/)
  assert.match(
    sidebar,
    /let stalled = stalledFor\(d, t\.id\)\s+if stalled != "" \{/,
    "each call gets its own let: a let-bound ternary containing a call renders nothing",
  )
  assert.match(sidebar, /Image\(systemName: "exclamationmark\.triangle\.fill"\)/)
  assert.match(sidebar, /\.help\("Maestro is not receiving hooks[^"]*"\)/)
})

test("the owner row is still read positionally", () => {
  // The health field is appended AFTER the surface id. That is only safe while
  // every reader takes field 2 by index rather than taking the rest of the row.
  assert.match(sidebar, /part\(\$0, 0\) == "@" && part\(\$0, 2\) == id/)
})

// --- context menus (#61, #43) ------------------------------------------------
//
// Every verb below was checked against the live cmux socket before it was
// written into the sidebar. That matters more than usual here: `cmux rpc`
// reports an unknown verb as `invalid_params`, but a sidebar tap is
// fire-and-forget, so a wrong action name looks exactly like a working one.

test("the workspace row menu uses only verified workspace actions", () => {
  const verbs = [
    "move_top",
    "move_up",
    "move_down",
    "mark_read",
    "mark_unread",
    "clear_name",
    "close_others",
    "close_above",
    "close_below",
  ]
  for (const verb of verbs) {
    assert.ok(
      sidebar.includes(`action: "${verb}"`),
      `workspace menu should offer ${verb}, which cmux docs api documents and the socket accepted`,
    )
  }
})

test("the Session row menu is scoped to its surface", () => {
  // `tab.action` takes `surface_id`. Sending `workspace_id` would act on the
  // wrong thing or nothing at all, with no error visible in the UI.
  assert.match(sidebar, /cmux\("tab\.action", action: "mark_unread", surface_id: t\.id\)/)
  assert.match(sidebar, /cmux\("tab\.action", action: "close_others", surface_id: t\.id\)/)
  assert.match(sidebar, /cmux\("surface\.close", surface_id: t\.id\)/)
})

test("browser-only tab actions are hidden on a terminal surface", () => {
  // Measured: `reload` and `duplicate` return `invalid_state: only available
  // for browser tabs`. A sidebar cannot show that error, so on a Copilot
  // Session they would be silent no-ops. #61 requires hidden, not inert.
  assert.match(
    sidebar,
    /if t\.directory == nil \{\s+Button\("Reload"\)[\s\S]*?Button\("Duplicate"\)/,
    "reload and duplicate must be gated on the surface having no directory",
  )
})

test("remote actions are hidden on a local workspace", () => {
  // Measured: `workspace.remote.reconnect` on a local workspace returns
  // `invalid_state: Remote workspace is not configured`.
  assert.match(
    sidebar,
    /if let rem = w\.remote \{[\s\S]*?workspace\.remote\.(disconnect|reconnect)/,
    "remote verbs must be gated on the documented optional `remote` binding",
  )
})

test("dismissal is offered only where the plugin will honour it", () => {
  // encodeTree republishes running and failed rows within seconds, so a
  // Dismiss item on those would appear to work and then undo itself.
  assert.match(sidebar, /func withoutFinished\(_ d: String, _ id: String\) -> String/)
  assert.match(sidebar, /func hasFinished\(_ d: String, _ id: String\) -> Bool/)
  assert.match(sidebar, /if hasFinished\(d, t\.id\) \{/)
})

test("no Menu is nested inside a contextMenu", () => {
  // Measured by bisection against the rendered accessibility tree: a
  // `Menu(...)` inside a `.contextMenu` makes the ENTIRE context menu fail to
  // open - right-clicking produced no AXMenu at all, while `cmux sidebar
  // validate` reported OK. Removing it and changing nothing else restored all
  // 16 items. The authoring guide lists both constructs as supported
  // individually. See G-31.
  const menus = sidebar.split(".contextMenu {")
  for (const block of menus.slice(1)) {
    const body = block.slice(0, block.indexOf("\n                        }"))
    assert.ok(!/\bMenu\(/.test(body), "a nested Menu silently kills the whole context menu")
  }
})

test("the sidebar uses no construct the interpreter evaluates to nothing", () => {
  // Both measured against the rendered accessibility tree with a throwaway
  // probe sidebar, because `cmux sidebar validate` cannot catch either - it
  // reported OK for `t.definitelyNotARealBinding`. See G-33.
  //
  // `var` mutation: a helper accumulating with `var out = ""` in a loop
  // returned "" for every input while a ForEach over the same array rendered
  // every element. `.reduce` is unaffected and is used by `nameOf`.
  //
  // Comments are stripped first - the header documents the failing construct
  // by quoting it, and a guard that trips on its own documentation is useless.
  const code = sidebar
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")
  assert.ok(!/\bvar\s+\w+\s*=/.test(code), "var mutation silently produces nothing")
  // `portCount` looks like a binding and is not: it rendered empty.
  assert.ok(!/\.portCount\b/.test(code), "portCount is not a binding - use ports.count")
})

test("ports are shown on plain shell rows only", () => {
  // Measured before shipping, and the measurement narrowed the feature: on a
  // COPILOT row `t.ports` is the agent runtime's own ephemeral listeners -
  // 60559, 58371, 54083, and NINE on one Session. Shown there it is noise
  // dressed as information. Verified on a real shell row by starting a server
  // on 8765 and reading `:8765` back out of the accessibility tree.
  assert.match(sidebar, /if ownsSurface\(d, t\.id\) == false \{/)
  // Bounded, like every other variable-length field on a row.
  assert.match(sidebar, /ForEach\(Array\(t\.ports\.prefix\(3\)\)\)/)
  assert.ok(!/ForEach\(t\.ports\)/.test(sidebar), "an unbounded port list can widen the row")
})

test("the sidebar claims no action cmux does not expose", () => {
  // There is no clipboard method anywhere in the socket API, and no socket
  // method reloads a running sidebar. #43 proposed both; neither is offerable.
  assert.ok(
    !/cmux\("[a-z.]*clipboard/.test(sidebar),
    "cmux exposes no clipboard method, so no menu item may claim to copy",
  )
  assert.ok(
    !/cmux\("sidebar\.reload/.test(sidebar),
    "no socket method reloads a running sidebar; `cmux sidebar reload` is CLI-only",
  )
  assert.ok(
    !/Button\("Rename/.test(sidebar),
    "rename needs a title parameter and the sidebar has no text input; only clear_name is offerable",
  )
})

// --- what the Session itself is ----------------------------------------------

test("the Session row renders its own model and worktree", () => {
  // Subagent rows have carried a model since wire v2, which left the one agent
  // the operator is actually talking to as the only one whose model was
  // invisible. Both confirmed in the rendered accessibility tree.
  assert.match(sidebar, /func worktreeOf\(_ d: String, _ id: String\) -> String/)
  assert.match(sidebar, /func sessionModelOf\(_ d: String, _ id: String\) -> String/)
  assert.match(sidebar, /let wt = worktreeOf\(d, t\.id\)\s+if wt != "" \{/)
  assert.match(sidebar, /let sm = sessionModelOf\(d, t\.id\)\s+if sm != "" \{/)
})

test("owner row fields are read positionally and treat the sentinel as absent", () => {
  // Fields 3, 4 and 5 are positional; an absent one is the `-` sentinel rather
  // than an empty field, because the sidebar recovers fields by splitting on
  // spaces and a run of them collapses.
  for (const field of [3, 4, 5]) {
    assert.match(
      sidebar,
      new RegExp(`let raw = part\\(hits\\[0\\], ${field}\\)\\s+return raw == "-" \\? "" : raw`),
      `owner row field ${field} must read the sentinel as absent`,
    )
  }
})

test("variable-length Session metadata is never fixed-size", () => {
  // A `.fixedSize()` Text makes its whole row incompressible; one long value
  // then widens the pane and shifts every row off its left edge. Measured.
  const worktreeBlock = sidebar.slice(sidebar.indexOf("let wt = worktreeOf"))
  const body = worktreeBlock.slice(0, worktreeBlock.indexOf("if let dir = t.directory"))
  const textRuns = body.split("Text(").slice(1)
  for (const run of textRuns) {
    const modifiers = run.slice(0, run.indexOf(".help("))
    assert.ok(!modifiers.includes(".fixedSize()"), "a variable-length Text must stay compressible")
  }
})

// --- skill rows (#59) --------------------------------------------------------

test("skill rows render by trigger, in three distinct colours", () => {
  // All three confirmed in the rendered accessibility tree: "Skill - you
  // invoked it", "Skill - the agent chose it", and a bare "Skill" for an event
  // that recorded no trigger.
  assert.match(sidebar, /func isSkill\(_ g: String\) -> Bool/)
  assert.match(sidebar, /func skillColor\(_ g: String\) -> String/)
  assert.match(sidebar, /if isSkill\(status\) \{/)
  const colours = sidebar.slice(sidebar.indexOf("func skillColor"))
  const body = colours.slice(0, colours.indexOf("func skillHelp"))
  const hexes = body.match(/#[0-9A-Fa-f]{6}/g) ?? []
  assert.equal(new Set(hexes).size, 3, "user, agent and unknown must be visually distinct")
})

test("a skill row is neither counted as running nor dismissible", () => {
  // Skills take over the status glyph rather than adding a field, which is only
  // safe because every existing reader matches an EXACT glyph.
  assert.match(sidebar, /func countOf\(_ d: String, _ g: String\) -> Int/)
  assert.match(sidebar, /part\(\$0, 1\) == g/)
  assert.ok(
    !/isSkill\(status\)[\s\S]{0,600}Click to dismiss/.test(sidebar),
    "the dismissal tap belongs to the finished branch, not the skill branch",
  )
})
