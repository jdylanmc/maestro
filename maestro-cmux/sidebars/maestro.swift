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

func part(_ row: String, _ i: Int) -> String {
    let p = row.split(separator: " ").map { String($0) }
    return p.count > i ? p[i] : ""
}

/** The name on an OWNER or ATTENTION row - three fields, name last. */
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

/** Terminal cursor blink, 1 Hz off the monotonic epoch. */
func blinkCursor(_ e: Int) -> Bool {
    return e % 2 == 0
}

/** Any subagent still marked running.
 *
 *  This is the fallback working signal. `latestAt` is a native binding but is
 *  NOT populated for Copilot surfaces on this build - measured empty on every
 *  workspace - so it cannot be relied on. */
func anyRunning(_ d: String) -> Bool {
    return rowsOf(d).filter { part($0, 1) == ">" }.count > 0
}

/** Eyes open and glowing while working; shut when idle.
 *
 *  Previously the eyes blinked on even seconds. A blink recomputed once per
 *  tick reads as a stutter rather than life, because `clock.epoch` is SECONDS
 *  and the sidebar re-evaluates about once a second - the same ~1 fps ceiling
 *  that rules out every other hand-drawn animation here. A steady green glow
 *  carries the same "this one is awake" signal with no motion budget at all,
 *  and matches the running-subagent dot so one colour means one thing.
 *
 *  Idle stays deliberately motionless AND unlit - stillness is the signal. */
func eyesOpen(_ d: String) -> Bool {
    return working(d)
}

/** The Session itself is working, which is NOT the same as having a running
 *  subagent.
 *
 *  Derived from the attention row, because that is the only turn-level signal
 *  published today:
 *
 *    ""  no attention   -> mid-turn, the agent is doing something
 *    "t" Your turn      -> the turn ended, the operator is next
 *    "p" permission     -> blocked on the operator
 *    "q" question       -> blocked on the operator
 *
 *  Blocked is deliberately NOT working: a stalled Session should sit still and
 *  wear its badge rather than look busy. */
func working(_ d: String) -> Bool {
    if anyRunning(d) {
        return true
    }
    return attnKind(d) == ""
}

/** The cued dot in the conducting wave, or none at all when idle.
 *
 *  Driven by EPOCH and held for two ticks per phase. `clock.second` wraps at
 *  60 and jerks once a minute, and a one-tick-per-phase sequence shows the
 *  sidebar's ~1s refresh drift as a visible stutter. Two ticks absorbs it.
 *
 *  Takes the raw description rather than a precomputed Bool: a NESTED function
 *  call used as an argument - cued(anyRunning(d), ...) - renders NOTHING. The
 *  head drew and the baton and dots silently vanished, which read as the wrong
 *  icon rather than as a failure. Keep arguments flat: bindings and literals. */
