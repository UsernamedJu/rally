import SwiftUI

/**
 * Debug builds only: `xcrun simctl launch booted com.jean.fitnesschallenge -RallyDemo YES` opens this
 * page of the water and 3D pieces, so they can be checked without logging or ending a real challenge.
 */
struct DebugDemo: View {
    /** `-RallyWelcome YES` shows the signed-out welcome without signing anyone out. */
    static var welcome: Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: "RallyWelcome")
        #else
        false
        #endif
    }

    /** Any other debug-only launch flag, always off in release builds. */
    static func flag(_ name: String) -> Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: name)
        #else
        false
        #endif
    }

    static var requested: Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: "RallyDemo")
        #else
        false
        #endif
    }

    @State private var fraction = 0.25
    @State private var level = 0.0
    @State private var tick = 0

    var body: some View {
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
