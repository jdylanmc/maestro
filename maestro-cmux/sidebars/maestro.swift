// Maestro - what your agents are actually doing.
//
// The subagent tree arrives through the workspace description as ONE line,
// rows separated by a literal delimiter. A SUBAGENT row is five
// space-separated parts:
//
//     0 > gpt-5.6-luna bash folk-lyricist¦1 v - - research-scan
//     ^ ^ ^            ^    ^
//     | | |            |    name (greedy: everything after field 3)
//     | | |            current activity, or "-"
//     | | model, or "-"
//     | status: > running, v done, x failed
//     depth
//
// The two metadata fields sit BEFORE the name because the name is the only
// field allowed to contain spaces, so it has to be last and greedy. Both
// metadata fields are guaranteed space-free; "-" means unknown.
//
// OWNER rows ("@ o <surface-id>") and ATTENTION rows ("! <kind> <label>") keep
// the older three-field shape. `nameOf` reads those; `agentNameOf` reads a
// subagent row. Do not merge the two.
//
// NEVER REINTRODUCE NEWLINES. The description carries them faithfully - 23
// lines and 432 characters measured, stored intact - but this interpreter has
// no working way to split on one. `split(separator: "\n")` does not interpret
// the escape and returns the whole string as one element; the entire tree
// rendered as a single truncated row. `whereSeparator: { $0.isNewline }`
// renders nothing at all. Splitting on a literal, like " " or the row
// delimiter, works. qucooln/cmux-conductor-sidebar reaches the same
// conclusion: it never splits a multi-line string, keeping its state on one
// line and reading it with `hasPrefix` and `contains`.
//
// COLORS are semantic, never literal, so the pane follows the appearance and
// accent instead of assuming the theme is still Nord.
//
// SCOPE. A workspace may host MORE THAN ONE Session, and each publishes its own
// block into the same description. Two naming families keep that straight:
//
//   xxxFor(d, id)          reads ONE Session's block. Use on a SESSION row.
//   xxxInWorkspace(d)      reads every block. Correct ONLY on the WORKSPACE row.
//
// Getting this wrong is invisible until two Sessions share a workspace, and it
// has now happened twice: once to the tree (#54), and once to the mascot, where
// a finished Session's `! t Your turn` closed a co-resident Session's eyes while
// it was 58 seconds into a tool call. `cmux sidebar validate` cannot catch it
// and neither can a unit test, because this file is never executed by one.
// A test asserts the rule lexically instead - see sidebar-settings.test.ts.

// Other interpreter behaviours that fail SILENTLY - `cmux sidebar validate`
// reports OK on a sidebar that renders nothing:
//   - Optional fields are ABSENT, not null. Filtering the collection on
//     `description != nil` yields an empty sidebar; use `if let` in the loop.
//   - Arithmetic as a bare modifier ARGUMENT renders nothing
//     (`.padding(.leading, depth * 9)`). Arithmetic inside a function body or
//     a string interpolation is fine, and so are ternaries.
//   - `.frame(width: 0)` DOES NOT HIDE A VIEW. Six running subagents rendered
//     a red xmark that was supposed to be zero-width. Branch with if/else to
//     choose between views; never collapse one to zero width.
//   - A ternary containing a function CALL is UNRELIABLE. Measured: replacing
//     `let end = s < 0 ? 0 : blockEnd(rows, s)` with two plain `let`s, and
//     changing nothing else, took `liveRowsFor` from rendering NOTHING to
//     rendering every row. But `attnLabel` returns a ternary containing a call
//     and works, so the boundary is not fully characterised - only that a
//     `let`-bound one failed. Prefer plain bindings.
//   - A NESTED call as a modifier argument -
//     `Image(systemName: permGlyph(attnDetail(d)))` - is skipped. Bind each
//     call to its own `let` first.
//   - EDGE-SPECIFIC padding does not restrict padding, it ADDS inset.
//     Measured on the workspace row: `.padding(4)` put the row icon at x=35;
//     `.padding(.vertical, 4)` moved it to x=61, and
//     `.padding(.top, 4).padding(.bottom, 4)` to x=93. The only lever that
//     behaves is a smaller UNIFORM value, so horizontal space is reclaimed by
//     turning `.padding(4)` down rather than by naming an edge.
//     (`.padding(.horizontal, 4)` and `.padding(.bottom, 40)` at the outermost
//     level are unaffected - the misbehaviour is on these nested containers.)
//   - `var` MUTATION produces nothing. A helper accumulating with
//     `var out = ""` and `out = out + ...` in a loop returned "" for every
//     input, while `ForEach` over the same array rendered every element.
//     `.reduce` is fine and is used below; treat bindings as immutable.
//   - An UNKNOWN binding renders empty rather than failing, and validation
//     does not catch it: `cmux sidebar validate` reported OK for
//     `t.definitelyNotARealBinding`. `t.portCount` is one of these - it looks
//     like a binding and is not. Use `t.ports.count`. Probe a new binding by
//     rendering it, never by validating it.

func part(_ row: String, _ i: Int) -> String {
    let p = row.split(separator: " ").map { String($0) }
    return p.count > i ? p[i] : ""
}

/** The name on an OWNER or ATTENTION row - three leading fields, name last.
 *
 *  Kept as the shared shape for rows whose label starts at field 2. Subagent
 *  rows use `agentNameOf` and attention rows use `attnLabel`, both of which
 *  skip more leading fields. */
func nameOf(_ row: String) -> String {
    return row.split(separator: " ").map { String($0) }.dropFirst(2)
        .reduce("") { $0 == "" ? $1 : $0 + " " + $1 }
}

/** The name on a SUBAGENT row - five fields, name last and greedy.
 *
 *  See encodeTree in src/tree.ts: fields 2 and 3 are the model and the current
 *  activity, both space-free, both "-" when unknown. */
func agentNameOf(_ row: String) -> String {
    return row.split(separator: " ").map { String($0) }.dropFirst(4)
        .reduce("") { $0 == "" ? $1 : $0 + " " + $1 }
}

/** The model a subagent is running, or "" when the plugin did not publish one.
 *  Placeholder rows never carry one: the spawning tool call does not name a
 *  model, only the subagent.started event does. */
func modelOf(_ row: String) -> String {
    let m = part(row, 2)
    return m == "-" ? "" : m
}

/** The tool a subagent currently has open, or "" when it has none.
 *
 *  This is the tool NAME only. Its arguments are never published - see the
 *  privacy boundary in requirements.md. */
func activityOf(_ row: String) -> String {
    let a = part(row, 3)
    return a == "-" ? "" : a
}

/** A model name short enough to sit on a row without crowding the name.
 *  Vendor prefixes carry no information once the family is visible. */
func shortModel(_ m: String) -> String {
    let parts = m.split(separator: "/").map { String($0) }
    return parts.count > 0 ? parts[parts.count - 1] : m
}

func rowsOf(_ d: String) -> [String] {
    return d.split(separator: "¦").map { String($0) }
}

/** Subagent rows, running and recently finished alike.
 *
 *  A finished row is NOT dropped here any more. The plugin retires it after
 *  RETAIN_MS (15 seconds), so a completed subagent greys out and lingers
 *  instead of vanishing the instant it lands - which made short-lived work
 *  impossible to see at all.
 *
 *  Attention rows (depth token "!") are NOT subagents and are excluded; they
 *  are rendered on the workspace row instead. Without this they would draw as
 *  tree rows with a "p" glyph.
 *
 *  This is the WORKSPACE-wide set. A tab renders `liveRowsFor` instead, which
 *  is scoped to the Session that published the rows. */
