import SwiftUI

struct ChallengeScreen: View {
    var id: String
    @State private var remote: Remote<ChallengeDetail>

    init(id: String) {
        self.id = id
        _remote = State(initialValue: Remote<ChallengeDetail>("/challenges/\(id)"))
    }

    var body: some View {
        Group {
            if let detail = remote.data {
                ChallengeContent(detail: detail, onChange: { new in withAnimation(Motion.wave) { remote.data = new } })
            } else {
                Page { Waiting(error: remote.error, heights: [40, 76, 110, 160]) { Task { await remote.load() } } }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .loads(remote)
    }
}

/** The one place a challenge lives. Read only (an invite preview) hides logging, inviting and managing. */
struct ChallengeContent<Footer: View>: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    var eyebrow: String? = nil
    @ViewBuilder var footer: Footer

    private enum SheetKind: String, Identifiable { case propose, invite, manage; var id: String { rawValue } }

    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var sheet: SheetKind?
    @State private var busy: String?
    @State private var error: String?
    @State private var recap: String?
    @State private var party = 0
    @Environment(\.dynamicTypeSize) private var dynamicType

    private var live: Bool { !detail.you.readOnly }

    private var statusTag: String {
        switch detail.status {
        case "waiting": "⏳ Waiting for crew"
        case "done": "🏁 Finished"
        default: "🔥 Live"
        }
    }

    var body: some View {
        Page {
            PhotoBanner(name: detail.type, emoji: Catalog.emoji(detail.type), height: 170, fadeTo: Palette.page)
                .clipShape(.rect(cornerRadius: Metrics.radius))
                .overlay(alignment: .topLeading) {
                    Text(statusTag)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .glassEffect(.regular, in: .capsule)
                        .padding(12)
                }
                .overlay(alignment: .bottomLeading) {
                    EmojiBadge(emoji: Catalog.emoji(detail.type), size: 60, tint: Palette.card)
                        .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
                        .bobbing()
                        .padding(.leading, 14)
                        .offset(y: 18)
                }
                .padding(.bottom, 10)
                .settles(0)

            VStack(alignment: .leading, spacing: 4) {
                if let eyebrow { Text("👋 \(eyebrow)").font(.label).foregroundStyle(Palette.stone) }
                Text(detail.name).font(.display)
                Text(detail.targetText).foregroundStyle(Palette.stone)
                if let goal = detail.yourGoalText { Text("Your goal: \(goal)").font(.footnote).foregroundStyle(Palette.stone) }
            }
            .settles(0)

            if let me = detail.standings.first(where: \.isYou), detail.status != "done" {
                YourProgressCard(row: me, waiting: detail.status == "waiting").settles(1)
            }

            if detail.standings.count >= 2, detail.status == "live", let leader = detail.standings.first, leader.percent > 0 {
                HStack(spacing: Metrics.gap) {
                    Text("👑").font(.title2).bobbing().accessibilityHidden(true)
                    Text(leader.isYou ? "You're in the lead. Keep it that way." : "\(leader.name) is in the lead.")
                        .font(.label)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Metrics.card)
                .padding(.vertical, 14)
                .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                .settles(1)
            }

            if detail.standings.count >= 2 {
                Group {
                    if dynamicType.isAccessibilitySize {
                        VStack(spacing: 8) { hero(stacked: true) }
                    } else {
                        HStack(spacing: 8) { hero(stacked: false) }
                    }
                }
                .settles(1)
            }

            if let recap {
                Card {
                    HStack(alignment: .top, spacing: Metrics.gap) {
                        Image(systemName: "apple.intelligence")
                            .font(.title3)
                            .foregroundStyle(LinearGradient(colors: [.orange, .pink, .purple, .blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .symbolEffect(.breathe, options: .nonRepeating)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(recap)
                            Text("Written on this iPhone by Apple Intelligence").font(.footnote).foregroundStyle(Palette.stone)
                        }
                    }
                }
                .transition(.liquid)
            }

            if let result = detail.resultText {
                Card {
                    if detail.winnerName != nil { Trophy3D(height: 170).frame(maxWidth: .infinity) }
                    HStack(spacing: Metrics.gap) {
                        Image(systemName: detail.winnerName != nil ? "trophy.fill" : "flag.checkered")
                            .font(.title2)
                            .foregroundStyle(Palette.accent)
                        Text(result).font(.label)
                    }
                }
                .settles(2)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("🗓️ \(detail.daysLeftText)").font(.label).accessibilityLabel(detail.daysLeftText)
                    Spacer()
                    Text(detail.rangeText).font(.footnote).foregroundStyle(Palette.stone)
                }
                LiquidBar(fraction: detail.timeFraction, fill: Palette.ink, height: 6)
            }
            .settles(2)

            if live, detail.members.count < 2, detail.status != "done" {
                Card {
                    HStack(spacing: Metrics.gap) {
                        SymbolArt(symbol: "person.2.fill", size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Better with friends 👯").font(.headline).accessibilityLabel("Better with friends")
                            Text("Invite a friend and make it a real contest.").font(.subheadline).foregroundStyle(Palette.stone)
                        }
                    }
                    SecondaryButton(title: "Invite your crew", symbol: "person.badge.plus") { sheet = .invite }
                }
                .settles(2)
            }

            consequenceCard.settles(3)

            if detail.rename != nil {
                RenameCard(detail: detail, onChange: onChange).settles(4)
            }

            VStack(alignment: .leading, spacing: Metrics.gap) {
                Text("🏅 Standings").font(.heading).accessibilityLabel("Standings")
                VStack(spacing: 4) {
                    ForEach(Array(detail.standings.enumerated()), id: \.element.id) { i, row in
                        StandingRow(row: row, medals: detail.standings.count >= 2).settles(i + 1)
                    }
                }
                .padding(8)
                .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
            }
            .settles(5)

            ForEach(detail.alerts, id: \.self) { alert in
                Card {
                    Label(alert, systemImage: "bell.badge.fill").symbolRenderingMode(.multicolor)
                }
            }

            VStack(alignment: .leading, spacing: Metrics.gap) {
                Text("👥 Crew").font(.heading).accessibilityLabel("Crew")
                Card {
                    HStack {
                        AvatarStack(people: Array(detail.members.prefix(6)), total: detail.members.count, size: 36)
                        Spacer()
                        if live { SecondaryButton(title: "Invite more", symbol: "person.badge.plus", compact: true) { sheet = .invite } }
                    }
                }
            }
            .settles(6)

            if sheet == nil { ErrorLine(text: error) }
            if detail.you.commissioner {
                TextButton(title: "Manage challenge") { sheet = .manage }
            }
        } footer: {
            if Footer.self == EmptyView.self {
                if live {
                    PrimaryButton(title: "Log today", symbol: "plus.circle.fill") { router.logging = detail.id }
                }
            } else {
                footer
            }
        }
        // A win is worth a party: once per challenge on this phone, the first time its result is seen.
        .overlay { ConfettiBurst(trigger: party, emoji: ["🏆", "🎉", "👑"]) }
        .onAppear {
            if detail.you.result == "won", Splash.claim("won:\(detail.id)") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { party += 1 }
            }
        }
        .animation(Motion.wave, value: recap)
        .task(id: detail) { recap = await Intelligence.recap(detail) }
        .sheet(item: $sheet) { kind in
            switch kind {
            case .propose: ProposeSheet(detail: detail, onChange: onChange)
            case .invite: InviteSheet(detail: detail)
            case .manage: ManageSheet(detail: detail, onChange: onChange)
            }
        }
    }

    @ViewBuilder private func hero(stacked: Bool) -> some View {
        HeroStat(value: detail.hero.rank, label: "Rank", stacked: stacked)
        HeroStat(value: detail.hero.progress, label: "Progress", stacked: stacked)
        HeroStat(value: detail.hero.people, label: "People", stacked: stacked)
    }

    @ViewBuilder private var consequenceCard: some View {
        Card(tint: true) {
            Text("🎯 Consequence").font(.heading).accessibilityLabel("Consequence")
            if let c = detail.consequence {
                if c.status == "none" {
                    Text("🤝 Nothing agreed yet")
                    if live { SecondaryButton(title: "Propose one", compact: true) { sheet = .propose } }
                } else {
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: Copy.consequenceEmoji(c.text ?? ""), size: 40, tint: Palette.card)
                        Text(c.text ?? "")
                    }
                    if c.status == "agreed" {
                        Label("Agreed", systemImage: "checkmark.seal.fill").font(.label).foregroundStyle(Palette.accent)
                            .symbolEffect(.bounce, value: c.status)
                    } else {
                        Text(c.youProposed ? "Proposed by you" : "Proposed by \(c.proposedBy ?? "someone")").font(.footnote)
                        if live && c.youAgreed {
                            Text(c.waitingOn > 0 ? "Waiting on \(c.waitingOn) more to agree" : "Your crew votes once they join").font(.footnote)
                        }
                        if live {
                            HStack {
                                if !c.youAgreed {
                                    SecondaryButton(title: "Agree", symbol: "hand.thumbsup.fill", busy: busy == "agree", compact: true) {
                                        Task { await act("agree", "/consequence/agree") }
                                    }
                                }
                                SecondaryButton(title: "Suggest another", compact: true) { sheet = .propose }
                            }
                        }
                    }
                }
            } else {
                Text("😎 No consequence on this one. Just bragging rights.")
            }
        }
    }

    private func act(_ key: String, _ path: String, _ body: [String: Any] = [:]) async {
        busy = key
        error = nil
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)\(path)", body: body)
            Haptic.success()
            onChange(next)
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
        }
        busy = nil
    }
}

