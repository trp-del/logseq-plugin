/* Predictive's helper: Apple's on-device model, answering Logseq on this Mac only.

   Logseq cannot call Apple's model itself, so this small program does: it listens on 127.0.0.1 (never the network),
   answers only requests from Logseq's own window (origin lsp://logseq.com), and runs the model on the Mac. Nothing
   leaves the Mac.

   GET  /status  -> { "ready": true } or { "ready": false, "reason": "..." }, with "version" (3: "model", dates without a pattern, failures by name;
                    4: /meaning and /names), "tagging" (whether Apple's tagging model is here), "meaning" (whether Apple's sentence matcher
                    is here, which needs no Apple Intelligence), "names" (Apple's name finder, likewise), "cloud": whether Apple's larger model
                    in Private Cloud Compute can be asked (for the ontology only, later; never a note's words), and "cloudReason"
   POST /meaning <- { "graph", "learn": [{ "id", "text" }], "replace" } learns the graph's notes as meaning vectors (replace: the
                    graph's earlier set goes first) -> { "learned": n, "held": n }. Kept in memory only, by id and vector; the words
                    are not kept.
                 <- { "graph", "text", "k", "skip": [ids] } -> { "near": [{ "id", "sim" }], "held": n }: the k learned notes nearest in
                    meaning to the text, cosine similarity, best first. held 0: nothing learned for this graph yet (learn first).
   POST /names   <- { "texts": [..] } -> { "names": [[{ "text", "kind": "person" | "place" | "organization", "at", "to" }], ...] }:
                    the names Apple's name finder reads in each text, in order, at and to as character offsets.
   POST /reads-back <- { "property", "from", "to" } -> { "names": [one] }: how a property reads from the node it points to, from
                    Apple's larger model in Private Cloud Compute, sent only the property's and tags' names (version 6; 5 asked the
                    on-device model).
   POST /fill    <- { "text", "page", "tags": [..], "today": "YYYY-MM-DD", "instructions", "context", "properties": [
                        { "key", "title", "kind": "page" | "tag" | "choice" | "number" | "date", "many", "choices": [titles], "about" } ] }
                   (a "tag" is which of the graph's tags the note is, a "choice" one of a property's own list (Status), each
                   from its choices; "about" says what is asked)
                 -> { "values": { key: title | [titles] | number | "YYYY-MM-DD" }, "ms" } or { "error": "..." }

   The answer is held to a shape built from the bullet's own properties: a page property can only hold one of the
   choices it was sent (or "none"), a date only a day written YYYY-MM-DD, a number only a number. The plugin checks
   every answer again before it shows it, and shows it as a guess.

   Build: sh build.sh (in this folder). Runs at login once install.sh has been run. */
import Accelerate
import Foundation
import FoundationModels
import NaturalLanguage
import Network

let PORT: UInt16 = 47615
let ORIGIN = "lsp://logseq.com"
let NONE = "none"
// Raised when the plugin may ask something an older helper cannot answer (2: a property with a list of choices; 3: "model",
// a date without a pattern, failures by name; 4: /meaning and /names; 5: /reads-back; 6: /reads-back from the larger model in Private Cloud Compute).
let VERSION = 6

// MARK: - the request

struct Property: Decodable { let key: String; let title: String; let kind: String; let many: Bool?; let choices: [String]?; let about: String? }
struct Fill: Decodable {
  let text: String; let page: String?; let tags: [String]?; let today: String?; let properties: [Property]; let instructions: String?
  let context: String?   // what the plugin adds to the note: the tags with what each holds, earlier notes of each
  let model: String?     // which of Apple's settings answers: "default", "permissive" (a looser filter, for working on the
                         // person's own words) or "tagging" (Apple's model for tags and the values in a text); default when absent
}

// MARK: - the model