func liveRows(_ d: String) -> [String] {
    return rowsOf(d).filter { part($0, 0) != "!" && part($0, 0) != "@" }
}

/** The surface id that owns this workspace's FIRST subagent block, or "" when
 *  the plugin did not publish one. Used only for a workspace-level "focus the
 *  agent" action, where any owning surface is a reasonable target. To ask
 *  whether a specific surface owns a block, use `ownsSurface`. */
func ownerOf(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" }
    return hits.count > 0 ? part(hits[0], 2) : ""
}

/** Whether `id` published a block in this description.
 *
 *  The description carries ONE block per publishing Session, each opened by its
 *  own owner row (see mergeOwnedRows in src/tree.ts). Comparing against only
 *  the first owner row - which is what this did until #54 was measured - left
 *  every Session after the first rendering as a plain terminal forever, because
 *  its own owner row was never the one examined. */
func ownsSurface(_ d: String, _ id: String) -> Bool {
    return rowsOf(d).filter { part($0, 0) == "@" && part($0, 2) == id }.count > 0
}

/** The issue #63 health signal: how many tool completions landed after the
 *  hook runtime last wrote state for `id`, as published in optional field 3 of
 *  the owner row. "" means healthy, or an older plugin that does not publish it.
 *
 *  Returned as a STRING rather than an Int on purpose. The view needs only
 *  presence, and `Int(...)` unwrapping is one more interpreter construct this
 *  sidebar would be trusting untested - the exact habit that produced a tree
 *  which rendered nothing while `cmux sidebar validate` reported OK. */
func stalledFor(_ d: String, _ id: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" && part($0, 2) == id }
    if hits.count == 0 {
        return ""
    }
    let raw = part(hits[0], 3)
    return raw == "-" ? "" : raw
}

/** The git worktree this Session is working out of - owner row field 4.
 *
 *  cmux publishes a `branch` binding already, so this would be redundant if
 *  every worktree were on a branch. Measured, they are not: three of four live
 *  worktrees of one repository were on a DETACHED HEAD, where the branch says
 *  nothing at all and the worktree name is the only thing identifying which
 *  piece of parallel work a Session is doing. */
func worktreeOf(_ d: String, _ id: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" && part($0, 2) == id }
    if hits.count == 0 {
        return ""
    }
    let raw = part(hits[0], 4)
    return raw == "-" ? "" : raw
}

/** The model the SESSION itself is running - owner row field 5.
 *
 *  Subagent rows have shown a model since wire v2, which left the one agent
 *  the operator is actually talking to as the only one whose model was
 *  invisible. */
func sessionModelOf(_ d: String, _ id: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" && part($0, 2) == id }
    if hits.count == 0 {
        return ""
    }
    let raw = part(hits[0], 5)
    return raw == "-" ? "" : raw
}

/** The tool call the SESSION itself is running right now - owner row field 6.
 *
 *  Subagent rows have shown an activity since #60, which left the one agent
 *  the operator is actually talking to as the only one that never said what it
 *  was doing. Absent on an idle Session, which is the common case: the plugin
 *  clears it at `assistant.turn_end` rather than letting an abandoned
 *  background call linger. */
func sessionActivityOf(_ d: String, _ id: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" && part($0, 2) == id }
    if hits.count == 0 {
        return ""
    }
    let raw = part(hits[0], 6)
    return raw == "-" ? "" : raw
}

/** The index of `id`'s owner row, or -1. */
func ownerIndex(_ rows: [String], _ id: String) -> Int {
    for i in 0..<rows.count {
        if part(rows[i], 0) == "@" && part(rows[i], 2) == id {
            return i
        }
    }
    return -1
}

/** The index one past the last row of the block starting at `from`.
 *
 *  `from` is the first row AFTER an owner row, not the owner row itself, so
 *  this can be called with the same value used to drop the prefix. */
func blockEnd(_ rows: [String], _ from: Int) -> Int {
    for i in from..<rows.count {
        if part(rows[i], 0) == "@" {
            return i
        }
    }
    return rows.count
}

/** Subagent rows belonging to ONE surface's block.
 *
 *  `liveRows` returns every row in the workspace, which is right for
 *  workspace-level signals like "is anything running" and wrong for a tab: a
 *  co-resident Session's subagents would render under this Session's tab.
 *
 *  A surface with no block of its own yields NO rows, because `ownerIndex`
 *  returns -1, `start` becomes 0, and the first row is then an owner row that
 *  bounds the slice to nothing.
 *
 *  Measured interpreter constraint, bisected against the rendered
 *  accessibility tree: a function call inside a TERNARY renders nothing at all.
 *  `let end = s < 0 ? 0 : blockEnd(rows, s)` silently produced an empty tree
 *  while `cmux sidebar validate` reported OK. Each call gets its own `let`. */
func liveRowsFor(_ d: String, _ id: String) -> [String] {
    let rows = rowsOf(d)
    let start = ownerIndex(rows, id) + 1
    let end = blockEnd(rows, start)
    return Array(rows.prefix(end).dropFirst(start))
        .filter { part($0, 0) != "!" && part($0, 0) != "@" }
}

/** The description with one row removed, for click-to-dismiss.
 *
 *  There is no hover state to lean on: the upstream sidebar guide is explicit
 *  that "input is limited to forwarded clicks (no hover, focus, or keyboard)".
 *  So a finished agent cannot be crossed out on hover - it is simply tappable,
 *  and tapping removes it. Only rows with the "v" glyph get this tap: running
 *  and failed work is not dismissible, and encodeTree in src/tree.ts would
 *  republish it within seconds anyway.
 *
 *  `reduce` is used to rejoin because it is the same construct `nameOf` already
 *  relies on; `joined(separator:)` is undocumented here and untested. */
func without(_ d: String, _ row: String) -> String {
    return rowsOf(d).filter { $0 != row }
        .reduce("") { $0 == "" ? $1 : $0 + "¦" + $1 }
}

/** The description with every FINISHED row of one Session removed.
 *
 *  "Dismiss all finished" as one action, rather than tapping each row. The
 *  plugin reads the removal as the dismissal signal - `detectDismissed` in
 *  src/runtime/processor.ts diffs the published rows against the computed tree
 *  and records the difference in runtime state - so removing rows here is what
 *  makes a dismissal stick rather than reappearing on the next publish.
 *
 *  Rows are matched by their exact string, which is the same approach `without`
 *  has always taken. The honest limitation: two Sessions in one workspace that
 *  both finished an identically named agent, on the same model, showing the
 *  same activity, encode to the same row - and this would dismiss both. The
 *  block-scoped alternative needs a running owner cursor while rebuilding the
 *  string, and mutable accumulation is not something this interpreter has been
 *  measured to support. The consequence is one extra dismissal of already
 *  finished work, which the plugin will not resurrect. */
func withoutFinished(_ d: String, _ id: String) -> String {
    // Failures count as finished. They are terminal work, and leaving them out
    // meant an operator with six dead agents on screen had no way to clear
    // them at all - the row was exempt from dismissal AND from retention.
    let mine = liveRowsFor(d, id).filter { part($0, 1) == "v" || part($0, 1) == "x" }
    return rowsOf(d).filter { !mine.contains($0) }
        .reduce("") { $0 == "" ? $1 : $0 + "¦" + $1 }
}

/** Whether this Session has any finished row to dismiss.
 *
 *  Gates the menu item. #61 is explicit that an item which does not apply is
 *  hidden rather than shown as a no-op, and an interpreted sidebar gives no
 *  feedback when an action does nothing - a wrong verb and a working one look
 *  identical on tap. */