func cued(_ d: String, _ e: Int, _ i: Int) -> Bool {
    if anyRunning(d) {
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
func attnKind(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    return hits.count > 0 ? part(hits[0], 1) : ""
}

/** The raw attention row, so a tap can remove exactly it. */
func attnRow(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    return hits.count > 0 ? hits[0] : ""
}

func attnLabel(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "!" }
    return hits.count > 0 ? nameOf(hits[0]) : ""
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

    Divider()
        .offset(y: -6)

    VStack(alignment: .leading, spacing: 2) {
        Reorderable(workspaces, move: "workspace.reorder") { w in
            VStack(alignment: .leading, spacing: 3) {

                HStack(spacing: 5) {
                        if let d = w.description {
                            if anyRunning(d) {
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
                            .lineLimit(1).truncationMode(.tail).layoutPriority(1)
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
                                .fixedSize()
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
                            if attnKind(d) == "p" {
                                HStack(spacing: 3) {
                                    Image(systemName: "hand.raised.fill").font(.system(size: 13))
                                    Text("ASK").font(.system(size: 13)).bold()
                                }
                                .foregroundColor(.yellow)
                                .shadow(color: "#FFCC00", radius: 5, x: 0, y: 0)
                                .fixedSize()
                                .help(attnLabel(d))
                                .onTapGesture {
                                    cmux("workspace.select", workspace_id: w.id)
                                    cmux("surface.focus", surface_id: ownerOf(d))
                                    cmux("workspace.action",
                                         workspace_id: w.id,
                                         action: "set-description",
                                         description: without(d, attnRow(d)))
                                }
                            }
                            if attnKind(d) == "q" {
                                HStack(spacing: 3) {
                                    Image(systemName: "questionmark.bubble.fill").font(.system(size: 13))
                                    Text("ASK").font(.system(size: 13)).bold()
                                }
                                .foregroundColor(.yellow)
                                .shadow(color: "#FFCC00", radius: 5, x: 0, y: 0)
                                .fixedSize()
                                .help(attnLabel(d))
                                .onTapGesture {
                                    cmux("workspace.select", workspace_id: w.id)
                                    cmux("surface.focus", surface_id: ownerOf(d))
                                    cmux("workspace.action",
                                         workspace_id: w.id,
                                         action: "set-description",
                                         description: without(d, attnRow(d)))
                                }
                            }
                            if attnKind(d) == "t" {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(.green)
                                    .fixedSize()
                                    .help("Finished - your turn")
                                    .onTapGesture {
                                        cmux("workspace.action",
                                             workspace_id: w.id,
                                             action: "set-description",
                                             description: without(d, attnRow(d)))
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
                            // No failed count. `subagent.failed` DOES NOT EXIST:
                            // measured across 60 recent sessions, 133
                            // `subagent.started` and 132 `subagent.completed`
                            // were emitted and zero `subagent.failed`. Nor does
                            // `subagent.completed` carry a success flag - its
                            // payload is toolCallId, agentName,
                            // agentDisplayName, model, totalToolCalls,
                            // totalTokens, durationMs. Subagent failure is not
                            // observable, so a failure badge can only ever be
                            // rendered from a hand-written fixture, which is
                            // exactly how it survived this long.
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
                    .padding(4)
                    .onTapGesture { cmux("workspace.select", workspace_id: w.id) }
                    .contextMenu {
                        Button("Move to Top") { cmux("workspace.action", action: "move_top", workspace_id: w.id) }
                        Button("Move Up") { cmux("workspace.action", action: "move_up", workspace_id: w.id) }
                        Button("Move Down") { cmux("workspace.action", action: "move_down", workspace_id: w.id) }
                        Button(w.pinned ? "Unpin" : "Pin") { cmux("workspace.action", action: w.pinned ? "unpin" : "pin", workspace_id: w.id) }
                        Button("Mark as Read") { cmux("workspace.action", action: "mark_read", workspace_id: w.id) }
                        Button("New Tab") { cmux("surface.create", workspace_id: w.id, focus: true) }
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
                                        if anyRunning(d) {
                                            ZStack {
                                                Capsule().fill(.accentColor).frame(width: 4, height: 15)
                                                    .rotationEffect(.degrees(45)).offset(x: -11, y: -6)
                                                if cued(d, clock.epoch, 0) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 10, y: -7)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 10, y: -7).opacity(0.35)
                                                }
                                                if cued(d, clock.epoch, 1) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 12, y: 1)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 12, y: 1).opacity(0.35)
                                                }
                                                if cued(d, clock.epoch, 2) {
                                                    Circle().fill(.accentColor).frame(width: 6, height: 6).offset(x: 10, y: 9)
                                                } else {
                                                    Circle().fill(.secondary).frame(width: 5, height: 5).offset(x: 10, y: 9).opacity(0.35)
                                                }
                                                Circle().fill(.primary).frame(width: 4, height: 4).offset(x: -3, y: -13)
                                                Rectangle().fill(.primary).frame(width: 2, height: 4).offset(x: -3, y: -9)
                                                RoundedRectangle(cornerRadius: 5).fill(.primary).frame(width: 17, height: 14).offset(x: -3)
                                                RoundedRectangle(cornerRadius: 3).fill(.black).frame(width: 11, height: 7).offset(x: -3)
                                                if eyesOpen(d) {
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
                                                if eyesOpen(d) {
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
                                Spacer(minLength: 4)
                                if let dir = t.directory {
                                    Text(baseName(dir))
                                        .font(.system(size: 10)).fontDesign(.monospaced)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                        .fixedSize()
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
                                                .lineLimit(1)
                                                .fixedSize()
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
                                            .help(title)
                                            .onTapGesture {
                                                cmux("workspace.select", workspace_id: w.id)
                                                cmux("surface.focus", surface_id: t.id)
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
            .padding(2)
        }
    }
    .padding(.bottom, 40)
    .offset(y: -16)
}