func status() -> [String: Any] {
  var out: [String: Any]
  switch SystemLanguageModel.default.availability {
  case .available: out = ["ready": true]
  case .unavailable(let reason): out = ["ready": false, "reason": String(describing: reason)]
  }
  out["version"] = VERSION
  out["meaning"] = MEANING.ready
  out["names"] = true
  if case .available = SystemLanguageModel(useCase: .contentTagging).availability { out["tagging"] = true } else { out["tagging"] = false }
  // Apple's larger model, in Private Cloud Compute: whether this Mac can ask it (macOS 27 and later, and a helper built with
  // the macOS 27 tools, Swift 6.4; built with older tools it has none).
  #if compiler(>=6.4)
  if #available(macOS 27.0, *) {
    switch PrivateCloudComputeLanguageModel().availability {
    case .available: out["cloud"] = true
    case .unavailable(let reason): out["cloud"] = false; out["cloudReason"] = String(describing: reason)
    }
  } else { out["cloud"] = false; out["cloudReason"] = "needs macOS 27" }
  #else
  out["cloud"] = false; out["cloudReason"] = "built without Private Cloud Compute"
  #endif
  return out
}

/* Apple's on-device model in one of its settings. default: as it comes. permissive: its looser filter, meant for working on
   text the person gave it (their own notes). tagging: the model Apple tuned for tags and the values in a text. All three run
   on the Mac. */
func modelFor(_ name: String?) -> SystemLanguageModel {
  switch name {
  case "permissive": return SystemLanguageModel(guardrails: .permissiveContentTransformations)
  case "tagging": return SystemLanguageModel(useCase: .contentTagging)
  default: return SystemLanguageModel.default
  }
}

/* A session made ready ahead: the model on the Mac reads the instructions before the question comes (prewarm), so the
   answer starts sooner. One waits for each set of instructions and setting; taking it makes the next one ready. A note's
   words are only ever read by this model, on the Mac. */
actor Ready {
  private var waiting: [String: LanguageModelSession] = [:]
  func take(instructions: String, model: String?) -> LanguageModelSession {
    let key = (model ?? "default") + "\n" + instructions
    let make = { LanguageModelSession(model: modelFor(model), instructions: instructions) }
    let session = waiting.removeValue(forKey: key) ?? make()
    if waiting.count > 6 { waiting.removeAll() }
    let next = make()
    next.prewarm()
    waiting[key] = next
    return session
  }
}

/* A failure by its name only (guardrailViolation, exceededContextWindowSize, unsupportedGuide), never its description,
   which can carry what was asked. */
func failureName(_ error: Error) -> String {
  if let label = Mirror(reflecting: error).children.first?.label { return label }
  let said = String(describing: error)
  return String(said.prefix { $0.isLetter || $0.isNumber || $0 == "_" }).isEmpty ? "unknown" : String(said.prefix { $0.isLetter || $0.isNumber || $0 == "_" })
}
let READY = Ready()

// One name per property for the model to read: the property's title, made unique.
func names(_ props: [Property]) -> [String] {
  var seen = Set<String>(), out: [String] = []
  for p in props {
    var name = p.title.isEmpty ? p.key : p.title, n = 2
    while seen.contains(name.lowercased()) { name = "\(p.title) \(n)"; n += 1 }
    seen.insert(name.lowercased()); out.append(name)
  }
  return out
}

func schemaFor(_ fill: Fill, _ names: [String]) throws -> GenerationSchema {
  var properties: [DynamicGenerationSchema.Property] = []
  for (p, name) in zip(fill.properties, names) {
    let value: DynamicGenerationSchema
    switch p.kind {
    case "page":
      let choices = (p.choices ?? []).filter { $0.lowercased() != NONE }
      if choices.isEmpty { continue }
      let one = DynamicGenerationSchema(name: "\(name) choice", anyOf: choices + [NONE])
      value = p.many == true ? DynamicGenerationSchema(arrayOf: one, minimumElements: 0, maximumElements: choices.count) : one
    case "tag", "choice":
      let choices = (p.choices ?? []).filter { $0.lowercased() != NONE }
      if choices.isEmpty { continue }
      value = DynamicGenerationSchema(name: "\(name) choice", anyOf: choices + [NONE])
    case "number":
      value = DynamicGenerationSchema(type: Double.self)
    case "date":
      // No pattern: Apple's model on the Mac refuses a pattern guide (unsupportedGuide), and the whole question with it. The
      // plugin keeps only a day written YYYY-MM-DD that the words name.
      value = DynamicGenerationSchema(type: String.self)
    default: continue
    }
    // The plugin words each question itself (about); these are for a plugin older than that.
    var about: String
    switch p.kind {
    case "page": about = "The \(p.title) the words name, from the choices; \(NONE) if the words do not say."
    case "tag": about = "Which of these kinds of note this note is, from the choices; \(NONE) if it is a plain note that is none of them."
    case "choice": about = "The \(p.title) of this note, from the choices; \(NONE) if the words do not say."
    case "number": about = "The \(p.title) as a number, only if the words give it."
    default: about = "The day of \(p.title) as YYYY-MM-DD, only if the words name it."
    }
    if let given = p.about, !given.isEmpty { about = given }
    properties.append(.init(name: name, description: about, schema: value, isOptional: true))
  }
  let root = DynamicGenerationSchema(name: "Properties", description: "The properties of one note, filled only from what its words say.", properties: properties)
  return try GenerationSchema(root: root, dependencies: [])
}

