import Foundation

// The JSON shapes the API returns (shared/api.ts on the server side). Screens render these directly;
// the server does the math.

struct Person: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
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
    var workoutTime: String
    var trackedTypes: [String]
    var notifications: Bool
    var band: String
    var phone: String?
    var hasPin: Bool

    var person: Person { Person(id: id, name: name, avatar: avatar) }
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

    var person: Person { Person(id: id, name: name, avatar: avatar) }
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

    var person: Person { Person(id: id, name: name, avatar: avatar) }
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
}

struct ManagedPerson: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var avatar: Int
    var pending: Bool

    var person: Person { Person(id: id, name: name, avatar: avatar) }
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
    var rangeText: String
    var result: String
}

struct MeData: Codable {
    var user: Me
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
