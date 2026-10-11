import SwiftUI

// When Rally speaks up on its own. The rule for all of it: say one useful thing, at a moment it helps,
// and then stay quiet. At most one nudge each time Home is opened, and no kind of nudge twice in a day.

enum Nudges {
    /** True the first time it is asked about `key` today (or within `days`); false after that. */
    private static func once(_ key: String, days: Int = 1) -> Bool {
        let stored = UserDefaults.standard.double(forKey: "nudge:\(key)")
        let now = Date.now.timeIntervalSince1970
        if days == 1 {
            if stored > 0, Calendar.current.isDateInToday(Date(timeIntervalSince1970: stored)) { return false }
        } else if now - stored < Double(days) * 86400 {
            return false
        }
        UserDefaults.standard.set(now, forKey: "nudge:\(key)")
        return true
    }

    private static var lastHomeNudge = Date.distantPast

    /** Looks at what Home just loaded and shows the single most useful note, if there is one. */
    static func afterHomeLoads(_ home: HomeData, router: Router) async {
        // Not on every pull to refresh: once per stretch of using the app.
        guard Date.now.timeIntervalSince(lastHomeNudge) > 20 * 60, Toaster.shared.current == nil else { return }
        guard let toast = await pick(home, router: router) else { return }
        lastHomeNudge = .now
        // Let the screen settle before anything drops in over it.
        try? await Task.sleep(for: .seconds(1.6))
        Toaster.shared.show(toast)
    }

    private static func pick(_ home: HomeData, router: Router) async -> Toast? {
        if let update = await updateToast() { return update }

        let checkin: CheckinData? = try? await API.shared.send("/checkin")
        let checkedIn = checkin?.checkedIn ?? true
        let hour = Calendar.current.component(.hour, from: .now)
        let goCheckIn = { router.tab = .checkin }

        // 1. A challenge ends today and this period is not done yet.
        if let last = home.challenges.first(where: { $0.daysLeftText == "Last day" && !$0.periodDone && !$0.waiting }), once("lastday:\(last.id)") {
            return Toast(emoji: "🏁", title: "Last day of \(last.name)", detail: "Finish strong.", actionTitle: "Open", action: { router.show(challenge: last.id) }, seconds: 6)
        }
        if !checkedIn {
            // 2. Someone in the crew has already logged today.
            if let friend = home.crew.first(where: \.loggedToday), once("crewlogged") {
                let others = home.crew.filter(\.loggedToday).count - 1
                return Toast(emoji: "👀", title: others > 0 ? "\(friend.name) and \(others) more logged today" : "\(friend.name) logged today",
                             detail: "Your turn?", actionTitle: "Check in", action: goCheckIn, seconds: 6)
            }
            // 3. A streak that ends tonight if nothing is logged.
            if let streak = checkin?.streak, streak >= 2, hour >= 12, once("streak") {
                return Toast(emoji: "📈", title: "Keep your \(streak) day streak going", detail: "Log something today and it lives on.", actionTitle: "Check in", action: goCheckIn, seconds: 6)
            }
            // 4. Evening, and nothing logged yet.
            if hour >= 18, once("evening") {
                return Toast(emoji: "⏰", title: "Still time today", detail: "Logging takes about 20 seconds.", actionTitle: "Check in", action: goCheckIn, seconds: 6)
            }
        }
        // 5. A challenge sitting with nobody else in it.
        if let lonely = home.challenges.first(where: { $0.waiting && $0.memberCount <= 1 }), once("lonely:\(lonely.id)", days: 3) {
            return Toast(emoji: "👯", title: "\(lonely.name) needs a crew", detail: "Invite someone and it becomes a contest.", actionTitle: "Open", action: { router.show(challenge: lonely.id) }, seconds: 6)
        }
        // 6. Nothing to chase: a fun fact, but only for someone who has already done today's part.
        if checkedIn, checkin != nil, once("funfact") {
            return Toast(emoji: "💡", title: "Did you know?", detail: FunFacts.all[(FunFacts.today() + 7) % FunFacts.all.count], seconds: 7)
        }
        return nil
    }

    /** Milestones worth a word, said right after the log that reached them. */
    static func streakReached(_ days: Int) {
        let words: [Int: String] = [3: "Three in a row.", 5: "Five days straight.", 7: "A full week.", 10: "Ten days. Double digits.", 14: "Two weeks straight.",
                                    21: "Three weeks. That's a habit.", 30: "A whole month.", 50: "Fifty days.", 100: "One hundred days."]
        guard let line = words[days], once("streakhit:\(days)", days: 2) else { return }
        Toaster.shared.show(Toast(emoji: "🔥", title: "\(days) day streak", detail: line, seconds: 5))
    }