let INSTRUCTIONS = """
You fill in the properties of one note in someone's notes about their life and health. Fill a property only when the \
note's words say its value plainly. When the words do not say, leave the property out or answer none. Never guess \
from what is usual. A person the note was with, talked to or saw goes in the property whose name fits that role.
"""

func run(_ fill: Fill) async throws -> [String: Any] {
  let started = Date()
  if case .unavailable = modelFor(fill.model).availability { return ["error": "modelNotReady"] }
  let names = names(fill.properties)
  let schema = try schemaFor(fill, names)
  var prompt = "Note: \(fill.text)\n"
  if let tags = fill.tags, !tags.isEmpty { prompt += "It is a: \(tags.joined(separator: ", "))\n" }
  if let page = fill.page, !page.isEmpty { prompt += "Written on the page: \(page)\n" }
  if let today = fill.today { prompt += "Written on: \(today)\n" }
  if let context = fill.context, !context.isEmpty { prompt += "\n\(context)\n" }
  // The plugin's own instructions when it sends them, so their wording can change without building this again.
  let instructions = fill.instructions?.isEmpty == false ? fill.instructions! : INSTRUCTIONS
  let answer: LanguageModelSession.Response<GeneratedContent>
  do { answer = try await READY.take(instructions: instructions, model: fill.model).respond(to: prompt, schema: schema, options: GenerationOptions(sampling: .greedy)) }
  catch { return ["error": failureName(error)] }
  let data = Data(answer.content.jsonString.utf8)
  let object = (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
  // Back to the plugin's keys, without what the model left empty.
  var values: [String: Any] = [:]
  for (p, name) in zip(fill.properties, names) {
    guard let v = object[name] else { continue }
    if let s = v as? String, s.lowercased() == NONE || s.isEmpty { continue }
    if let list = v as? [Any] {
      let kept = list.compactMap { $0 as? String }.filter { $0.lowercased() != NONE }
      if kept.isEmpty { continue }
      values[p.key] = kept
      continue
    }
    values[p.key] = v
  }
  return ["values": values, "ms": Int(Date().timeIntervalSince(started) * 1000)]
}

// MARK: - meaning: Apple's sentence matcher, on the Mac, with no filter and no Apple Intelligence needed

/* Each note as a vector of what it means (NLEmbedding.sentenceEmbedding, 512 numbers), so a note can be matched to earlier
   notes that say the same thing in other words. Chosen over NLContextualEmbedding on 7 November 2026: on six fresh symptom and
   visit lines against ten earlier ones it put the right earlier note first five times (the contextual one four, with the wrong
   ones nearly as close), it takes 6 ms a note, and it needs no download. The vectors live in memory only, by note id; the
   words are turned into a vector and let go. One set per graph. */
struct Learn: Decodable { let id: Int; let text: String }
struct MeaningAsk: Decodable { let graph: String; let learn: [Learn]?; let replace: Bool?; let text: String?; let k: Int?; let skip: [Int]? }
final class Meaning: @unchecked Sendable {
  private let lock = NSLock()
  private var embedding: NLEmbedding?
  private var language: NLLanguage = .english
  private var graphs: [String: [Int: [Float]]] = [:]
  init() { embedding = NLEmbedding.sentenceEmbedding(for: .english) }
  var ready: Bool { embedding != nil }
  // The matcher for the language most of the notes are in, found from a sample of them; English when Apple has none for it.
  private func use(_ sample: [String]) {
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(sample.prefix(40).joined(separator: "\n"))
    if let found = recognizer.dominantLanguage, found != language, let made = NLEmbedding.sentenceEmbedding(for: found) { embedding = made; language = found }
  }
  func vector(_ text: String) -> [Float]? {
    guard let e = embedding, let v = e.vector(for: text) else { return nil }
    var out = v.map { Float($0) }
    var norm: Float = 0
    vDSP_dotpr(out, 1, out, 1, &norm, vDSP_Length(out.count))
    if norm > 0 { var s = 1 / norm.squareRoot(); vDSP_vsmul(out, 1, &s, &out, 1, vDSP_Length(out.count)) }
    return out
  }
  func learn(_ ask: MeaningAsk) -> [String: Any] {
    let items = ask.learn ?? []
    if ask.replace == true { use(items.map { $0.text }) }
    var made: [Int: [Float]] = [:]
    for item in items { if let v = vector(item.text) { made[item.id] = v } else { made[item.id] = [] } }
    lock.lock(); defer { lock.unlock() }
    if ask.replace == true { graphs[ask.graph] = [:] }
    var set = graphs[ask.graph] ?? [:]
    for (id, v) in made { if v.isEmpty { set.removeValue(forKey: id) } else { set[id] = v } }
    graphs[ask.graph] = set
    return ["learned": made.count, "held": set.count]
  }
  func near(_ ask: MeaningAsk) -> [String: Any] {
    lock.lock(); let set = graphs[ask.graph] ?? [:]; lock.unlock()
    guard let text = ask.text, let q = vector(text) else { return ["near": [], "held": set.count] }
    let skip = Set(ask.skip ?? []), k = max(1, min(ask.k ?? 10, 50))
    var found: [(Int, Float)] = []
    found.reserveCapacity(set.count)
    for (id, v) in set where !skip.contains(id) {
      var d: Float = 0
      vDSP_dotpr(q, 1, v, 1, &d, vDSP_Length(q.count))
      found.append((id, d))
    }
    found.sort { $0.1 > $1.1 }
    return ["near": found.prefix(k).map { ["id": $0.0, "sim": Double(round($0.1 * 1000) / 1000)] }, "held": set.count]
  }
}
let MEANING = Meaning()

// MARK: - names: Apple's name finder (people, places, organizations), on the Mac

struct NamesAsk: Decodable { let texts: [String] }
func namesIn(_ text: String) -> [[String: Any]] {
  let tagger = NLTagger(tagSchemes: [.nameType])
  tagger.string = text
  var out: [[String: Any]] = []
  tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType, options: [.omitWhitespace, .omitPunctuation, .joinNames]) { tag, range in
    let kind: String?
    switch tag { case .personalName?: kind = "person"; case .placeName?: kind = "place"; case .organizationName?: kind = "organization"; default: kind = nil }
    if let kind {
      out.append(["text": String(text[range]), "kind": kind, "at": text.distance(from: text.startIndex, to: range.lowerBound), "to": text.distance(from: text.startIndex, to: range.upperBound)])
    }
    return true
  }
  return out
}

