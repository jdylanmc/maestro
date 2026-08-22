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

/** Only rows that still want attention. A completed subagent is history: it
 *  collapses into the done count on the workspace row, because a finished
 *  29-agent run otherwise buries every other workspace in the sidebar. */
func liveRows(_ d: String) -> [String] {
    return rowsOf(d).filter { part($0, 1) != "v" }
}

func countOf(_ d: String, _ g: String) -> Int {
    return rowsOf(d).filter { part($0, 1) == g }.count
}

func spin(_ s: Int) -> String {
    return ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][s % 10]
}

func indent(_ row: String) -> Int {
    let d = part(row, 0)
    return d == "0" ? 28 : d == "1" ? 44 : d == "2" ? 60 : d == "3" ? 76 : 92
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

    HStack(spacing: 6) {
        Image(systemName: "point.3.connected.trianglepath.dotted")
            .imageScale(.small).foregroundColor(.accentColor)
        Text("Maestro").font(.title3).bold()
        Spacer()
    }.padding(6)

    Spacer().frame(height: 8)

    ScrollView {
        VStack(alignment: .leading, spacing: 2) {
            Reorderable(workspaces, move: "workspace.reorder") { w in
                VStack(alignment: .leading, spacing: 3) {

                    HStack(spacing: 5) {
                        Image(systemName: "folder.fill")
                            .imageScale(.small)
                            .foregroundColor(w.selected ? .accentColor : .secondary)
                        Text(w.title)
                            .font(.callout).bold()
                            .lineLimit(1).truncationMode(.tail).layoutPriority(1)
                        if w.pinned {
                            Image(systemName: "pin.fill")
                                .imageScale(.small)
                                .foregroundColor(.orange)
                                .rotationEffect(.degrees(45))
                        }
                        if let b = w.branch {
                            Image(systemName: "arrow.triangle.branch")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                                .fixedSize()
                            Text(b)
                                .font(.system(size: 10)).fontDesign(.monospaced)
                                .foregroundColor(.secondary)
                                .lineLimit(1).truncationMode(.tail)
                                .fixedSize()
                            if w.dirty {
                                Circle().fill(.orange).frame(width: 4, height: 4).fixedSize()
                            }
                        }
                        Spacer(minLength: 3)
                        if let d = w.description {
                            if countOf(d, ">") > 0 {
                                HStack(spacing: 3) {
                                    Text(spin(clock.second)).font(.system(size: 9)).bold()
                                    Text("\(countOf(d, ">"))")
                                        .font(.system(size: 9)).bold().monospacedDigit()
                                }
                                .foregroundColor(.orange)
                                .padding(2)
                                .background { Capsule().fill(.quaternary) }
                                .fixedSize()
                            }
                            if countOf(d, "x") > 0 {
                                Text("\(countOf(d, "x"))")
                                    .font(.system(size: 9)).bold().monospacedDigit()
                                    .foregroundColor(.red)
                                    .padding(2)
                                    .background { Capsule().fill(.quaternary) }
                                    .fixedSize()
                            }
                            if countOf(d, "v") > 0 {
                                Text("\(countOf(d, "v"))")
                                    .font(.system(size: 9)).monospacedDigit()
                                    .foregroundColor(.secondary)
                                    .fixedSize()
                            }
                        }
                        if w.index < 9 {
                            Text("⌘\(w.index + 1)")
                                .font(.system(size: 8)).foregroundColor(.secondary)
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
                                        .font(.system(size: 9)).fontDesign(.monospaced)
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
                                            .font(.system(size: 9)).fontDesign(.monospaced)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1).truncationMode(.tail)
                                        if let tb = t.branch {
                                            Image(systemName: "arrow.triangle.branch")
                                                .font(.system(size: 8))
                                                .foregroundColor(.secondary)
                                                .fixedSize()
                                            Text(tb)
                                                .font(.system(size: 9)).fontDesign(.monospaced)
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
                    }

                    if let d = w.description {
                        ForEach(liveRows(d).prefix(10)) { row in
                            HStack(spacing: 6) {
                                Spacer().frame(width: indent(row))
                                if part(row, 1) == ">" {
                                    Text(spin(clock.second))
                                        .font(.system(size: 11)).bold()
                                        .foregroundColor(.orange)
                                        .frame(width: 12)
                                } else {
                                    Image(systemName: part(row, 1) == "v" ? "checkmark" : "xmark")
                                        .font(.system(size: 9))
                                        .foregroundColor(part(row, 1) == "v" ? .green : .red)
                                        .frame(width: 12)
                                }
                                Text(nameOf(row))
                                    .font(.system(size: 11))
                                    .foregroundColor(part(row, 1) == "v" ? .secondary : .primary)
                                    .lineLimit(1).truncationMode(.tail)
                                Spacer(minLength: 0)
                            }
                            .padding(4)
                        }
                        if liveRows(d).count > 10 {
                            HStack(spacing: 6) {
                                Spacer().frame(width: 12)
                                Text("+ \(liveRows(d).count - 10) more")
                                    .font(.caption2).foregroundColor(.secondary)
                                Spacer(minLength: 0)
                            }.padding(4)
                        }
                    }
                }
                .padding(2)
            }
        }
    }
}