    // ---------- updates ----------

    static var build: Int { Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0 }

    /** The server knows the newest build testers can get. If this one is older, say so once a day. */
    private static func updateToast() async -> Toast? {
        struct Health: Decodable { var latestBuild: Int? }
        guard let health: Health = try? await API.shared.send("/health"), let latest = health.latestBuild, latest > build, once("update") else { return nil }
        return Toast(emoji: "✨", title: "A new version of Rally is ready", detail: "Update in TestFlight to get it.", actionTitle: "Update", action: {
            // The TestFlight app if it is installed, otherwise its web page.
            let app = URL(string: "itms-beta://")!, web = URL(string: "https://testflight.apple.com/join/Bswcu2b8")!
            UIApplication.shared.open(app, options: [:]) { ok in if !ok { UIApplication.shared.open(web) } }
        }, seconds: 8)
    }
}

// ---------- what's new ----------

/** What changed in the build someone just updated to. Edit `notes` with each release. */
enum WhatsNew {
    struct Note: Identifiable {
        var emoji: String
        var title: String
        var text: String
        var id: String { title }
    }

    /** The build these notes describe. Anyone coming from an older build sees them once. */
    static let build = 5
    static let notes = [
        Note(emoji: "🏅", title: "Medals", text: "Reach your goal in a challenge and you unlock its medal. Win it and it's gold. They live on your Me page."),
        Note(emoji: "📒", title: "Workout details", text: "Add how long, your exercises and weights, and a note when you log. Keep it private or share it with your crew."),
        Note(emoji: "👟", title: "Steps count themselves", text: "Turn it on in Settings and your iPhone's step count goes into your steps challenges for you."),
        Note(emoji: "💡", title: "A little more life", text: "Fun facts after you check in, and a heads-up when a friend logs or a challenge is about to end."),
    ]

    private static let key = "whatsNewSeen"

    /** True once, for someone who already had Rally and has just moved to a build with notes. */
    static func shouldShow(signedIn: Bool) -> Bool {
        let seen = UserDefaults.standard.object(forKey: key) as? Int
        defer { UserDefaults.standard.set(max(build, Nudges.build), forKey: key) }
        // A brand-new install has nothing to compare against: everything is new, so say nothing.
        guard signedIn, Nudges.build >= build else { return false }
        return (seen ?? 0) < build
    }
}

struct WhatsNewSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap * 1.5) {
            VStack(alignment: .leading, spacing: 4) {
                Text("What's new").font(.display)
                Text("Rally just updated.").foregroundStyle(Palette.stone)
            }
            .padding(.top, Metrics.gap)
            ForEach(Array(WhatsNew.notes.enumerated()), id: \.element.id) { i, note in
                HStack(alignment: .top, spacing: Metrics.gap) {
                    EmojiBadge(emoji: note.emoji, size: 44).popIn(delay: 0.25 + Double(i) * 0.12)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(note.title).font(.headline)
                        Text(note.text).font(.subheadline).foregroundStyle(Palette.stone)
                    }
                }
            }
            Spacer(minLength: 0)
            PrimaryButton(title: "Got it") { dismiss() }
        }
        .padding(Metrics.screen)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

/** A fun fact on a card. Tap for another. */
struct FunFactCard: View {
    @State private var index = FunFacts.today()
    @State private var turns = 0.0

    var body: some View {
        Button {
            Haptic.select()
            withAnimation(Motion.splash) {
                index = (index + 1) % FunFacts.all.count
                turns += 1
            }
        } label: {
            HStack(alignment: .top, spacing: Metrics.gap) {
                Text("💡").font(.title2).rotationEffect(.degrees(turns * 360)).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Did you know?").font(.label).foregroundStyle(Palette.stone)
                    Text(FunFacts.all[index])
                        .font(.subheadline)
                        .foregroundStyle(Palette.ink)
                        .multilineTextAlignment(.leading)
                        .contentTransition(.opacity)
                        .id(index)
                        .transition(.liquid)
                    Text("Tap for another").font(.caption).foregroundStyle(Palette.faint)
                }
                Spacer(minLength: 0)
            }
            .padding(Metrics.card - 4)
            .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        }
        .buttonStyle(WaterButtonStyle())
        .accessibilityLabel("Did you know? \(FunFacts.all[index])")
        .accessibilityHint("Shows another fact")
    }
}