// MARK: - how a property reads from the other end

/* POST /reads-back <- { "property", "from": [tags it is on], "to": [tags of its values] } -> { "names": [one], "ms" } or
   { "error" }: the property's name read from the node it points to (Threads' rows), from Apple's larger model in Private
   Cloud Compute (macOS 27). Only the ontology is sent, a property's name and tags' names; never a note's words (the owner,
   3 November 2026). The on-device model gave 2 to 8 good names of 16 on the owner's Mac; the larger one 8 of 10 (11 November
   2026), so it alone answers, and the plugin names the row by grammar when it cannot. Examples sit in the question, not the
   instructions (Apple: the model holds to its instructions above all, and copied examples kept there), and come from far
   away, so none is an answer to copy. */
struct ReadsBackAsk: Decodable { let property: String; let from: [String]?; let to: [String]? }
func readsBackPrompt(_ ask: ReadsBackAsk) -> String {
  let from = ask.from?.first ?? "Note", to = ask.to?.first ?? "Note"
  return """
  Rename a link so it reads from the other end. Prefer a connector with its preposition (like 'Author of', 'Owner of') or \
  a past participle (like 'Written', 'Approved'); use a plain verb only when nothing else reads naturally. Answer with the \
  new link name only, one to four words.

  Examples:
  Book --Written by--> Person becomes Person --Wrote--> Book
  Village --Part of--> County becomes County --Includes--> Village
  Employee --Reports to--> Manager becomes Manager --Manager of--> Employee
  Person --Mother--> Person becomes Person --Mother of--> Person

  Now: \(from) --\(ask.property)--> \(to) becomes \(to) --?--> \(from)
  """
}
// The name alone, from an answer that may repeat the link ("City --Location of--> Hospital") or end in a full stop.
func cleanName(_ said: String) -> String {
  var name = said.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
  if let start = name.range(of: "--"), let end = name.range(of: "-->", range: start.upperBound..<name.endIndex) { name = String(name[start.upperBound..<end.lowerBound]) }
  return name.trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: "\"'“”.`*")))
}
func readsBack(_ ask: ReadsBackAsk) async -> [String: Any] {
  #if compiler(>=6.4)
  if #available(macOS 27.0, *) {
    let model = PrivateCloudComputeLanguageModel()
    guard case .available = model.availability else { return ["error": "cloudNotReady"] }
    let started = Date()
    do {
      let session = LanguageModelSession(model: model, instructions: nil as String?)
      let answer = try await session.respond(to: readsBackPrompt(ask), contextOptions: ContextOptions())
      let name = cleanName(answer.content)
      if name.isEmpty || name.count > 40 || name.split(separator: " ").count > 5 { return ["error": "noName"] }
      return ["names": [name], "ms": Int(Date().timeIntervalSince(started) * 1000), "model": "cloud"]
    } catch { return ["error": failureName(error)] }
  }
  #endif
  return ["error": "cloudNotReady"]
}