/** Where you stand, as a ring that fills, with a line that fits how far along you are. */
private struct YourProgressCard: View {
    var row: Standing
    var waiting: Bool
    @State private var shown = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduce

    private var cheer: String {
        if row.onTheHook { return "You're on the hook 🪝 Time to move." }
        switch row.percent {
        case 100...: return "Done! Nothing left but bragging 🎉"
        case 50..<100: return "Over halfway. Don't let up 🔥"
        case 1..<50: return "Good start. Keep it moving 💪"
        default: return waiting ? "Get a head start while your crew joins 👟" : "Log your first one today 👟"
        }
    }

    var body: some View {
        Card {
            HStack(spacing: Metrics.card) {
                ZStack {
                    Circle().stroke(Palette.track, lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: shown)
                        .stroke(row.complete ? Palette.done : Palette.signal, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    CountUp(value: row.percent, suffix: "%")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .contentTransition(.numericText())
                }
                .frame(width: 84, height: 84)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your progress").font(.label).foregroundStyle(Palette.stone)
                    Text(row.label).font(.heading)
                    Text(cheer).font(.subheadline)
                }
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your progress: \(row.label), \(row.percent) percent.")
        .onAppear { withAnimation(reduce ? nil : Motion.wave.delay(0.25)) { shown = min(1, row.fraction) } }
        .onChange(of: row.fraction) { _, f in withAnimation(reduce ? nil : Motion.wave) { shown = min(1, f) } }
    }
}

private struct HeroStat: View {
    var value: String
    var label: String
    var stacked: Bool

    var body: some View {
        Group {
            if stacked {
                HStack {
                    Text(label).font(.footnote).foregroundStyle(Palette.stone)
                    Spacer()
                    Text(value).font(.heading)
                }
            } else {
                VStack(spacing: 2) {
                    Text(value).font(.heading).lineLimit(1).minimumScaleFactor(0.6).contentTransition(.numericText())
                    Text(label).font(.footnote).foregroundStyle(Palette.stone)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, stacked ? Metrics.card : 8)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        .accessibilityElement(children: .combine)
    }
}

private struct StandingRow: View {
    var row: Standing
    var medals = false
    private var medal: String? { medals && (1...3).contains(row.rank) && row.percent > 0 ? ["🥇", "🥈", "🥉"][row.rank - 1] : nil }

    var body: some View {
        HStack(spacing: 10) {
            if let medal {
                Text(medal).font(.title3).frame(width: 26).popIn(delay: 0.4 + Double(row.rank) * 0.12).accessibilityHidden(true)
            } else {
                Text("\(row.rank)")
                    .font(.caption.weight(.semibold))
                    .frame(width: 22, height: 22)
                    .overlay(Circle().strokeBorder(Palette.line, lineWidth: 1.5))
                    .frame(width: 26)
            }
            AvatarView(person: row.person, size: 40)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(row.name).font(.label).lineLimit(1)
                    if row.onTheHook {
                        Text("🪝 On the hook").font(.caption.weight(.medium)).foregroundStyle(Palette.accent)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Palette.signalTint, in: .capsule)
                    }
                    Spacer(minLength: 4)
                    Text("\(row.percent)%").font(.label).contentTransition(.numericText())
                }
                LiquidBar(fraction: row.fraction, fill: row.complete ? Palette.done : Palette.signal, height: 8)
                HStack(spacing: 10) {
                    Text(row.label)
                    if let delta = row.delta {
                        Label("\(delta) this week", systemImage: delta.hasPrefix("-") ? "arrow.down.right" : "arrow.up.right")
                    }
                    if let goal = row.goalText { Text("Goal: \(goal)") }
                }
                .font(.footnote)
                .foregroundStyle(Palette.stone)
            }
        }
        .padding(12)
        .overlay(RoundedRectangle(cornerRadius: Metrics.radius - 4).strokeBorder(row.isYou ? Palette.ink : .clear, lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rank \(row.rank). \(row.name)\(row.isYou ? ", you" : ""). \(row.percent) percent. \(row.label).\(row.onTheHook ? " On the hook." : "")")
    }
}

// ---------- sheets ----------

private struct ProposeSheet: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap * 1.5) {
                Text("Consequence for last place?").font(.heading)
                ConsequencePicker(value: $draft, context: "\(detail.name), \(detail.targetText)")
                Text("Your crew votes on this. No money, nothing mean.").font(.footnote).foregroundStyle(Palette.stone)
                ErrorLine(text: error)
                PrimaryButton(title: "Propose it", busy: busy, disabled: draft.trimmed.isEmpty || Copy.consequenceProblem(draft) != nil) {
                    Task {
                        busy = true
                        do {
                            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/consequence", body: ["text": draft])
                            onChange(next)
                            Haptic.success()
                            dismiss()
                        } catch {
                            self.error = error.localizedDescription
                        }
                        busy = false
                    }
                }
            }
            .padding(Metrics.screen)
        }
        .presentationDetents([.medium, .large])
    }
}

