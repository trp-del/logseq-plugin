/* Predictive's helper: Apple's on-device model, answering Logseq on this Mac only.

   Logseq cannot call Apple's model itself, so this small program does: it listens on 127.0.0.1 (never the network),
   answers only requests from Logseq's own window (origin lsp://logseq.com), and runs the model on the Mac. Nothing
   leaves the Mac.

   GET  /status  -> { "ready": true } or { "ready": false, "reason": "..." }, with "version" (2: answers "choice"), "cloud": whether Apple's larger model in Private Cloud Compute can be asked (for the
                    ontology only, later; never a note's words), and "cloudReason"
   POST /fill    <- { "text", "page", "tags": [..], "today": "YYYY-MM-DD", "instructions", "context", "properties": [
                        { "key", "title", "kind": "page" | "tag" | "choice" | "number" | "date", "many", "choices": [titles], "about" } ] }
                   (a "tag" is which of the graph's tags the note is, a "choice" one of a property's own list (Status), each
                   from its choices; "about" says what is asked)
                 -> { "values": { key: title | [titles] | number | "YYYY-MM-DD" }, "ms" } or { "error": "..." }

   The answer is held to a shape built from the bullet's own properties: a page property can only hold one of the
   choices it was sent (or "none"), a date only a day written YYYY-MM-DD, a number only a number. The plugin checks
   every answer again before it shows it, and shows it as a guess.

   Build: sh build.sh (in this folder). Runs at login once install.sh has been run. */
import Foundation
import FoundationModels
import Network

let PORT: UInt16 = 47615
let ORIGIN = "lsp://logseq.com"
let NONE = "none"
// Raised when the plugin may ask something an older helper cannot answer (2: a property with a list of choices).
let VERSION = 2

// MARK: - the request

struct Property: Decodable { let key: String; let title: String; let kind: String; let many: Bool?; let choices: [String]?; let about: String? }
struct Fill: Decodable {
  let text: String; let page: String?; let tags: [String]?; let today: String?; let properties: [Property]; let instructions: String?
  let context: String?   // what the plugin adds to the note: the tags with what each holds, earlier notes of each
}

// MARK: - the model

func status() -> [String: Any] {
  var out: [String: Any]
  switch SystemLanguageModel.default.availability {
  case .available: out = ["ready": true]
  case .unavailable(let reason): out = ["ready": false, "reason": String(describing: reason)]
  }
  out["version"] = VERSION
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

/* A session made ready ahead: the model on the Mac reads the instructions before the question comes (prewarm), so the
   answer starts sooner. One waits for each set of instructions; taking it makes the next one ready. A note's words are
   only ever read by this model, on the Mac. */
actor Ready {
  private var waiting: [String: LanguageModelSession] = [:]
  func take(instructions: String) -> LanguageModelSession {
    let session = waiting.removeValue(forKey: instructions) ?? LanguageModelSession(instructions: instructions)
    if waiting.count > 4 { waiting.removeAll() }
    let next = LanguageModelSession(instructions: instructions)
    next.prewarm()
    waiting[instructions] = next
    return session
  }
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
      value = DynamicGenerationSchema(type: String.self, guides: [.pattern(try Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}"))])
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
  if case .unavailable = SystemLanguageModel.default.availability { return ["error": "the model is not ready"] }
  let names = names(fill.properties)
  let schema = try schemaFor(fill, names)
  var prompt = "Note: \(fill.text)\n"
  if let tags = fill.tags, !tags.isEmpty { prompt += "It is a: \(tags.joined(separator: ", "))\n" }
  if let page = fill.page, !page.isEmpty { prompt += "Written on the page: \(page)\n" }
  if let today = fill.today { prompt += "Written on: \(today)\n" }
  if let context = fill.context, !context.isEmpty { prompt += "\n\(context)\n" }
  // The plugin's own instructions when it sends them, so their wording can change without building this again.
  let instructions = fill.instructions?.isEmpty == false ? fill.instructions! : INSTRUCTIONS
  let answer = try await READY.take(instructions: instructions).respond(to: prompt, schema: schema, options: GenerationOptions(sampling: .greedy))
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
    guard method == "POST" && path == "/fill", origin == ORIGIN || origin == nil else { return reply(connection, 404, ["error": "no such thing"], origin: origin) }
    let data = Data(body.prefix(length))
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
    if CommandLine.arguments.dropFirst().first == "--status" {
      print(status()); exit(0)
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
