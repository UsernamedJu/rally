import Foundation

// The JSON shapes the API returns (shared/api.ts on the server side). Screens render these directly;
// the server does the math.

/** A badge someone is wearing because of how a challenge ended: "reward" for winning, "forfeit" for coming last. */
struct Flair: Codable, Hashable {
    var emoji: String
    var kind: String
}

struct FlairDetail: Codable, Hashable {
    var emoji: String
    var kind: String
    var title: String
    var challengeName: String
    var until: String
}

struct Badge: Codable, Hashable {
    var emoji: String
    var title: String
    var days: Int
}

/** What a challenge puts on the line inside the app. */
struct Stakes: Codable, Hashable {
    var reward: Badge
    var forfeit: Badge
    /** No opponents: it comes down to whether you reach the goal. */
    var solo: Bool
}

/** A medal for something done across challenges, earned or still to earn. */
struct Achievement: Codable, Hashable, Identifiable {
    var id: String
    var emoji: String
    var title: String
    var text: String
    var earned: Bool
    var gold: Bool
    var progress: Double
    var progressText: String
}

struct Person: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
    var flair: Flair? = nil
}

struct NameChange: Codable, Hashable {
    var lastName: String
    var by: String
    var challengeName: String
    var until: String
}

struct Me: Codable, Hashable {
    var id: String
    var name: String
    var avatar: Int
    var nameChange: NameChange?
    var flairDetail: FlairDetail?
    var workoutTime: String
    var trackedTypes: [String]
    var notifications: Bool
    var band: String
    var phone: String?
    var hasPin: Bool

    var flair: Flair? = nil
    var person: Person { Person(id: id, name: name, avatar: avatar, flair: flair) }
}

struct SignupResult: Codable {
    var token: String
    var user: Me
    var challengeId: String?
}

struct ChallengeCard: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    /** Missing from servers started before this field existed; `kind` covers both. */
    var type: String?
    /** You started this one, so it is yours to delete. Missing from older servers. */
    var mine: Bool?
    var targetShort: String
    var progressText: String
    var fraction: Double
    var periodDone: Bool
    var complete: Bool
    var members: [Person]
    var memberCount: Int
    var daysLeftText: String
    var waiting: Bool
    var live: Bool

    var kind: String { type ?? Catalog.guessType(from: targetShort) }
}

struct CrewMember: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
    var loggedToday: Bool

    var flair: Flair? = nil
    var person: Person { Person(id: id, name: name, avatar: avatar, flair: flair) }
}

struct HomeData: Codable {
    var user: Me
    var crew: [CrewMember]
    var challenges: [ChallengeCard]
}

struct FriendData: Codable {
    var id: String
    var name: String
    var avatar: Int
    var completed: Int
    var biggestWin: String?
    /** Workouts they chose to share, newest first. Missing from older servers. */
    var recent: [Workout]?
}

struct Exercise: Codable, Hashable {
    var name: String
    var sets: Int?
    var reps: Int?
    var weight: Double?

    /** "3 x 8 at 135 lb", with whatever parts were filled in. */
    var summary: String {
        var parts: [String] = []
        if let sets, let reps { parts.append("\(sets) x \(reps)") } else if let sets { parts.append("\(sets) sets") } else if let reps { parts.append("\(reps) reps") }
        if let weight { parts.append("\(Catalog.fmt(weight)) lb") }
        return parts.joined(separator: " at ")
    }
}

/** One logged workout, with whatever detail its owner added. */
struct Workout: Codable, Hashable, Identifiable {
    var id: String
    var date: String
    var dateText: String
    var activity: String
    var activityLabel: String
    var minutes: Int?
    var note: String
    var exercises: [Exercise]
    var shared: Bool
    var countedToward: [String]

    var hasDetail: Bool { minutes != nil || !note.isEmpty || !exercises.isEmpty }
}

struct Standing: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
    var rank: Int
    var fraction: Double
    var percent: Int
    var label: String
    var goalText: String?
    var delta: String?
    var isYou: Bool
    var onTheHook: Bool
    var complete: Bool

    var flair: Flair? = nil
    var person: Person { Person(id: id, name: name, avatar: avatar, flair: flair) }
}

struct HeroStats: Codable, Hashable {
    var rank: String
    var progress: String
    var people: String
}

struct ConsequenceView: Codable, Hashable {
    var status: String // none | proposed | agreed
    var text: String?
    var proposedBy: String?
    var youProposed: Bool
    var youAgreed: Bool
    var waitingOn: Int
}

struct RenameTarget: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var isYou: Bool
    var status: String // pending | active | over
    var newName: String?
    var setBy: String?
    var until: String?
}

struct RenameView: Codable, Hashable {
    var canSet: Bool
    var targets: [RenameTarget]
}

struct YouInChallenge: Codable, Hashable {
    var member: Bool
    var commissioner: Bool
    var readOnly: Bool
    var result: String?
    /** A session challenge takes one log a day; this is whether today's is in. */
    var loggedToday: Bool?
    /** "gold" or "goal", once the challenge is over and you earned one. */
    var medal: String?
}

struct ManagedPerson: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
    var pending: Bool

    var flair: Flair? = nil
    var person: Person { Person(id: id, name: name, avatar: avatar, flair: flair) }
}

struct ChallengeDetail: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var targetText: String
    var type: String
    var target: Double
    var per: String
    var lengthDays: Int
    var numeric: Bool
    var house: Bool
    var status: String // waiting | live | done
    var daysLeftText: String
    var timeFraction: Double
    var rangeText: String
    var consequence: ConsequenceView?
    var stakes: Stakes?
    var rename: RenameView?
    var hero: HeroStats
    var fair: Bool
    var yourGoalText: String?
    var winnerName: String?
    var resultText: String?
    var standings: [Standing]
    var members: [Person]
    var alerts: [String]
    var you: YouInChallenge
    var manage: [ManagedPerson]
}

struct CheckinChallenge: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var type: String
    var numeric: Bool
    var unitMany: String
    var loggedToday: Bool
    var progressText: String
}

struct CheckinData: Codable {
    var checkedIn: Bool
    var streak: Int
    var challenges: [CheckinChallenge]
}

struct CheckinResult: Codable {
    var cards: [ChallengeCard]
    var previous: [String: Double]
    var line: String
    var checkinId: String
}

struct TrackedCard: Codable, Hashable, Identifiable {
    var type: String
    var label: String
    var totalText: String
    var days: [Double?]
    var todayIndex: Int
    var id: String { type }
}

struct PastRow: Codable, Hashable {
    var id: String
    var name: String
    var type: String?
    var medal: String?
    var rangeText: String
    var result: String
}

struct MeData: Codable {
    var user: Me
    var achievements: [Achievement]?
    var streak: Int
    var longestStreak: Int
    var completed: Int
    var won: Int
    var tracked: [TrackedCard]
    var past: [PastRow]
}

struct HouseCard: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var type: String?
    var targetText: String
    var memberCount: Int
    var joined: Bool
    var stakes: Stakes?

    var kind: String { type ?? Catalog.guessType(from: targetText) }
}

struct InvitePreview: Codable {
    var token: String
    var inviterName: String
    var challenge: ChallengeDetail?
    var alreadyMember: Bool
    var ended: Bool
}

struct TokenResponse: Codable { var token: String }
struct ChallengeIdResponse: Codable { var challengeId: String? }
struct Empty: Codable {}