private struct InviteSheet: View {
    var detail: ChallengeDetail
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap) {
                Text("Invite your crew").font(.heading)
                InviteComposer(
                    spec: .init(type: detail.type, target: detail.target, per: detail.per, lengthDays: detail.lengthDays, name: detail.name, consequence: detail.consequence?.text),
                    getToken: {
                        let r: TokenResponse = try await api.send("/challenges/\(detail.id)/invite", body: [:])
                        return r.token
                    },
                    onFinish: { dismiss() })
            }
            .padding(Metrics.screen)
        }
        .presentationDetents([.medium, .large])
    }
}

private struct ManageSheet: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var busy: String?
    @State private var error: String?
    @State private var confirmEnd = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if detail.manage.isEmpty {
                        Text("Nobody else is in yet.").foregroundStyle(Palette.stone)
                    }
                    ForEach(detail.manage) { p in
                        HStack {
                            AvatarView(person: p.person, size: 36)
                            Text(p.name)
                            Spacer()
                            if p.pending {
                                Text("Alert sent").font(.footnote).foregroundStyle(Palette.stone)
                            } else if busy == p.id {
                                ProgressView()
                            } else {
                                Button("Remove", role: .destructive) { Task { await act(p.id, "/removals", ["userId": p.id]) } }
                            }
                        }
                    }
                } header: {
                    Text("Remove someone")
                } footer: {
                    Text("Your crew gets an alert first. They're removed after a day unless they log.")
                }
                if let error { Section { ErrorLine(text: error) } }
                Section {
                    Button("End challenge early", role: .destructive) { confirmEnd = true }
                }
            }
            .navigationTitle("Manage challenge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done", systemImage: "checkmark") { dismiss() } } }
            .confirmationDialog("End it now?", isPresented: $confirmEnd, titleVisibility: .visible) {
                Button("End challenge", role: .destructive) { Task { if await act("end", "/end") { dismiss() } } }
                Button("Keep going", role: .cancel) {}
            } message: {
                Text("Standings lock and results are final.")
            }
        }
    }

    @discardableResult
    private func act(_ key: String, _ path: String, _ body: [String: Any] = [:]) async -> Bool {
        busy = key
        defer { busy = nil }
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)\(path)", body: body)
            onChange(next)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}

