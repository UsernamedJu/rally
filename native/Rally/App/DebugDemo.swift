import SwiftUI

/**
 * Debug builds only: `xcrun simctl launch booted com.jean.fitnesschallenge -RallyDemo YES` opens this
 * page of the water, 3D and celebration pieces, so they can be checked without logging or ending a real
 * challenge. `-RallyDemo YES -RallyDemoFun YES` shows the playful pieces instead.
 */
struct DebugDemo: View {
    /** `-RallyWelcome YES` shows the signed-out welcome without signing anyone out. */
    static var welcome: Bool { flag("RallyWelcome") }

    /** Any debug-only launch flag, always off in release builds. */
    static func flag(_ name: String) -> Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: name)
        #else
        false
        #endif
    }

    static var requested: Bool { flag("RallyDemo") }

    @State private var fraction = 0.25
    @State private var level = 0.0
    @State private var tick = 0
    @State private var party = 0

    var body: some View {
        if Self.flag("RallyDemoWin") { win } else if Self.flag("RallyDemoFun") { fun } else { water }
    }

    /**
     * `-RallyDemo YES -RallyDemoWin YES`: a finished challenge that you won, built from made-up data and
     * never sent to the server. A fresh id each launch, so the once-per-challenge party always plays.
     */
    private var win: some View {
        NavigationStack {
            if let detail = Self.wonChallenge { ChallengeContent(detail: detail, onChange: { _ in }) }
        }
    }

    private static var wonChallenge: ChallengeDetail? {
        let json = """
        {
          "id": "demo-win-\(Int.random(in: 0..<1_000_000))", "name": "Walk it off", "targetText": "3 walks a week for 2 weeks.",
          "type": "walk", "target": 3, "per": "week", "lengthDays": 14, "numeric": false, "house": false,
          "status": "done", "daysLeftText": "Ended", "timeFraction": 1, "rangeText": "Sept 25 to Oct 8",
          "consequence": {"status": "agreed", "text": "Buys coffee", "proposedBy": "Dana", "youProposed": false, "youAgreed": true, "waitingOn": 0},
          "rename": null,
          "hero": {"rank": "1st", "progress": "6 of 6", "people": "4"},
          "fair": false, "yourGoalText": null, "winnerName": "Jean",
          "resultText": "You won. Sam finished last and buys coffee.",
          "standings": [
            {"id": "u1", "name": "Jean", "avatar": 1, "rank": 1, "fraction": 1, "percent": 100, "label": "6 of 6", "goalText": null, "delta": "+1", "isYou": true, "onTheHook": false, "complete": true},
            {"id": "u2", "name": "Dana", "avatar": 2, "rank": 2, "fraction": 0.83, "percent": 83, "label": "5 of 6", "goalText": null, "delta": "-1", "isYou": false, "onTheHook": false, "complete": false},
            {"id": "u3", "name": "Priya", "avatar": 4, "rank": 3, "fraction": 0.67, "percent": 67, "label": "4 of 6", "goalText": null, "delta": null, "isYou": false, "onTheHook": false, "complete": false},
            {"id": "u4", "name": "Sam", "avatar": 5, "rank": 4, "fraction": 0.33, "percent": 33, "label": "2 of 6", "goalText": null, "delta": null, "isYou": false, "onTheHook": true, "complete": false}
          ],
          "members": [
            {"id": "u1", "name": "Jean", "avatar": 1}, {"id": "u2", "name": "Dana", "avatar": 2},
            {"id": "u3", "name": "Priya", "avatar": 4}, {"id": "u4", "name": "Sam", "avatar": 5}
          ],
          "alerts": [],
          "you": {"member": true, "commissioner": false, "readOnly": true, "result": "won"},
          "manage": []
        }
        """
        return try? JSONDecoder().decode(ChallengeDetail.self, from: Data(json.utf8))
    }

    private var fun: some View {
        Page {
            HStack { Text("Fun").font(.display); WavingHand().font(.display) }
            SwipeCard { _ in }
            HStack(spacing: 20) {
                EmojiBadge(emoji: "🏃").popIn(delay: 0.4)
                EmojiBadge(emoji: "🏋️").bobbing()
                CountUp(value: 87, suffix: "%").font(.heading)
                Spacer()
            }
            Text("Banner").frame(maxWidth: .infinity, minHeight: 60).background { AliveGradient() }.clipShape(.rect(cornerRadius: 24))
            PrimaryButton(title: "Party") { party += 1 }
        }
        .background { FloatingEmoji(emoji: ["💪", "🔥", "🎉", "⭐️", "👟"]) }
        .overlay { ConfettiBurst(trigger: party) }
        .task {
            try? await Task.sleep(for: .seconds(2.5))
            party += 1
        }
    }

    private var water: some View {
        Page {
            Text("Water and 3D").font(.display)
            Card { Trophy3D(height: 200).frame(maxWidth: .infinity) }
            Card {
                LiquidBar(fraction: fraction)
                LiquidBar(fraction: fraction * 0.6, fill: Palette.ink, height: 8)
                SecondaryButton(title: "Pour", compact: true) { fraction = fraction > 0.8 ? 0.15 : fraction + 0.3 }
            }
            HStack { Spacer(); WaterCircle(level: level, size: 120) { Image(systemName: "checkmark").font(.system(size: 50, weight: .bold)).foregroundStyle(.white) }; Spacer() }
            PrimaryButton(title: "Ripple me") {}
                .modifier(RippleModifier(trigger: tick, origin: CGPoint(x: 120, y: 27)))
        }
        .onAppear { withAnimation(.easeOut(duration: 1.4)) { level = 1 } }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.5))
                tick += 1
            }
        }
    }
}