// MARK: - the door: a little HTTP on 127.0.0.1

func reply(_ connection: NWConnection, _ code: Int, _ body: [String: Any], origin: String?) {
  let json = (try? JSONSerialization.data(withJSONObject: body)) ?? Data("{}".utf8)
  var head = "HTTP/1.1 \(code) \(code == 200 ? "OK" : code == 204 ? "No Content" : "Error")\r\n"
  head += "Content-Type: application/json\r\nContent-Length: \(code == 204 ? 0 : json.count)\r\nConnection: close\r\n"
  if origin == ORIGIN {
    head += "Access-Control-Allow-Origin: \(ORIGIN)\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
    head += "Access-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Private-Network: true\r\n"
  }
  var data = Data((head + "\r\n").utf8)
  if code != 204 { data.append(json) }
  connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
}

func handle(_ connection: NWConnection, _ buffer: Data = Data()) {
  connection.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { chunk, _, done, error in
    var buffer = buffer
    if let chunk { buffer.append(chunk) }
    guard let end = buffer.range(of: Data("\r\n\r\n".utf8)) else {
      if done || error != nil || buffer.count > 1 << 20 { connection.cancel() } else { handle(connection, buffer) }
      return
    }
    let head = String(decoding: buffer[..<end.lowerBound], as: UTF8.self).components(separatedBy: "\r\n")
    let line = head.first?.split(separator: " ") ?? []
    var headers: [String: String] = [:]
    for h in head.dropFirst() { if let i = h.firstIndex(of: ":") { headers[h[..<i].lowercased()] = h[h.index(after: i)...].trimmingCharacters(in: .whitespaces) } }
    let length = Int(headers["content-length"] ?? "0") ?? 0
    let body = buffer[end.upperBound...]
    if body.count < length { if done || error != nil { connection.cancel() } else { handle(connection, buffer) }; return }
    let method = line.count > 0 ? String(line[0]) : "", path = line.count > 1 ? String(line[1]) : ""
    let origin = headers["origin"]
    // Logseq's window only: a web page in a browser would come with its own origin, and gets nothing.
    if origin != nil && origin != ORIGIN { return reply(connection, 403, ["error": "not Logseq"], origin: origin) }
    if method == "OPTIONS" { return reply(connection, 204, [:], origin: origin) }
    if method == "GET" && path == "/status" { return reply(connection, 200, status(), origin: origin) }
    guard method == "POST", origin == ORIGIN || origin == nil else { return reply(connection, 404, ["error": "no such thing"], origin: origin) }
    let data = Data(body.prefix(length))
    if path == "/meaning" {
      do {
        let ask = try JSONDecoder().decode(MeaningAsk.self, from: data)
        return reply(connection, 200, ask.learn != nil ? MEANING.learn(ask) : MEANING.near(ask), origin: origin)
      } catch { return reply(connection, 200, ["error": String(describing: error)], origin: origin) }
    }
    if path == "/names" {
      do {
        let ask = try JSONDecoder().decode(NamesAsk.self, from: data)
        return reply(connection, 200, ["names": ask.texts.map(namesIn)], origin: origin)
      } catch { return reply(connection, 200, ["error": String(describing: error)], origin: origin) }
    }
    if path == "/reads-back" {
      Task {
        do { reply(connection, 200, await readsBack(try JSONDecoder().decode(ReadsBackAsk.self, from: data)), origin: origin) }
        catch { reply(connection, 200, ["error": String(describing: error)], origin: origin) }
      }
      return
    }
    guard path == "/fill" else { return reply(connection, 404, ["error": "no such thing"], origin: origin) }
    Task {
      do {
        let fill = try JSONDecoder().decode(Fill.self, from: data)
        reply(connection, 200, try await run(fill), origin: origin)
      } catch {
        reply(connection, 200, ["error": String(describing: error)], origin: origin)
      }
    }
  }
}