func hasFinished(_ d: String, _ id: String) -> Bool {
    return liveRowsFor(d, id).filter { part($0, 1) == "v" || part($0, 1) == "x" }.count > 0
}

/** Terminal cursor blink, 1 Hz off the monotonic epoch. */
func blinkCursor(_ e: Int) -> Bool {
    return e % 2 == 0
}

/** Any subagent still marked running.
 *
 *  This is the fallback working signal. `latestAt` is a native binding but is
 *  NOT populated for Copilot surfaces on this build - measured empty on every
 *  workspace - so it cannot be relied on. */
func anyRunningInWorkspace(_ d: String) -> Bool {
    return rowsOf(d).filter { part($0, 1) == ">" }.count > 0
}



/** ---- SURFACE-SCOPED SIGNALS ------------------------------------------------
 *
 *  A workspace may host MORE THAN ONE Session, and each publishes its own block
 *  into the same description. Anything drawn on a SESSION row must therefore be
 *  read from that Session's block, never from the whole description.
 *
 *  This was already learned once, for the tree (#54), and fixed with
 *  `ownsSurface` and `liveRowsFor` - but the mascot's own signals were left
 *  reading workspace-wide. The result, observed live: one Session finished and
 *  published `! t Your turn`, and its co-resident Session - mid-tool, 58s into
 *  a `kusto_query` - drew closed eyes and an idle pose, because `attnKind` had
 *  found the OTHER Session's attention row.
 *
 *  Rule: on a Session row, use the `...For(d, id)` variants. The
 *  `...InWorkspace(d)` ones are correct only on the WORKSPACE row, where
 *  aggregating across Sessions is the intent. */

/** Attention published by THIS surface. */
func attnKindFor(_ d: String, _ id: String) -> String {
    let rows = rowsOf(d)
    let start = ownerIndex(rows, id) + 1
    let end = blockEnd(rows, start)
    let hits = Array(rows.prefix(end).dropFirst(start)).filter { part($0, 0) == "!" }
    return hits.count > 0 ? part(hits[0], 1) : ""
}

/** A running subagent belonging to THIS surface. */
func anyRunningFor(_ d: String, _ id: String) -> Bool {
    return liveRowsFor(d, id).filter { part($0, 1) == ">" }.count > 0
}

/** Whether THIS Session is working.
 *
 *  The first test is direct evidence rather than inference: the owner row now
 *  carries the Session's own in-flight tool call, so a Session grinding through
 *  a long tool with no subagents at all is visibly working. Absence of an
 *  attention row remains the fallback for the moment between events. */
func workingFor(_ d: String, _ id: String) -> Bool {
    if sessionActivityOf(d, id) != "" {
        return true
    }
    if anyRunningFor(d, id) {
        return true
    }
    return attnKindFor(d, id) == ""
}

/** Eyes open and glowing while THIS Session works; shut when it is idle. */
func eyesOpenFor(_ d: String, _ id: String) -> Bool {
    return workingFor(d, id)
}

/** The cued dot in the conducting wave, for THIS surface. */
func cuedFor(_ d: String, _ id: String, _ e: Int, _ i: Int) -> Bool {
    if anyRunningFor(d, id) {
        return ((e / 2) + i) % 3 == 0
    }
    return false
}


/** Depth is encoded as a string token; map it to an Int without relying on
 *  optional parsing in view code. Rows are capped at depth 6 upstream. */
func depthOf(_ row: String) -> Int {
    let d = part(row, 0)
    return d == "0" ? 0 : d == "1" ? 1 : d == "2" ? 2 : d == "3" ? 3 : d == "4" ? 4 : d == "5" ? 5 : 6
}

/** Whether another row at the same depth appears before this branch closes.
 *  The tree wire format is flat, but rows are depth-first. Looking ahead until
 *  a shallower row appears tells us whether to draw a tee/continuing vertical
 *  or the final elbow/blank ancestor space. */
func hasSiblingAfter(_ rows: [String], _ i: Int, _ depth: Int) -> Bool {
    if i + 1 >= rows.count {
        return false
    }
    for j in (i + 1)..<rows.count {
        let d = depthOf(rows[j])
        if d < depth {
            return false
        }
        if d == depth {
            return true
        }
    }
    return false
}

func treeBlankSlot() -> some View {
    return Spacer().frame(width: 13, height: 16)
}

func treeContinueSlot() -> some View {
    return ZStack {
        Rectangle().fill(.secondary).frame(width: 1, height: 16).offset(x: -4).opacity(0.45)
    }
    .frame(width: 13, height: 16)
}

func treeBranchSlot(_ hasNext: Bool) -> some View {
    return ZStack {
        if hasNext {
            Rectangle().fill(.secondary).frame(width: 1, height: 16).offset(x: -4).opacity(0.45)
        } else {
            Rectangle().fill(.secondary).frame(width: 1, height: 8).offset(x: -4, y: -4).opacity(0.45)
        }
        Rectangle().fill(.secondary).frame(width: 8, height: 1).offset(x: 0).opacity(0.45)
    }
    .frame(width: 13, height: 16)
}

/** Whether a row is a SKILL invocation rather than a subagent (#59).
 *
 *  Skills take over the status glyph rather than adding a field, so every
 *  existing exact-glyph reader keeps working: a skill is not counted as running
 *  by `countOf(d, ">")` and is not dismissible by the "v" tap, both correct. */
func isSkill(_ g: String) -> Bool {
    return g == "u" || g == "a" || g == "s"
}

/** How the skill started, as a colour.
 *
 *  Cyan for a skill the OPERATOR asked for, indigo for one the agent chose on
 *  its own, grey when the runtime did not say. Measured across every session
 *  log on disk: 191 user-invoked, 833 agent-invoked, and 83 carrying no trigger
 *  at all - so the third colour is a recorded state, not a fallback.
 *
 *  Hex strings rather than colour tokens so this can be a `func` returning a
 *  value; a call as a modifier argument works, a nested one does not. */
func skillColor(_ g: String) -> String {
    if g == "u" {
        return "#32D3EE"
    }
    if g == "a" {
        return "#BF80FF"
    }
    return "#8E8E93"
}

/** What the operator is told the row means, on hover. */
func skillHelp(_ g: String) -> String {
    if g == "u" {
        return "Skill - you invoked it"
    }
    if g == "a" {
        return "Skill - the agent chose it"
    }
    return "Skill"
}

/** Tooltip for a subagent row.
 *
 *  A red cross is not self-explanatory - the first question asked on seeing one
 *  was "not sure what the red X's are for". The glyph carries the state; the
 *  tooltip has to carry the meaning, and say WHERE it came from, because a
 *  failure Maestro cannot see looks identical to a success (see G-10). */
func rowHelp(_ status: String, _ title: String) -> String {
    if status == "x" {
        return title + " - FAILED. The subagent reported subagent.failed."
    }
    if status == ">" {
        return title + " - running"
    }
    return title
}

func runningDot() -> some View {
    return ZStack {
        Circle().fill(.green).frame(width: 6, height: 6)
            .shadow(color: "#30D158", radius: 4, x: 0, y: 0)
    }
    .frame(width: 12, height: 12)
}

func stoppedDot() -> some View {
    return Circle().fill(.secondary).frame(width: 5, height: 5).opacity(0.45)
        .frame(width: 12, height: 12)
}

/** Subagents hang off their owning Copilot surface, so overflow rows keep a
 *  fixed gutter aligned with the explicit connector tree. */
func treeIndent(_ row: String) -> Int {
    let d = part(row, 0)
    return d == "0" ? 44 : d == "1" ? 61 : d == "2" ? 79 : d == "3" ? 97 : d == "4" ? 114 : d == "5" ? 132 : 149
}

