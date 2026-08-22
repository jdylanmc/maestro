// Maestro - what your agents are actually doing.
//
// The subagent tree arrives through the workspace description, which the
// plugin writes as indented text:
//
//     > folk-lyricist
//       v research-scan
//     x lint-fixer
//
// Two spaces per level, a leading glyph for status.
//
// Two constraints learned the hard way, both from the authoring guide:
//   - optional fields are ABSENT, not null, so every access uses `if let`.
//     Filtering the collection on `description != nil` yields an empty sidebar.
//   - modifier arguments must be literals or tokens. A computed
//     `.padding(.leading, depth * 9)` renders nothing at all, silently, so
//     indentation is carried as text instead.

func glyphSymbol(_ g: String) -> String {
    return g == "v" ? "checkmark" : g == "x" ? "xmark" : "circle.fill"
}

func glyphTint(_ g: String) -> String {
    return g == "v" ? "#A3BE8C" : g == "x" ? "#BF616A" : "#EBCB8B"
}

func indentOf(_ line: String) -> String {
    return line.hasPrefix("      ") ? "      "
         : line.hasPrefix("    ") ? "    "
         : line.hasPrefix("  ") ? "  "
         : ""
}

func labelOf(_ parts: [String]) -> String {
    return parts.dropFirst().reduce("") { $0 == "" ? $1 : $0 + " " + $1 }
}

VStack(alignment: .leading, spacing: 8) {

    HStack(spacing: 6) {
        Image(systemName: "point.3.connected.trianglepath.dotted")
            .foregroundColor("#88C0D0")
        Text("Maestro").font(.headline)
        Spacer()
        Text("\(workspaces.count)")
            .font(.caption).monospacedDigit().foregroundColor(.secondary)
    }
    Divider()

    ForEach(workspaces) { w in
        VStack(alignment: .leading, spacing: 2) {

            Button(action: { cmux("workspace.select", workspace_id: w.id) }) {
                HStack(spacing: 6) {
                    Text(w.selected ? "●" : "○")
                        .font(.system(size: 9))
                        .foregroundColor(w.selected ? "#88C0D0" : "#4C566A")
                    Text(w.title)
                        .font(.system(size: 12))
                        .fontWeight(w.selected ? .semibold : .regular)
                        .lineLimit(1)
                    Spacer()
                }
            }

            if let b = w.branch {
                HStack(spacing: 4) {
                    Text("   ")
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 9)).foregroundColor("#4C566A")
                    Text(b)
                        .font(.system(size: 10)).fontDesign(.monospaced)
                        .foregroundColor(.secondary).lineLimit(1)
                    Spacer()
                }
            }

            if let d = w.description {
                ForEach(d.split(separator: "\n")) { line in
                    let parts = line.split(separator: " ")
                    if parts.count > 1 {
                        HStack(spacing: 4) {
                            Text("   " + indentOf(String(line)))
                                .font(.system(size: 11)).fontDesign(.monospaced)
                            Image(systemName: glyphSymbol(String(parts[0])))
                                .font(.system(size: 8))
                                .foregroundColor(glyphTint(String(parts[0])))
                            Text(labelOf(parts.map { String($0) }))
                                .font(.system(size: 11))
                                .lineLimit(1)
                            Spacer()
                        }
                    }
                }
            }
        }
        .padding(.vertical, 3)
    }

    Spacer()
}.padding(10)