@main struct Helper {
  static func main() async throws {
    // Asked from the command line instead (sh build.sh test): one fill read from standard input, the answer printed.
    if CommandLine.arguments.dropFirst().first == "--fill" {
      let data = FileHandle.standardInput.readDataToEndOfFile()
      let fill = try JSONDecoder().decode(Fill.self, from: data)
      let out = try await run(fill)
      print(String(decoding: try JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys]), as: UTF8.self))
      exit(0)
    }
    // One property read back, from the command line: --reads-back '{"property":"Located in","from":["Hospital"],"to":["City"]}'.
    if CommandLine.arguments.dropFirst().first == "--reads-back", CommandLine.arguments.count > 2 {
      let out = await readsBack(try JSONDecoder().decode(ReadsBackAsk.self, from: Data(CommandLine.arguments[2].utf8)))
      print(String(decoding: try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys]), as: UTF8.self)); exit(0)
    }
    if CommandLine.arguments.dropFirst().first == "--status" {
      print(status()); exit(0)
    }
    // sh build.sh test: the matcher and the name finder on a few lines, printed.
    if CommandLine.arguments.dropFirst().first == "--meaning" {
      _ = MEANING.learn(MeaningAsk(graph: "test", learn: [Learn(id: 1, text: "Mouth so dry I could not swallow the toast"), Learn(id: 2, text: "Pins and needles in both hands after the drip"), Learn(id: 3, text: "Sick twice before lunch, kept nothing down")], replace: true, text: nil, k: nil, skip: nil))
      print(MEANING.near(MeaningAsk(graph: "test", learn: nil, replace: nil, text: "Threw up twice after dinner", k: 3, skip: nil)))
      print(namesIn("Saw Dr. Okafor at St Mary's about the scan with Ruth Okoro"))
      exit(0)
    }

    // On the loopback only: nothing from the network reaches it.
    let parameters = NWParameters.tcp
    parameters.requiredInterfaceType = .loopback
    parameters.allowLocalEndpointReuse = true
    let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: PORT)!)
    listener.newConnectionHandler = { connection in connection.start(queue: .global()); handle(connection) }
    listener.stateUpdateHandler = { state in
      if case .failed(let error) = state { FileHandle.standardError.write(Data("Predictive helper stopped: \(error)\n".utf8)); exit(1) }
    }
    listener.start(queue: .main)
    print("Predictive helper on 127.0.0.1:\(PORT), \(status())")
    while true { try await Task.sleep(for: .seconds(3600)) }
  }
}
