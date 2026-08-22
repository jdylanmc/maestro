// Maestro - what your agents are actually doing.
//
// The subagent tree arrives through the workspace description as ONE line,
// rows separated by a literal delimiter, each row three space-separated parts:
//
//     0 > folk-lyricist¦1 v research-scan¦0 x lint-fixer
//     ^ ^ ^
//     | | name
//     | status: > running, v done, x failed
//     depth
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

func nameOf(_ row: String) -> String {
    return row.split(separator: " ").map { String($0) }.dropFirst(2)
        .reduce("") { $0 == "" ? $1 : $0 + " " + $1 }
}

func rowsOf(_ d: String) -> [String] {
    return d.split(separator: "¦").map { String($0) }
}

/** Subagent rows, running and recently finished alike.
 *
 *  A finished row is NOT dropped here any more. The plugin retires it after
 *  RETAIN_MS (15 minutes), so a completed subagent greys out and lingers
 *  instead of vanishing the instant it lands - which made short-lived work
 *  impossible to see at all.
 *
 *  Attention rows (depth token "!") are NOT subagents and are excluded; they
 *  are rendered on the workspace row instead. Without this they would draw as
 *  tree rows with a "p" glyph. */
func liveRows(_ d: String) -> [String] {
    return rowsOf(d).filter { part($0, 0) != "!" && part($0, 0) != "@" }
}

/** The surface id that owns this workspace's subagent tree, or "" when the
 *  plugin did not publish one. See encodeOwner in src/tree.ts. */
func ownerOf(_ d: String) -> String {
    let hits = rowsOf(d).filter { part($0, 0) == "@" }
    return hits.count > 0 ? part(hits[0], 2) : ""
}

/** The description with one row removed, for click-to-dismiss.
 *
 *  There is no hover state to lean on: the upstream sidebar guide is explicit
 *  that "input is limited to forwarded clicks (no hover, focus, or keyboard)".
 *  So a finished agent cannot be crossed out on hover - it is simply tappable,
 *  and tapping removes it.
 *
 *  `reduce` is used to rejoin because it is the same construct `nameOf` already
 *  relies on; `joined(separator:)` is undocumented here and untested. */
func without(_ d: String, _ row: String) -> String {
    return rowsOf(d).filter { $0 != row }
        .reduce("") { $0 == "" ? $1 : $0 + "¦" + $1 }
}

/** Subagents hang off their owning Copilot surface, so they indent one level
 *  deeper than the tab row they belong to. */
func treeIndent(_ row: String) -> Int {
    let d = part(row, 0)
    return d == "0" ? 44 : d == "1" ? 61 : d == "2" ? 79 : d == "3" ? 97 : 114
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

/** Attention pulse, 1 Hz. There is no animation system in this interpreter -
 *  no `withAnimation`, `.animation`, `.transition`, or `symbolEffect` - and the
 *  sidebar re-renders roughly once a second, so a value recomputed from `clock`
 *  is the ONLY way to make anything move. This alternates rather than eases,
 *  because there is no in-between frame to ease through. */
func pulse(_ s: Int) -> Double {
    return s % 2 == 0 ? 1.0 : 0.55
}

func spin(_ s: Int) -> String {
    return ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][s % 10]
}

func indent(_ row: String) -> Int {
    let d = part(row, 0)
    return d == "0" ? 31 : d == "1" ? 48 : d == "2" ? 66 : d == "3" ? 84 : 101
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

    // No title row. The pane's own tab already reads "maestro", so a header
    // here spent ~40pt of vertical space restating it.

    ScrollView {
        VStack(alignment: .leading, spacing: 2) {
            Reorderable(workspaces, move: "workspace.reorder") { w in
                VStack(alignment: .leading, spacing: 3) {

                    HStack(spacing: 5) {
                        Image(systemName: "folder.fill")
                            .imageScale(.small)
                            .foregroundColor(w.selected ? .accentColor : .secondary)
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
                                .opacity(pulse(clock.second))
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
                                .opacity(pulse(clock.second))
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
                                    Text(spin(clock.second)).font(.system(size: 12)).bold()
                                    Text("\(countOf(d, ">"))")
                                        .font(.system(size: 12)).bold().monospacedDigit()
                                }
                                .foregroundColor(.green)
                                .shadow(color: "#30D158", radius: 4, x: 0, y: 0)
                                .fixedSize()
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
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Spacer().frame(width: 12)
                                Image(systemName: "terminal")
                                    .imageScale(.small)
                                    .foregroundColor(t.focused && w.selected ? .accentColor : .secondary)
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
                        .onTapGesture {
                            cmux("workspace.select", workspace_id: w.id)
                            cmux("surface.focus", surface_id: t.id)
                        }

                            // The subagent tree belongs to the Copilot session
                            // that produced it, not to the workspace. It renders
                            // inside this tab only when the plugin published
                            // this surface as the owner.
                            if let d = w.description {
                                if ownerOf(d) == t.id {
                                    ForEach(liveRows(d).prefix(10)) { row in
                                        HStack(spacing: 6) {
                                            Spacer().frame(width: treeIndent(row))
                                            if part(row, 1) == ">" {
                                                Text(spin(clock.second))
                                                    .font(.system(size: 12)).bold()
                                                    .foregroundColor(.green)
                                                    .frame(width: 12)
                                            } else {
                                                Image(systemName: "checkmark")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(.secondary)
                                                    .frame(width: 12)
                                            }
                                            Text(nameOf(row))
                                                .font(.system(size: 12))
                                                .foregroundColor(part(row, 1) == "v" ? .secondary : .primary)
                                                .lineLimit(1).truncationMode(.tail)
                                            Spacer(minLength: 0)
                                        }
                                        .padding(4)
                                        .help(part(row, 1) == "v" ? "Click to dismiss" : nameOf(row))
                                        .onTapGesture {
                                            cmux("workspace.action",
                                                 workspace_id: w.id,
                                                 action: "set-description",
                                                 description: without(d, row))
                                        }
                                    }
                                    if liveRows(d).count > 10 {
                                        HStack(spacing: 6) {
                                            Spacer().frame(width: 44)
                                            Text("+ \(liveRows(d).count - 10) more")
                                                .font(.caption2).foregroundColor(.secondary)
                                            Spacer(minLength: 0)
                                        }
                                        .padding(4)
                                    }
                                }
                            }
                    }
                }
                .padding(2)
            }
        }
    }
}