/** The last name punishment, once the challenge is over. */
struct RenameCard: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @State private var drafts: [String: String] = [:]
    @State private var busy: String?
    @State private var error: String?

    var body: some View {
        if let rename = detail.rename {
            let winner = detail.winnerName ?? "The winner"
            Card {
                Text(rename.canSet ? "Pick a new last name" : "New last name").font(.heading)
                ForEach(rename.targets) { t in
                    switch t.status {
                    case "active":
                        Text("\(t.isYou ? "You're \(t.newName ?? "")" : "\(t.name) is now \(t.newName ?? "")") until \(Copy.shortDate(t.until ?? "")).")
                    case "over":
                        Text("\(t.isYou ? "Your" : "\(t.name)'s") new last name has run its course.")
                    default:
                        if !rename.canSet {
                            Text("\(winner) gets to pick \(t.isYou ? "your" : "\(t.name)'s") new last name.")
                        } else {
                            let draft = drafts[t.id] ?? ""
                            let valid = Copy.cleanLastName(draft) != nil
                            VStack(alignment: .leading, spacing: 8) {
                                Text("\(t.name) is on the hook. Give \(t.name) any last name you like. It lasts a week.")
                                RallyField(placeholder: "New last name", text: Binding(get: { drafts[t.id] ?? "" }, set: { drafts[t.id] = $0; error = nil }), capitalization: .words, maxLength: 20)
                                ErrorLine(text: !draft.trimmed.isEmpty && !valid ? "Letters only, up to 20." : error)
                                PrimaryButton(title: "Change \(t.name)'s last name", busy: busy == t.id, disabled: !valid) {
                                    Task {
                                        busy = t.id
                                        do {
                                            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/rename", body: ["userId": t.id, "lastName": draft])
                                            Haptic.success()
                                            onChange(next)
                                        } catch {
                                            self.error = error.localizedDescription
                                        }
                                        busy = nil
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
