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
        if Self.flag("RallyDemoFun") { fun } else { water }
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
