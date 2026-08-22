// Maestro sidebar - Fleets and their subagent trees.
//
// cmux interpreted sidebars bind only to cmux's own model; they cannot read
// files or start processes. The subagent tree therefore arrives through the
// workspace DESCRIPTION, which `maestro watch` encodes as one line per node:
//
//     <depth>|<status>|<name>|<kind>
//
// status is one of: run, ok, fail. Depth is 0-based from the primary agent.
// A workspace with no encoded tree simply renders as a plain Fleet row.

let fleets = workspaces.filter { $0.description != nil }
let plain = workspaces.filter { $0.description == nil }

func glyph(_ s: String) -> String {
    return s == "ok" ? "checkmark.circle.fill"
         : s == "fail" ? "xmark.octagon.fill"
         : "play.circle.fill"
}

func tint(_ s: String) -> String {
    return s == "ok" ? "#A3BE8C" : s == "fail" ? "#BF616A" : "#EBCB8B"
}

VStack(alignment: .leading, spacing: 6) {
    HStack {
        Image(systemName: "square.stack.3d.up.fill").foregroundColor("#88C0D0")
        Text("Maestro").font(.title3).bold()
        Spacer()
        Text("\(workspaces.count)").font(.caption).foregroundColor(.secondary)
    }
    Divider()

    ForEach(fleets) { w in
        VStack(alignment: .leading, spacing: 2) {
            Button(action: { cmux("workspace.select", workspace_id: w.id) }) {
                HStack(spacing: 6) {
                    Text(w.selected ? "●" : "○")
                        .foregroundColor(w.selected ? "#88C0D0" : .secondary)
                    Text(w.title).bold().lineLimit(1)
                    Spacer()
                    if w.unread > 0 {
                        Text("\(w.unread)")
                            .font(.caption).monospacedDigit()
                            .padding(3).background("#BF616A").cornerRadius(4)
                    }
                }
            }

            if let b = w.branch {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.caption).foregroundColor(.secondary)
                    Text(b).font(.caption).fontDesign(.monospaced)
                        .foregroundColor(.secondary).lineLimit(1)
                    if w.dirty { Text("*").foregroundColor("#EBCB8B") }
                }.padding(.leading, 14)
            }

            // The subagent tree.
            if let d = w.description {
                ForEach(d.split(separator: "\n").prefix(40)) { line in
                    let f = line.split(separator: "|")
                    if f.count > 3 {
                        HStack(spacing: 5) {
                            Text(String(repeating: "  ", count: min(Int(f[0]) , 6)))
                            Image(systemName: glyph(String(f[1])))
                                .font(.caption).foregroundColor(tint(String(f[1])))
                            Text(String(f[2])).font(.caption).lineLimit(1)
                            Text(String(f[3])).font(.caption)
                                .foregroundColor(.secondary).lineLimit(1)
                            Spacer()
                        }.padding(.leading, 18)
                    }
                }
            }
        }.padding(.vertical, 3)
    }

    if plain.count > 0 {
        Divider()
        Text("Terminals").font(.caption).textCase(.uppercase)
            .foregroundColor(.secondary)
        ForEach(plain.prefix(12)) { w in
            Button(action: { cmux("workspace.select", workspace_id: w.id) }) {
                HStack(spacing: 6) {
                    Text(w.selected ? "●" : "○")
                        .foregroundColor(w.selected ? "#88C0D0" : .secondary)
                    Text(w.title).lineLimit(1).foregroundColor(.secondary)
                    Spacer()
                }
            }
        }
    }
    Spacer()
}.padding(8)