/** The attention kind a workspace is publishing: "p" permission, "q" question,
 *  "t" finished turn, "" none. See encodeAttention in src/tree.ts. */
func attnKindInWorkspace(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    return hits.count > 0 ? part(hits[0], 1) : ""
}

/** The raw attention row, so a tap can remove exactly it. */
func attnRowInWorkspace(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    return hits.count > 0 ? hits[0] : ""
}

/** The permission sub-kind on the attention row - "shell", "write", "read",
 *  "url", "mcp", "factory" - or "" when the runtime did not say.
 *
 *  See encodeAttention in src/tree.ts, which publishes a CLOSED vocabulary:
 *  anything unrecognised arrives as the "-" sentinel. */
func attnDetailInWorkspace(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    let raw = hits.count > 0 ? part(hits[0], 2) : ""
    return raw == "-" ? "" : raw
}

/** The icon for WHY approval is being asked.
 *
 *  A raised hand says "blocked"; it does not say whether the agent wants to
 *  run a command, write a file, or reach the network - which is the whole
 *  question the operator is about to answer. Unknown kinds keep the hand. */
func permGlyph(_ k: String) -> String {
    if k == "shell" {
        return "terminal.fill"
    }
    if k == "write" {
        return "square.and.pencil"
    }
    if k == "read" {
        return "eye.fill"
    }
    if k == "url" {
        return "globe"
    }
    if k == "mcp" {
        return "puzzlepiece.extension.fill"
    }
    if k == "factory" {
        return "gearshape.2.fill"
    }
    return "hand.raised.fill"
}

func attnLabelInWorkspace(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    if hits.count == 0 {
        return ""
    }
    return hits[0].split(separator: " ").map { String($0) }.dropFirst(3)
        .reduce("") { $0 == "" ? $1 : $0 + " " + $1 }
}

func countOf(_ d: String, _ g: String) -> Int {
    return rowsOf(d).filter { part($0, 1) == g }.count
}

/** Trailing path component, so a surface can show where it is working without
 *  spending the width a full path costs. Array indexing and arithmetic are
 *  fine inside a func body; only arithmetic as a bare modifier ARGUMENT is
 *  silently skipped by the interpreter. */
func baseName(_ p: String) -> String {
    let parts = p.split(separator: "/").map { String($0) }
    return parts.count > 0 ? parts[parts.count - 1] : p
}

VStack(alignment: .leading, spacing: 0) {

    HStack {
        Text("Maestro")
            .font(.system(size: 18, design: .monospaced)).bold()
            .foregroundColor(.secondary)
        Spacer()
        Image(systemName: "gearshape")
            .font(.system(size: 12))
            .foregroundColor(.secondary)
            .accessibilityLabel("Settings")
            .help("Settings")
            .onTapGesture {
                cmux("settings.open", target: "customSidebars")
            }
    }
    .padding(.horizontal, 4)
    // Header menu (#43). Three actions were proposed on that ticket - reload,
    // open log, copy tree - and all three were measured to be UNREACHABLE from
    // a sidebar, so none is offered:
    //
    //   - Reload: `cmux sidebar reload` is a CLI command with no socket method
    //     behind it. `sidebar.custom.open` opens a sidebar as a pane; it does
    //     not reload the running one.
    //   - Open log: `file.open` exists and works, but the diagnostic log lives
    //     under $TMPDIR and the sidebar has no environment access. Hard-coding
    //     a machine-specific path into a committed file is also against this
    //     repository's rules.
    //   - Copy tree: there is NO clipboard method anywhere in the socket API.
    //
    // What is offered instead is what the API actually supports and an
    // operator of this sidebar actually wants. See G-30.
    .contextMenu {
        Button("Sidebar Settings") { cmux("settings.open", target: "customSidebars") }
        Divider()
        Button("Jump to Unread") { cmux("notification.jump_to_unread") }
        Button("Mark All Notifications Read") { cmux("notification.mark_read", all: true) }
    }

    Divider()
        .offset(y: -6)

    VStack(alignment: .leading, spacing: 2) {
        Reorderable(workspaces, move: "workspace.reorder") { w in
            VStack(alignment: .leading, spacing: 3) {

                HStack(spacing: 5) {
                        if let d = w.description {
                            if anyRunningInWorkspace(d) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 3).fill(w.selected ? .accentColor : .green)
                                        .frame(width: 13, height: 10).opacity(0.22)
                                    Circle().fill(.green).frame(width: 6, height: 6)
                                        .shadow(color: "#30D158", radius: 3, x: 0, y: 0)
                                }
                                .frame(width: 16, height: 16)
                            } else {
                                Image(systemName: "rectangle.stack.fill")
                                    .imageScale(.small)
                                    .foregroundColor(w.selected ? .accentColor : .secondary)
                            }
                        } else {
                            Image(systemName: "rectangle.stack.fill")
                                .imageScale(.small)
                                .foregroundColor(w.selected ? .accentColor : .secondary)
                        }
                        Text(w.title)
                            .font(.body).bold()
                            .lineLimit(1).truncationMode(.tail)
                        if w.pinned {
                            Image(systemName: "pin.fill")
                                .imageScale(.small)
                                .foregroundColor(.orange)
                                .rotationEffect(.degrees(45))
                        }
                        if let b = w.branch {
                            Image(systemName: "arrow.triangle.branch")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                                .fixedSize()
                            Text(b)
                                .font(.system(size: 11)).fontDesign(.monospaced)
                                .foregroundColor(.secondary)
                                .lineLimit(1).truncationMode(.tail)
                            if w.dirty {
                                Circle().fill(.orange).frame(width: 4, height: 4).fixedSize()
                            }
                        }
                        Spacer(minLength: 3)
                        if let d = w.description {
                            // Tapping an attention badge takes you to the
                            // session that raised it AND clears the badge. It
                            // is a pointer, not a record: once you are looking
                            // at the prompt, the badge has done its job.
                            //
                            // Yellow, not red. A raised hand is a request, not
                            // a failure - red reads as "something broke" for
                            // what is a routine approval.
                            if attnKindInWorkspace(d) == "p" {
                                // Two `let`s rather than
                                // `Image(systemName: permGlyph(attnDetailInWorkspace(d)))`:
                                // a nested call as a modifier argument is one of
                                // the constructs this interpreter skips in
                                // silence. See the header.
                                let pk = attnDetailInWorkspace(d)
                                let pg = permGlyph(pk)
                                HStack(spacing: 3) {
                                    Image(systemName: pg).font(.system(size: 13))
                                    Text("ASK").font(.system(size: 13)).bold()
                                }
                                .foregroundColor(.yellow)
                                .shadow(color: "#FFCC00", radius: 5, x: 0, y: 0)
                                .fixedSize()
                                .help(attnLabelInWorkspace(d))
                                .onTapGesture {
                                    cmux("workspace.select", workspace_id: w.id)
                                    cmux("surface.focus", surface_id: ownerOf(d))
                                    cmux("workspace.action",
                                         workspace_id: w.id,
                                         action: "set-description",
                                         description: without(d, attnRowInWorkspace(d)))
                                }
                            }
                            if attnKindInWorkspace(d) == "q" {
                                HStack(spacing: 3) {
                                    Image(systemName: "questionmark.bubble.fill").font(.system(size: 13))
                                    Text("ASK").font(.system(size: 13)).bold()
                                }
                                .foregroundColor(.yellow)
                                .shadow(color: "#FFCC00", radius: 5, x: 0, y: 0)
                                .fixedSize()
                                .help(attnLabelInWorkspace(d))
                                .onTapGesture {
                                    cmux("workspace.select", workspace_id: w.id)
                                    cmux("surface.focus", surface_id: ownerOf(d))
                                    cmux("workspace.action",
                                         workspace_id: w.id,
                                         action: "set-description",
                                         description: without(d, attnRowInWorkspace(d)))
                                }
                            }
                            if attnKindInWorkspace(d) == "t" {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(.green)
                                    .fixedSize()
                                    .help("Finished - your turn")
                                    .onTapGesture {
                                        cmux("workspace.action",
                                             workspace_id: w.id,
                                             action: "set-description",
                                             description: without(d, attnRowInWorkspace(d)))
                                    }
                            }
                            if countOf(d, ">") > 0 {
                                HStack(spacing: 3) {
                                    // A REAL loader. ProgressView resolves to a
                                    // native AXBusyIndicator (NSProgressIndicator),
                                    // which animates at native framerate on its
                                    // own. Everything hand-drawn here is capped at
                                    // 1 fps: `clock.epoch` is SECONDS - measured,
                                    // 1787427474, ten digits - so a value
                                    // recomputed per tick can never be smooth.
                                    ProgressView()
                                        .scaleEffect(0.45)
                                        .frame(width: 14, height: 14)
                                        .tint(.green)
                                    Text("\(countOf(d, ">")) active")
                                        .font(.system(size: 12)).bold().monospacedDigit()
                                }
                                .foregroundColor(.green)
                                .shadow(color: "#30D158", radius: 4, x: 0, y: 0)
                                .fixedSize()
                                .help("Running subagents")
                            }
                            // A failed count. `subagent.failed` IS real - the
                            // note that used to sit here said it did not exist,
                            // on a sample of 60 sessions that happened to
                            // contain none. Re-measured across every session
                            // log on disk: 2,898 `subagent.started`, 2,815
                            // `subagent.completed`, 27 `subagent.failed` over
                            // 11 logs. Five failures in a single Session were
                            // then observed live, drawn as running.
                            //
                            // It is still true that `subagent.completed`
                            // carries no success flag, so a subagent that dies
                            // WITHOUT emitting the event is invisible here.
                            // This badge counts what the log states, not every
                            // failure that happens.
                            if countOf(d, "x") > 0 {
                                HStack(spacing: 3) {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 9))
                                    Text("\(countOf(d, "x"))")
                                        .font(.system(size: 12)).bold().monospacedDigit()
                                }
                                .foregroundColor(.red)
                                .fixedSize()
                                .help("Failed subagents")
                            }
                            if countOf(d, "v") > 0 {
                                Text("\(countOf(d, "v"))")
                                    .font(.system(size: 12)).monospacedDigit()
                                    .foregroundColor(.secondary)
                                    .fixedSize()
                            }
                        }
                        if w.index < 9 {
                            Text("⌘\(w.index + 1)")
                                .font(.system(size: 9)).foregroundColor(.secondary)
                                .fixedSize()
                        }
                    }
                    // Vertical padding only. Horizontal padding here bought
                    // nothing - the sidebar frame already supplies its own left
                    // inset - and every pixel of it came out of the width the
                    // workspace title had to render in.
                    // Uniform, and deliberately small. This padding is the only
                    // left inset Maestro owns - the remaining ~28px is the cmux
                    // sidebar frame's own - and it came straight out of the
                    // width the workspace title had to render in. Turning it
                    // from 4 down to 2 took the title from 88px truncated to
                    // 232px. Do NOT reach for `.padding(.vertical,)` here: on
                    // this container an edge-specific padding ADDS inset rather
                    // than restricting it (measured, see the header).
                    .padding(2)
                    .onTapGesture { cmux("workspace.select", workspace_id: w.id) }
                    .contextMenu {
                        // Every verb here was checked against the live socket
                        // before it was written. `cmux docs api` documents
                        // hyphenated action names (`move-top`, `mark-read`)
                        // while this file has always sent underscores; both
                        // were tested and the socket normalises them, so the
                        // pre-existing items were never inert. An UNKNOWN verb
                        // is rejected with `invalid_params` - which the CLI
                        // prints and a sidebar tap silently swallows. That is
                        // why the list is measured rather than transcribed.
                        Button("Move to Top") { cmux("workspace.action", action: "move_top", workspace_id: w.id) }
                        Button("Move Up") { cmux("workspace.action", action: "move_up", workspace_id: w.id) }
                        Button("Move Down") { cmux("workspace.action", action: "move_down", workspace_id: w.id) }
                        Divider()
                        Button(w.pinned ? "Unpin" : "Pin") { cmux("workspace.action", action: w.pinned ? "unpin" : "pin", workspace_id: w.id) }
                        Button("Mark as Read") { cmux("workspace.action", action: "mark_read", workspace_id: w.id) }
                        Button("Mark as Unread") { cmux("workspace.action", action: "mark_unread", workspace_id: w.id) }
                        Divider()
                        // No "Rename". `workspace.action rename` requires a
                        // `title` parameter and the sidebar has no TextField,
                        // no @State, and no way to prompt - so the only rename
                        // this file could offer would rename to a value chosen
                        // in advance. Clearing needs no argument, so that is
                        // offered instead. See G-30.
                        if w.title != "" {
                            Button("Reset Name") { cmux("workspace.action", action: "clear_name", workspace_id: w.id) }
                        }
                        // No colour submenu. `workspace.action set-color` works
                        // - measured, "orange" resolves to #A04000 - but a
                        // `Menu(...)` nested inside a `.contextMenu` makes the
                        // ENTIRE context menu fail to open. Measured by
                        // bisection against the rendered accessibility tree:
                        // with the submenu present, right-clicking a workspace
                        // row produced no AXMenu at all; removing it and
                        // changing nothing else restored all 16 items. The
                        // authoring guide lists both constructs as supported
                        // individually. See G-31.
                        //
                        // Flattening six colour items into an already long menu
                        // was the alternative and was judged not worth it.
                        Divider()
                        // Remote verbs appear only on a remote workspace.
                        // Measured: `workspace.remote.reconnect` on a local
                        // workspace returns `invalid_state: Remote workspace is
                        // not configured`, and a sidebar cannot show that. The
                        // `remote` binding is documented as present only when
                        // the workspace has one, so `if let` is the gate.
                        if let rem = w.remote {
                            if rem.connected {
                                Button("Disconnect Remote") { cmux("workspace.remote.disconnect", workspace_id: w.id) }
                            } else {
                                Button("Reconnect Remote") { cmux("workspace.remote.reconnect", workspace_id: w.id) }
                            }
                            Divider()
                        }
                        Button("New Tab") { cmux("surface.create", workspace_id: w.id, focus: true) }
                        Divider()
                        Button("Close Others") { cmux("workspace.action", action: "close_others", workspace_id: w.id) }
                        Button("Close Above") { cmux("workspace.action", action: "close_above", workspace_id: w.id) }
                        Button("Close Below") { cmux("workspace.action", action: "close_below", workspace_id: w.id) }
                        Button("Close Workspace") { cmux("workspace.close", workspace_id: w.id) }
                    }

                    ForEach(w.tabs.prefix(8)) { t in
                        // A Session and the subagents it spawned are ONE selectable
                        // unit. They were previously siblings, so the selection
                        // background and accent stripe stopped at the tab row and
                        // the subagent rows below it read as unrelated, unselected
                        // work. Wrapping them makes the visual grouping match the
                        // actual ownership: these agents belong to THIS Session.
                        VStack(alignment: .leading, spacing: 2) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Spacer().frame(width: 12)
                                // Four surface states, and one rule: motion means
                                // work is happening. An idle Session is dimmed and
                                // completely still, so a moving icon is always worth
                                // looking at.
                                //
                                // cmux exposes no kind on a tab - the binding set is
                                // id, title, focused, pinned, directory, branch,
                                // ports - so the only non-heuristic way to know a
                                // surface runs Copilot is the owner row this plugin
                                // publishes. Branching on title or directory shape
                                // was rejected as heuristic identity, the same
                                // mistake as #33.
                                //
                                // Every Session in the workspace publishes its
                                // own owner row, so this asks whether THIS
                                // surface owns a block rather than whether it
                                // happens to be the first one listed (#54).
                                if let d = w.description {
                                    if ownsSurface(d, t.id) {
                                        if anyRunningFor(d, t.id) {
                                            ZStack {
                                                Capsule().fill(.accentColor).frame(width: 4, height: 15)
                                                    .rotationEffect(.degrees(45)).offset(x: -11, y: -6)
                                                if cuedFor(d, t.id, clock.epoch, 0) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 10, y: -7)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 10, y: -7).opacity(0.35)
                                                }
                                                if cuedFor(d, t.id, clock.epoch, 1) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 12, y: 1)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 12, y: 1).opacity(0.35)
                                                }
                                                if cuedFor(d, t.id, clock.epoch, 2) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 10, y: 9)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 10, y: 9).opacity(0.35)
                                                }
                                                Circle().fill(.primary).frame(width: 4, height: 4).offset(x: -3, y: -13)
                                                Rectangle().fill(.primary).frame(width: 2, height: 4).offset(x: -3, y: -9)
                                                RoundedRectangle(cornerRadius: 5).fill(.primary).frame(width: 17, height: 14).offset(x: -3)
                                                RoundedRectangle(cornerRadius: 3).fill(.black).frame(width: 11, height: 7).offset(x: -3)
                                                if eyesOpenFor(d, t.id) {
                                                    Capsule().fill(.green).frame(width: 2, height: 4).offset(x: -6)
                                                        .shadow(color: "#30D158", radius: 3, x: 0, y: 0)
                                                    Capsule().fill(.green).frame(width: 2, height: 4).offset(x: 0)
                                                        .shadow(color: "#30D158", radius: 3, x: 0, y: 0)
                                                } else {
                                                    Capsule().fill(.secondary).frame(width: 2, height: 1).offset(x: -6)
                                                    Capsule().fill(.secondary).frame(width: 2, height: 1).offset(x: 0)
                                                }
                                            }.frame(width: 30, height: 28)
                                        } else {
                                            ZStack {
                                                RoundedRectangle(cornerRadius: 2).fill(.primary).frame(width: 3, height: 5).offset(x: -8)
                                                RoundedRectangle(cornerRadius: 2).fill(.primary).frame(width: 3, height: 5).offset(x: 8)
                                                Circle().fill(.primary).frame(width: 4, height: 4).offset(y: -10)
                                                Rectangle().fill(.primary).frame(width: 2, height: 4).offset(y: -7)
                                                RoundedRectangle(cornerRadius: 5).fill(.primary).frame(width: 17, height: 14)
                                                RoundedRectangle(cornerRadius: 3).fill(.black).frame(width: 11, height: 8)
                                                if eyesOpenFor(d, t.id) {
                                                    Capsule().fill(.green).frame(width: 2, height: 4).offset(x: -3)
                                                        .shadow(color: "#30D158", radius: 3, x: 0, y: 0)
                                                    Capsule().fill(.green).frame(width: 2, height: 4).offset(x: 3)
                                                        .shadow(color: "#30D158", radius: 3, x: 0, y: 0)
                                                } else {
                                                    Capsule().fill(.secondary).frame(width: 2, height: 1).offset(x: -3)
                                                    Capsule().fill(.secondary).frame(width: 2, height: 1).offset(x: 3)
                                                }
                                            }.frame(width: 24, height: 24)
                                        }
                                    } else {
                                        if let dir = t.directory {
                                            HStack(spacing: 1) {
                                                Text(">").font(.system(size: 11)).fontDesign(.monospaced)
                                                    .foregroundColor(t.focused && w.selected ? .accentColor : .secondary)
                                                if blinkCursor(clock.epoch) {
                                                    Text("_").font(.system(size: 11)).fontDesign(.monospaced).foregroundColor(.secondary)
                                                } else {
                                                    Text(" ").font(.system(size: 11)).fontDesign(.monospaced).foregroundColor(.secondary)
                                                }
                                            }.frame(width: 22)
                                        } else {
                                            Image(systemName: "globe")
                                                .font(.system(size: 14))
                                                .foregroundColor(t.focused && w.selected ? .accentColor : .secondary)
                                                .frame(width: 22, height: 22)
                                        }
                                    }
                                } else {
                                    if let dir = t.directory {
                                        HStack(spacing: 1) {
                                            Text(">").font(.system(size: 11)).fontDesign(.monospaced)
                                                .foregroundColor(t.focused && w.selected ? .accentColor : .secondary)
                                            if blinkCursor(clock.epoch) {
                                                Text("_").font(.system(size: 11)).fontDesign(.monospaced).foregroundColor(.secondary)
                                            } else {
                                                Text(" ").font(.system(size: 11)).fontDesign(.monospaced).foregroundColor(.secondary)
                                            }
                                        }.frame(width: 22)
                                    } else {
                                        Image(systemName: "globe")
                                            .font(.system(size: 14))
                                            .foregroundColor(t.focused && w.selected ? .accentColor : .secondary)
                                            .frame(width: 22, height: 22)
                                    }
                                }
                                Text(t.title)
                                    .font(.caption)
                                    .foregroundColor(t.focused && w.selected ? .primary : .secondary)
                                    .lineLimit(1).truncationMode(.tail)
                                // Maestro reporting on Maestro. The tree above
                                // is only ever as true as the last hook that
                                // landed, and a dead publisher looks exactly
                                // like an idle one - which is how this plugin
                                // published nothing for two days and nothing
                                // said so (#63). This badge is the difference
                                // between the two, and it is deliberately
                                // small and unlit: it reports on the OBSERVER,
                                // not on the work, and must never outshout an
                                // agent actually asking for something.
                                if let d = w.description {
                                    let stalled = stalledFor(d, t.id)
                                    if stalled != "" {
                                        Image(systemName: "exclamationmark.triangle.fill")
                                            .font(.system(size: 10))
                                            .foregroundColor(.orange)
                                            .fixedSize()
                                            .help("Maestro is not receiving hooks - this tree may be stale")
                                    }
                                }
                                Spacer(minLength: 4)
                                // What this Session IS, as opposed to what it
                                // is doing: which model is driving it and which
                                // git worktree it is working out of.
                                //
                                // Both sit before the directory rather than
                                // replacing it - the directory is where the
                                // work happens, the worktree is which parallel
                                // line of work it belongs to, and with a
                                // detached HEAD those are the only two facts
                                // that distinguish one Session from another.
                                //
                                // No `.fixedSize()` on any of these. They are
                                // variable-length Text, and a fixed one makes
                                // its whole row incompressible - one long value
                                // then widens the pane and shifts every row off
                                // its left edge. Measured; see the header.
                                if let d = w.description {
                                    let wt = worktreeOf(d, t.id)
                                    if wt != "" {
                                        Image(systemName: "arrow.triangle.branch")
                                            .font(.system(size: 9))
                                            .foregroundColor(.secondary)
                                            .fixedSize()
                                        Text(wt)
                                            .font(.system(size: 10)).fontDesign(.monospaced)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1).truncationMode(.tail)
                                            .help("Worktree")
                                    }
                                    let sm = sessionModelOf(d, t.id)
                                    if sm != "" {
                                        Text(shortModel(sm))
                                            .font(.system(size: 9))
                                            .foregroundColor(.secondary)
                                            .opacity(0.75)
                                            .lineLimit(1).truncationMode(.tail)
                                            .help("Model")
                                    }
                                    // What the Session is doing RIGHT NOW, as
                                    // opposed to what it is. Styled like the
                                    // subagent activity field so the same fact
                                    // reads the same way at every depth.
                                    let sa = sessionActivityOf(d, t.id)
                                    if sa != "" {
                                        Text(sa)
                                            .font(.system(size: 10))
                                            .foregroundColor(.secondary)
                                            .lineLimit(1).truncationMode(.tail)
                                            .help("Running now")
                                    }
                                }
                                if let dir = t.directory {
                                    Text(baseName(dir))
                                        .font(.system(size: 10)).fontDesign(.monospaced)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1).truncationMode(.tail)
                                }
                                // Listening ports, on plain shell rows only.
                                //
                                // Measurement narrowed this feature rather than
                                // confirming it. `t.ports` is real and is
                                // per-surface, but on a COPILOT row it is the
                                // agent runtime's own ephemeral listeners -
                                // 60559, 58371, 54083, and NINE of them on one
                                // Session. That is noise dressed as
                                // information. On a shell row a port means what
                                // an operator thinks it means: the dev server
                                // they just started.
                                //
                                // Capped at three. A row must never be widened
                                // by data - see the header - and the tail here
                                // is the same trap the worktree field was.
                                if let d = w.description {
                                    if ownsSurface(d, t.id) == false {
                                        ForEach(Array(t.ports.prefix(3))) { p in
                                            Text(":\(p)")
                                                .font(.system(size: 9)).fontDesign(.monospaced)
                                                .foregroundColor(.secondary)
                                                .lineLimit(1)
                                                .help("Listening port")
                                        }
                                    }
                                } else {
                                    ForEach(Array(t.ports.prefix(3))) { p in
                                        Text(":\(p)")
                                            .font(.system(size: 9)).fontDesign(.monospaced)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                            .help("Listening port")
                                    }
                                }
                            }

                            // Detail lines exist only for the focused surface, so the
                            // default view stays one line per card. Focus is persisted
                            // by cmux, so this needs no @State - which the interpreter
                            // does not support.
                            if t.focused && w.selected {
                                if let dir = t.directory {
                                    HStack(spacing: 5) {
                                        Spacer().frame(width: 30)
                                        Text(dir)
                                            .font(.system(size: 10)).fontDesign(.monospaced)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1).truncationMode(.tail)
                                        if let tb = t.branch {
                                            Image(systemName: "arrow.triangle.branch")
                                                .font(.system(size: 9))
                                                .foregroundColor(.secondary)
                                                .fixedSize()
                                            Text(tb)
                                                .font(.system(size: 10)).fontDesign(.monospaced)
                                                .foregroundColor(.secondary)
                                                .lineLimit(1).truncationMode(.tail)
                                            if t.dirty {
                                                Circle().fill(.orange).frame(width: 3, height: 3).fixedSize()
                                            }
                                        }
                                        Spacer(minLength: 0)
                                    }
                                }
                            }
                        }
                        .padding(4)
                        .onTapGesture {
                            cmux("workspace.select", workspace_id: w.id)
                            cmux("surface.focus", surface_id: t.id)
                        }
                        // Session / tab row menu (#61). `tab.action` takes
                        // `surface_id`, and `surface.action` is the same
                        // handler under another name - it rejects an unknown
                        // verb with "Unknown tab action".
                        .contextMenu {
                            Button("Focus") {
                                cmux("workspace.select", workspace_id: w.id)
                                cmux("surface.focus", surface_id: t.id)
                            }
                            Divider()
                            Button(t.pinned ? "Unpin Tab" : "Pin Tab") { cmux("tab.action", action: t.pinned ? "unpin" : "pin", surface_id: t.id) }
                            Button("Mark as Unread") { cmux("tab.action", action: "mark_unread", surface_id: t.id) }
                            Button("Reset Name") { cmux("tab.action", action: "clear_name", surface_id: t.id) }
                            Divider()
                            // Reload and Duplicate are BROWSER-ONLY. Measured:
                            // both return `invalid_state: only available for
                            // browser tabs` on a terminal surface, and a
                            // sidebar tap shows no error - so on a Copilot
                            // Session they would be silent no-ops. The sidebar
                            // already distinguishes the two kinds by the
                            // `directory` binding, which a browser surface does
                            // not carry; that is the same test the tab icon
                            // uses a few lines above.
                            if t.directory == nil {
                                Button("Reload") { cmux("tab.action", action: "reload", surface_id: t.id) }
                                Button("Duplicate") { cmux("tab.action", action: "duplicate", surface_id: t.id) }
                                Divider()
                            }
                            Button("New Terminal to the Right") { cmux("tab.action", action: "new_terminal_right", surface_id: t.id) }
                            Button("New Browser to the Right") { cmux("tab.action", action: "new_browser_right", surface_id: t.id) }
                            Divider()
                            Button("Close Others") { cmux("tab.action", action: "close_others", surface_id: t.id) }
                            Button("Close to the Left") { cmux("tab.action", action: "close_left", surface_id: t.id) }
                            Button("Close to the Right") { cmux("tab.action", action: "close_right", surface_id: t.id) }
                            Button("Close Tab") { cmux("surface.close", surface_id: t.id) }
                        }

                            // The subagent tree belongs to the Copilot session
                            // that produced it, not to the workspace. It renders
                            // inside this tab only when the plugin published
                            // this surface as the owner.
                            if let d = w.description {
                                if ownsSurface(d, t.id) {
                                    // Only a FINISHED agent is dismissible, and
                                    // only it carries the dismissing tap. The
                                    // backend refuses to hide running or failed
                                    // work (see encodeTree in src/tree.ts), so an
                                    // unconditional tap here would blank a row
                                    // that reappears on the next publish - the
                                    // sidebar lying about state it does not own.
                                    // Live rows take the same tap as their tab:
                                    // focus the surface that is doing the work.
                                    let rows = liveRowsFor(d, t.id)
                                    let visibleRows = Array(rows.prefix(10).enumerated())
                                    ForEach(visibleRows, id: \.offset) { i, row in
                                        let depth = depthOf(row)
                                        let keep0 = hasSiblingAfter(rows, i, 0)
                                        let keep1 = hasSiblingAfter(rows, i, 1)
                                        let keep2 = hasSiblingAfter(rows, i, 2)
                                        let keep3 = hasSiblingAfter(rows, i, 3)
                                        let keep4 = hasSiblingAfter(rows, i, 4)
                                        let keep5 = hasSiblingAfter(rows, i, 5)
                                        let rowKeepsGoing = hasSiblingAfter(rows, i, depth)
                                        let status = part(row, 1)
                                        let title = agentNameOf(row)
                                        let model = shortModel(modelOf(row))
                                        let doing = activityOf(row)
                                        // A SKILL invocation, not a subagent (#59). It sits in the
                                        // tree at the point it was invoked - `agentId` on the
                                        // event names the invoking subagent, so a skill the agent
                                        // chose while working nests under it, and one the operator
                                        // asked for sits at the root.
                                        //
                                        // Colour carries the distinction the ticket asks for, and
                                        // it is DERIVED: the runtime records `trigger` as
                                        // user-invoked or agent-invoked. Rows with no recorded
                                        // trigger are grey rather than assumed to be either.
                                        if isSkill(status) {
                                            HStack(spacing: 6) {
                                                Spacer().frame(width: 30)
                                                HStack(spacing: 0) {
                                                    if depth > 0 {
                                                        if keep0 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 1 {
                                                        if keep1 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 2 {
                                                        if keep2 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 3 {
                                                        if keep3 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 4 {
                                                        if keep4 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 5 {
                                                        if keep5 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    treeBranchSlot(rowKeepsGoing)
                                                }
                                                .fixedSize()
                                                Image(systemName: "wand.and.stars")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(skillColor(status))
                                                    .frame(width: 12)
                                                Text(title)
                                                    .font(.system(size: 12))
                                                    .foregroundColor(skillColor(status))
                                                    .lineLimit(1).truncationMode(.tail)
                                                Spacer(minLength: 0)
                                            }
                                            .padding(4)
                                            .help(skillHelp(status))
                                            .onTapGesture {
                                                cmux("workspace.select", workspace_id: w.id)
                                                cmux("surface.focus", surface_id: t.id)
                                            }
                                        } else {
                                        if status == "v" {
                                            HStack(spacing: 6) {
                                                Spacer().frame(width: 30)
                                                HStack(spacing: 0) {
                                                    if depth > 0 {
                                                        if keep0 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 1 {
                                                        if keep1 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 2 {
                                                        if keep2 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 3 {
                                                        if keep3 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 4 {
                                                        if keep4 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 5 {
                                                        if keep5 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    treeBranchSlot(rowKeepsGoing)
                                                }
                                                .fixedSize()
                                                stoppedDot()
                                                Text(title)
                                                    .font(.system(size: 12))
                                                    .foregroundColor(.secondary)
                                                    .lineLimit(1).truncationMode(.tail)
                                                Spacer(minLength: 0)
                                                // A finished row keeps its model
                                                // badge: which model did that
                                                // work is the question asked
                                                // after the fact, not during.
                                                if model != "" {
                                                    Text(model)
                                                        .font(.system(size: 9))
                                                        .foregroundColor(.secondary)
                                                        .opacity(0.6)
                                                        .lineLimit(1).truncationMode(.tail)
                                                }
                                            }
                                            .padding(4)
                                            .help("Click to dismiss")
                                            .onTapGesture {
                                                cmux("workspace.action",
                                                     workspace_id: w.id,
                                                     action: "set-description",
                                                     description: without(d, row))
                                            }
                                            .contextMenu {
                                                // A subagent is MAESTRO's
                                                // concept, not cmux's - there
                                                // is no `subagent.*` method and
                                                // no clipboard verb anywhere in
                                                // the socket API, so "copy
                                                // name" is not offerable. What
                                                // is left is dismissal, which
                                                // this plugin already owns, and
                                                // navigation to the Session
                                                // that produced the work.
                                                Button("Dismiss") {
                                                    cmux("workspace.action",
                                                         workspace_id: w.id,
                                                         action: "set-description",
                                                         description: without(d, row))
                                                }
                                                Button("Dismiss All Finished") {
                                                    cmux("workspace.action",
                                                         workspace_id: w.id,
                                                         action: "set-description",
                                                         description: withoutFinished(d, t.id))
                                                }
                                                Divider()
                                                Button("Focus Session") {
                                                    cmux("workspace.select", workspace_id: w.id)
                                                    cmux("surface.focus", surface_id: t.id)
                                                }
                                            }
                                        } else {
                                            HStack(spacing: 6) {
                                                Spacer().frame(width: 30)
                                                HStack(spacing: 0) {
                                                    if depth > 0 {
                                                        if keep0 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 1 {
                                                        if keep1 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 2 {
                                                        if keep2 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 3 {
                                                        if keep3 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 4 {
                                                        if keep4 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    if depth > 5 {
                                                        if keep5 { treeContinueSlot() } else { treeBlankSlot() }
                                                    }
                                                    treeBranchSlot(rowKeepsGoing)
                                                }
                                                .fixedSize()
                                                if status == ">" {
                                                    runningDot()
                                                } else {
                                                    Image(systemName: "xmark")
                                                        .font(.system(size: 10))
                                                        .foregroundColor(.red)
                                                        .frame(width: 12)
                                                }
                                                Text(title)
                                                    .font(.system(size: 12))
                                                    .foregroundColor(.primary)
                                                    .lineLimit(1).truncationMode(.tail)
                                                // Say it in words. A red cross
                                                // is not self-explanatory - the
                                                // first two questions asked of
                                                // this row were "not sure what
                                                // the red X's are for" and "they
                                                // aren't going away". A tooltip
                                                // does not answer either, because
                                                // it has to be discovered first.
                                                if status == "x" {
                                                    Text("failed")
                                                        .font(.system(size: 10))
                                                        .foregroundColor(.red)
                                                        .opacity(0.85)
                                                        .lineLimit(1)
                                                }
                                                // What it is doing right now -
                                                // the open tool call's NAME.
                                                // Absent activity renders
                                                // nothing at all, so a row with
                                                // none looks exactly as before.
                                                if doing != "" {
                                                    Text(doing)
                                                        .font(.system(size: 10))
                                                        .foregroundColor(.secondary)
                                                        .lineLimit(1).truncationMode(.tail)
                                                }
                                                Spacer(minLength: 0)
                                                if model != "" {
                                                    Text(model)
                                                        .font(.system(size: 9))
                                                        .foregroundColor(.secondary)
                                                        .opacity(0.75)
                                                        .lineLimit(1).truncationMode(.tail)
                                                }
                                            }
                                            .padding(4)
                                            .help(rowHelp(status, title))
                                            .onTapGesture {
                                                cmux("workspace.select", workspace_id: w.id)
                                                cmux("surface.focus", surface_id: t.id)
                                            }
                                            .contextMenu {
                                                // A FAILED row can be dismissed;
                                                // a RUNNING one cannot. Failure
                                                // is terminal, so the plugin
                                                // will not resurrect the row -
                                                // whereas dismissing running
                                                // work would appear to succeed
                                                // and then undo itself within
                                                // seconds, the sidebar lying
                                                // about state it does not own.
                                                if status == "x" {
                                                    Button("Dismiss") {
                                                        cmux("workspace.action",
                                                             workspace_id: w.id,
                                                             action: "set-description",
                                                             description: without(d, row))
                                                    }
                                                }
                                                Button("Focus Session") {
                                                    cmux("workspace.select", workspace_id: w.id)
                                                    cmux("surface.focus", surface_id: t.id)
                                                }
                                                if hasFinished(d, t.id) {
                                                    Divider()
                                                    Button("Dismiss All Finished") {
                                                        cmux("workspace.action",
                                                             workspace_id: w.id,
                                                             action: "set-description",
                                                             description: withoutFinished(d, t.id))
                                                    }
                                                }
                                            }
                                        }
                                    }
                                        }
                                    if rows.count > 10 {
                                        HStack(spacing: 6) {
                                            Spacer().frame(width: 30)
                                            HStack(spacing: 0) {
                                                treeContinueSlot()
                                                treeBranchSlot(false)
                                            }
                                            .fixedSize()
                                            Text("+ \(rows.count - 10) more")
                                                .font(.caption2).foregroundColor(.secondary)
                                            Spacer(minLength: 0)
                                        }
                                        .padding(4)
                                    }
                                }
                            }
                        }
                        .background {
                            if t.focused && w.selected {
                                Rectangle().fill(.secondary).opacity(0.07)
                            }
                        }
                        .overlay(alignment: .leading) {
                            if t.focused && w.selected {
                                Rectangle().fill(.accentColor).frame(width: 2)
                            }
                        }
                }
            }
            .padding(1)
        }
    }
    .padding(.bottom, 40)
    .offset(y: -16)
}
