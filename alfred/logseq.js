/* Logseq for Alfred: adding things to a Logseq DB graph quickly, in the shape the Logseq Plugin gives them.
   Run by osascript as JavaScript (runner.zsh), the command being the name of the script Alfred ran:
     today <words>              a bullet on today's journal
     active <words>             a bullet on the page open in Logseq
     page <Name> [#Tag]         a page named so, made if there is none, with an existing tag if one is given
     picture [Name]             the picture on the clipboard, into the graph, on today's journal or on a page named
     today-selection <items…>   what is selected or chosen: files into the graph on today's journal; words with where they
                                came from, as a quote and a citation; a web page as its link
     page-selection <items…>    the same, each on a page of its own: a file on a page named after it, words on a page
                                named after the page they came from
   Words, links and pages go through Logseq's own HTTP API. Files go to the Logseq Plugin (its "add" from outside), which
   puts them into the graph as Logseq puts a dropped file: a node of its own, the file copied into the graph. A citation is
   written as the plugin's Cite writes one: ([Title](url)) for the web, (*Name*, p. 3) for a document, ([[uuid]], p. 3) for a
   PDF that is in the graph. The day is the journal's own, so no date is written. */
ObjC.import("Foundation");
ObjC.import("AppKit");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

const PLUGIN_ID = "logseq-plugin";
const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
const PLUGIN_NEEDED = "Install Logseq Plugin 0.3.25 or newer in Logseq: it puts files into the graph.";

function env(name, fallback) {
  try {
    const value = app.systemAttribute(name);
    return value === undefined || value === null || String(value) === "" ? fallback : String(value);
  } catch (_) {
    return fallback;
  }
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function messageFrom(value) {
  if (value === null || value === undefined) return "Unknown error";
  if (typeof value === "string") return value;
  if (value.message) return String(value.message);
  if (value.error) return messageFrom(value.error);
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}

// One call to Logseq's HTTP API. A file add waits longer: Logseq copies the file and reads it through.
function api(method, args, seconds) {
  const host = env("LOGSEQ_HOST", "127.0.0.1");
  const port = env("LOGSEQ_PORT", "12315");
  const token = env("LOGSEQ_TOKEN", "");
  if (!token) throw new Error("Paste Logseq's API token into the workflow's configuration");

  const endpoint = "http://" + host + ":" + port + "/api";
  const payload = JSON.stringify({ method: method, args: args || [] });
  const command = [
    "/usr/bin/curl --silent --show-error --max-time " + (seconds || 10),
    "--request POST",
    "--header " + shellQuote("Authorization: Bearer " + token),
    "--header " + shellQuote("Content-Type: application/json"),
    "--data-binary " + shellQuote(payload),
    "--write-out " + shellQuote("\\n%{http_code}"),
    shellQuote(endpoint)
  ].join(" ");

  let output;
  try {
    output = app.doShellScript(command, { alteringLineEndings: false });
  } catch (error) {
    throw new Error("Logseq is not answering. Start Logseq and its HTTP API server.");
  }

  // The macOS Standard Additions bridge may return CR, LF, or CRLF. Match the final status trailer, not newlines in the body.
  const trailer = /(?:\r\n|\r|\n)(\d{3})\s*$/.exec(String(output));
  if (!trailer) throw new Error("Logseq's answer could not be read");
  const body = String(output).slice(0, trailer.index);
  const status = Number(trailer[1]);
  let parsed = null;
  if (body.trim()) {
    try { parsed = JSON.parse(body); } catch (_) { parsed = body; }
  }
  if (status < 200 || status >= 300) {
    if (status === 401) throw new Error("Logseq rejected the API token");
    throw new Error("Logseq API error " + status + ": " + messageFrom(parsed));
  }
  if (parsed && typeof parsed === "object" && parsed.error) throw new Error(messageFrom(parsed.error));
  return parsed;
}

function requireDbGraph() {
  const result = api("logseq.App.checkCurrentIsDbGraph", []);
  if (result === false) throw new Error("The graph open in Logseq is not a DB graph");
}

function valueAt(object, names) {
  if (!object || typeof object !== "object") return null;
  for (let i = 0; i < names.length; i++) {
    if (object[names[i]] !== undefined && object[names[i]] !== null) return object[names[i]];
  }
  return null;
}
const nodeUuid = node => { const v = valueAt(node, ["uuid", "block/uuid", ":block/uuid"]); return v === null ? null : String(v); };
const nodeTitle = node => { const v = valueAt(node, ["title", "name", "block/title", ":block/title", "block/name", ":block/name"]); return v === null ? "" : String(v); };

// --------------------------------------------------------------------------------------------------------------------
// Where things go
// --------------------------------------------------------------------------------------------------------------------

function todayPage() {
  let page = api("logseq.Editor.getTodayPage", []);
  if (!page) {
    const today = new Date();
    const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    page = api("logseq.Editor.createJournalPage", [localDate]);
  }
  if (!page || !nodeUuid(page)) throw new Error("Today's journal could not be found");
  return page;
}

function openPage() {
  const page = api("logseq.Editor.getCurrentPage", []);
  if (!page || !nodeUuid(page)) throw new Error("No page is open in Logseq");
  return page;
}

// A page by its name, made when there is none. A "#Tag" at the end of the words is an existing tag put on the page.
function pageNamed(words) {
  let name = String(words || "").trim();
  const tags = [];
  const tagged = /^(.*?)((?:\s+#[^\s#]+)+)\s*$/.exec(name);
  if (tagged) {
    name = tagged[1].trim();
    tagged[2].trim().split(/\s+/).forEach(function (t) { tags.push(t.slice(1)); });
  }
  if (!name) throw new Error("Give the page a name");
  tags.forEach(function (tag) {   // before the page is made, so a wrong tag leaves nothing behind
    const found = safeCall(function () { return api("logseq.Editor.getTagsByName", [tag]); }) || [];
    if (!found.length) throw new Error("There is no tag named " + tag);
  });
  let page = api("logseq.Editor.getPage", [name]);
  let made = false;
  if (!page || !nodeUuid(page)) {
    page = api("logseq.Editor.createPage", [name, {}, { redirect: false, createFirstBlock: false }]);
    made = true;
  }
  if (!page || !nodeUuid(page)) throw new Error("The page “" + name + "” could not be made");
  tags.forEach(function (tag) {
    try { api("logseq.Editor.addBlockTag", [nodeUuid(page), tag]); }
    catch (error) { throw new Error(/Not a tag/i.test(messageFrom(error)) ? "There is no tag named " + tag : messageFrom(error)); }
  });
  return { page: page, made: made, tags: tags };
}

function appendTo(page, content) {
  return api("logseq.Editor.appendBlockInPage", [nodeUuid(page), content, {}]);
}

// Logseq shows the page, without coming to the front.
function showPage(page) {
  try { api("logseq.App.pushState", ["page", { name: nodeUuid(page) }, {}]); } catch (_) {}
}

// Files into the graph, by the plugin. `where` is "today", "open" or { page: name }; the answer names what was added, or says
// the files are still going in ({ pending }) when Logseq's ten seconds for a call from outside ran out first.
function addFiles(paths, where) {
  try {
    return api("logseq.App.invokeExternalPluginCmd", [PLUGIN_ID, "models", "add", [{ files: paths, where: where }]], 120) || {};
  } catch (error) {
    const text = messageFrom(error);
    const reason = /Error:\s*([^\n]*)$/.exec(text);   // the plugin's own reason, after whatever the server wrapped it in
    if (reason) throw new Error(reason[1].trim());
    if (/Postmate|timeout/i.test(text)) return { pending: true };
    if (/plugin|not found|No matching|undefined|null/i.test(text)) throw new Error(PLUGIN_NEEDED);
    throw error;
  }
}
const stillGoing = (answer, names) => answer && answer.pending ? "Still taking " + (names.length === 1 ? names[0] : plural(names.length, "file")) + " into Logseq…" : null;

// --------------------------------------------------------------------------------------------------------------------
// What is selected, and where it came from
// --------------------------------------------------------------------------------------------------------------------

function safeCall(fn) {
  try { return fn(); } catch (_) { return null; }
}

function frontmostBundleId() {
  const configured = env("source_app", "");
  if (configured) return configured;
  try {
    const systemEvents = Application("System Events");
    const processes = systemEvents.applicationProcesses.whose({ frontmost: true })();
    if (processes.length) return String(processes[0].bundleIdentifier());
  } catch (_) {}
  return "";
}

function safariContext() {
  const browser = safeCall(function () { return Application("Safari"); });
  if (!browser || !safeCall(function () { return browser.running(); })) return null;
  const document = safeCall(function () { return browser.documents[0]; });
  if (!document) return null;
  const url = safeCall(function () { return document.url(); });
  const title = safeCall(function () { return document.name(); });
  return url ? { url: String(url), title: title ? String(title) : String(url), browser: "Safari" } : null;
}

function chromeContext() {
  const browser = safeCall(function () { return Application("Google Chrome"); });
  if (!browser || !safeCall(function () { return browser.running(); })) return null;
  const tab = safeCall(function () { return browser.windows[0].activeTab(); });
  if (!tab) return null;
  const url = safeCall(function () { return tab.url(); });
  const title = safeCall(function () { return tab.title(); });
  return url ? { url: String(url), title: title ? String(title) : String(url), browser: "Chrome" } : null;
}

function orionContext() {
  const browser = safeCall(function () { return Application("Orion"); });
  if (!browser || !safeCall(function () { return browser.running(); })) return null;
  let tab = safeCall(function () { return browser.windows[0].currentTab(); });
  if (!tab) tab = safeCall(function () { return browser.windows[0].activeTab(); });
  let url = tab ? safeCall(function () { return tab.url(); }) : null;
  let title = tab ? safeCall(function () { return tab.name(); }) : null;
  if (!title && tab) title = safeCall(function () { return tab.title(); });
  if (!url) {
    const document = safeCall(function () { return browser.documents[0]; });
    if (document) {
      url = safeCall(function () { return document.url(); });
      title = title || safeCall(function () { return document.name(); });
    }
  }
  return url ? { url: String(url), title: title ? String(title) : String(url), browser: "Orion" } : null;
}

function browserContext() {
  const configuredSource = env("source_app", "");
  const source = frontmostBundleId().toLowerCase();
  if (source.indexOf("com.apple.safari") >= 0 || source === "safari") return safariContext();
  if (source.indexOf("com.google.chrome") >= 0 || source.indexOf("chrome") >= 0) return chromeContext();
  if (source.indexOf("com.kagi.kagimacos") >= 0 || source.indexOf("orion") >= 0) return orionContext();
  // The hotkey names the app the selection came from. If that app is not a browser, no browser's page is the source.
  if (configuredSource) return null;
  const candidates = [safariContext, chromeContext, orionContext];
  for (let i = 0; i < candidates.length; i++) {
    const context = candidates[i]();
    if (context) return context;
  }
  return null;
}

function accessibilityAttribute(element, name) {
  const attribute = safeCall(function () { return element.attributes.byName(name); });
  let value = attribute ? safeCall(function () { return attribute.value(); }) : null;
  if (value !== null && value !== undefined && String(value) !== "") return value;
  const attributes = safeCall(function () { return element.attributes(); }) || [];
  for (let i = 0; i < attributes.length; i++) {
    const attributeName = safeCall(function () { return attributes[i].name(); });
    if (String(attributeName) === name) {
      value = safeCall(function () { return attributes[i].value(); });
      if (value !== null && value !== undefined && String(value) !== "") return value;
    }
  }
  return null;
}

function pathFromDocumentUrl(value) {
  if (!value) return null;
  let text = String(value);
  if (text.indexOf("file://") === 0) {
    text = text.replace(/^file:\/\/(?:localhost)?/, "");
    try { text = decodeURIComponent(text); } catch (_) {}
  }
  return text.indexOf("/") === 0 ? text : null;
}

function sourceProcess() {
  const source = env("source_app", "");
  if (!source) return null;
  const systemEvents = safeCall(function () { return Application("System Events"); });
  if (!systemEvents) return null;
  let processes = safeCall(function () { return systemEvents.applicationProcesses.whose({ bundleIdentifier: source })(); }) || [];
  if (!processes.length) processes = safeCall(function () { return systemEvents.applicationProcesses.whose({ name: source })(); }) || [];
  return processes.length ? processes[0] : null;
}

// The document open in the app the selection came from: its file, and the page shown, when the window's name says it.
function localContext() {
  const process = sourceProcess();
  if (!process) return null;
  const window = safeCall(function () { return process.windows[0]; });
  const documentUrl = window ? accessibilityAttribute(window, "AXDocument") : null;
  const path = pathFromDocumentUrl(documentUrl);
  const documentName = window ? safeCall(function () { return window.name(); }) : null;
  const pageSeen = /\b(?:page|p\.)\s*(\d+)\s*(?:of|\/)\s*\d+/i.exec(documentName || "");
  return {
    path: path,
    filename: path ? path.split("/").filter(Boolean).slice(-1)[0] : null,
    document: documentName ? String(documentName) : null,
    page: pageSeen ? Number(pageSeen[1]) : null
  };
}

function accessibilitySelection() {
  const process = sourceProcess();
  if (!process) return "";
  const focusedAttribute = safeCall(function () { return process.attributes.byName("AXFocusedUIElement"); });
  const focused = focusedAttribute ? safeCall(function () { return focusedAttribute.value(); }) : null;
  if (!focused) return "";
  const selected = accessibilityAttribute(focused, "AXSelectedText");
  if (selected === null || selected === undefined) return "";
  return safeCall(function () { return String(selected); }) || "";
}

function isFile(value) {
  const text = String(value || "");
  if (text.indexOf("/") !== 0) return false;
  const isDirectory = Ref();
  const exists = $.NSFileManager.defaultManager.fileExistsAtPathIsDirectory(text, isDirectory);
  return Boolean(exists) && !isDirectory[0];
}

const escapeLinkTitle = value => String(value).replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
const escapeLinkUrl = value => String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const webLink = context => "[" + escapeLinkTitle(context.title) + "](" + escapeLinkUrl(context.url) + ")";
const quote = text => text.split(/\r?\n/).map(function (line) { return line ? "> " + line : ">"; }).join("\n");
const nameWithoutExtension = name => String(name).replace(/\.[^.]+$/, "");

// A PDF already in the graph, by its title (a file's name without its extension), as Cite finds one.
const PDF_QUERY = "[:find [(pull ?a [:block/uuid]) ...] :in $ ?title :where [?a :logseq.property.asset/type \"pdf\"] " +
  "[?a :block/title ?title] (not [?a :logseq.property/deleted-at _])]";
function pdfInGraph(filename) {
  if (!/\.pdf$/i.test(filename)) return null;
  const rows = safeCall(function () { return api("logseq.DB.datascriptQuery", [PDF_QUERY, JSON.stringify(nameWithoutExtension(filename))]); }) || [];
  return rows.length ? nodeUuid(rows[0]) : null;
}

// What a selection becomes: { content, title, file } — the bullet's words; the name a page of its own would take; or a file
// to put into the graph instead (a saved document in front with nothing selected).
function selectionContent(selection) {
  const web = browserContext();
  let text = String(selection || "").trim();
  if (!text) text = accessibilitySelection().trim();
  if (web) {
    const link = webLink(web);
    return { content: text ? quote(text) + "\n\n(" + link + ")" : link, title: web.title, hasWords: Boolean(text) };
  }
  const local = localContext();
  if (!text) {
    if (local && local.path && local.filename) return { file: local.path, title: nameWithoutExtension(local.filename) };
    throw new Error("Select some words first, or choose a file");
  }
  if (!local || (!local.filename && !local.document)) return { content: quote(text), title: text.split(/\r?\n/)[0].slice(0, 80), hasWords: true };
  const name = local.filename ? nameWithoutExtension(local.filename) : local.document;
  const page = local.page ? ", p. " + local.page : "";
  const inGraph = local.filename ? pdfInGraph(local.filename) : null;
  const citation = inGraph ? "([[" + inGraph + "]]" + page + ")" : "(*" + name.replace(/\*/g, "") + "*" + page + ")";
  return { content: quote(text) + "\n\n" + citation, title: name, hasWords: true };
}

// The picture on the clipboard, written as a PNG file named by the moment, for the plugin to take.
function clipboardPicture() {
  const board = $.NSPasteboard.generalPasteboard;
  let data = board.dataForType("public.png");
  if (!data || data.isNil()) {
    const tiff = board.dataForType("public.tiff");
    if (tiff && !tiff.isNil()) {
      const rep = $.NSBitmapImageRep.imageRepWithData(tiff);
      if (rep && !rep.isNil()) data = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
    }
  }
  if (!data || data.isNil()) throw new Error("There is no picture on the clipboard");
  const now = new Date();
  const two = n => String(n).padStart(2, "0");
  const name = "Picture " + now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate()) + " " + two(now.getHours()) + "." + two(now.getMinutes()) + "." + two(now.getSeconds()) + ".png";
  const directory = env("alfred_workflow_cache", "/tmp/com.openai.alfred.logseq-db") + "/pictures";
  try { app.doShellScript("/bin/mkdir -p " + shellQuote(directory)); } catch (_) {}
  const path = directory + "/" + name;
  if (!data.writeToFileAtomically(path, true)) throw new Error("The picture could not be written");
  return path;
}

// --------------------------------------------------------------------------------------------------------------------
// The commands
// --------------------------------------------------------------------------------------------------------------------

const fileNames = paths => paths.map(function (p) { return p.split("/").filter(Boolean).slice(-1)[0]; });

function filesToToday(paths) {
  const names = fileNames(paths);
  const answer = addFiles(paths, "today");
  return stillGoing(answer, names) || "Added " + (names.length === 1 ? names[0] : plural(names.length, "file")) + " to Today";
}

function filesToPages(paths) {
  const names = [];
  let pending = false;
  paths.forEach(function (path) {
    const name = nameWithoutExtension(fileNames([path])[0]);
    if (addFiles([path], { page: name }).pending) pending = true;
    names.push(name);
  });
  if (pending) return stillGoing({ pending: true }, fileNames(paths));
  return names.length === 1 ? "Added as the page “" + names[0] + "”" : "Added " + plural(names.length, "page");
}

function selectionToToday(items) {
  const files = items.filter(isFile);
  if (files.length) return filesToToday(files);
  const found = selectionContent(items.join("\n"));
  if (found.file) return filesToToday([found.file]);
  appendTo(todayPage(), found.content);
  return found.hasWords ? "Added the selection to Today" : "Added the page's link to Today";
}

function selectionToPage(items) {
  const files = items.filter(isFile);
  if (files.length) return filesToPages(files);
  const found = selectionContent(items.join("\n"));
  if (found.file) return filesToPages([found.file]);
  const named = pageNamed(found.title);
  appendTo(named.page, found.content);
  showPage(named.page);
  return (named.made ? "Made the page “" : "Added to the page “") + nodeTitle(named.page) + "”";
}

/* ---------- The Add panel (add.alfredui, Alfred 6's Alfred UI) ----------
   Each command answers the panel with Alfred UI's JSON actions: what to change in the panel, and the panel's variables.
     panel-guess <words> <where> <tag>    the tag line, the other tags on ⌘ keys, and the properties the tag brings
     panel-add <words> <where> <tag> <take> <shown>   the note written; the panel turns to what was written, with Undo
     panel-undo <uuid>                    the note taken back out; the words come back to try again
     panel-show <uuid>                    the note shown in Logseq
   The proposals are the plugin's (Predictive, through its "guess" and "note" from outside). Without the plugin, words alone. */
const SECONDARY = "secondaryLabelColor", TERTIARY = "tertiaryLabelColor";
// The glass look of macOS 27 (18 November 2026): the one key Enter presses is a glass capsule; a lit row is a soft see-through
// wash the words keep their colours on, as in Spotlight.
const GLASS = { bordered: true, bordershape: "capsule", effect: "glass" }, SOFT_ROW = "quaternaryLabelColor";
const whereOf = value => (value === "open" ? "open" : "today");
const whereName = value => (value === "open" ? "the open page" : "today");
function pluginModel(name, request) {
  return api("logseq.App.invokeExternalPluginCmd", [PLUGIN_ID, "models", name, [request]], 12);
}
function tagLine(tag, picked, words) {
  if (tag) return {
    tagName: { text: "#" + tag.title, colour: picked ? "labelColor" : SECONDARY },
    tagWhy: { text: picked ? (tag.fields || []).join(", ") : "guessed " + (tag.why ? "· " + tag.why : "") + " · ↩ takes it" }
  };
  return { tagName: { text: words ? "none guessed" : "guessed after four words", colour: TERTIARY }, tagWhy: { text: words ? "pick one below, or ⌘T for all your tags" : "" } };
}
function choiceButtons(choices) {
  return choices.slice(0, 3).map(function (c, i) {
    return {
      type: "button", bordered: false, text: "⌘" + (i + 1) + "  #" + c.title, shortcut: "⌘" + (i + 1),
      contenttintcolour: SECONDARY, tooltip: c.why || "", font: { size: 15 },
      events: [{ triggers: "actioned", action: { type: "script", src: "guess", args: ["{value:words.text}", "{value:where.selected.value}", String(c.id)] } }]
    };
  });
}
function propRows(pieces) {
  const rows = [];
  pieces.forEach(function (p) {
    rows.push({ type: "label", text: p.prop, colour: SECONDARY, font: { size: 16 }, constraints: { position: "right" } });
    rows.push({ type: "label", text: (p.made ? "new page " : "") + p.shown, font: { size: 16 }, colour: p.guess ? SECONDARY : "labelColor" });
  });
  return rows;
}
function guessAnswer(words, where, tag) {
  const out = { variables: { picked_tag: tag || "", guessed_tag: "" }, update: { ids: {} }, replace: { ids: {} } };
  let got = { tag: null, choices: [], pieces: [] };
  if (words.trim()) {
    try { got = pluginModel("guess", { words: words, where: whereOf(where), tag: tag ? Number(tag) : null }) || got; }
    catch (error) { got = { tag: null, choices: [], pieces: [], said: messageFrom(error) }; }
  }
  if (got.tag && !tag) out.variables.guessed_tag = String(got.tag.id);
  Object.assign(out.update.ids, tagLine(got.tag, Boolean(tag), words.trim()));
  if (got.said) out.update.ids.tagWhy = { text: got.said, colour: "systemRedColor" };
  const choices = choiceButtons(got.choices || []);
  out.replace.ids.choices = { type: "view", id: "choices", layout: "inline", spacing: 18, hidden: !choices.length, components: choices, constraints: { position: "left" } };
  out.replace.ids.props = { type: "view", id: "props", layout: "form", spacing: 9, hidden: !(got.pieces || []).length, components: propRows(got.pieces || []), constraints: { position: "left" } };
  out.update.relayout = true;
  out.window = { resize: { height: "auto" } };   // the panel grows and shrinks with what it shows
  return JSON.stringify(out);
}
function doneView(answer, where) {
  const filled = (answer.wrote || []).map(function (w) { return w.prop + " " + w.shown; }).join(" · ");
  const button = (text, key, src, args) => ({ type: "button", bordered: false, text: text + "  " + key.toUpperCase(), shortcut: key, contenttintcolour: SECONDARY, font: { size: 15 },
    events: [{ triggers: "actioned", action: { type: "script", src: src, args: args } }] });
  return { type: "view", id: "body", layout: "inline", direction: "vertical", spacing: 16, components: [
    { type: "label", id: "doneLine", constraints: { position: "left" }, text: "✓  Added to " + (answer.page || whereName(where)) + (answer.tag ? " as #" + answer.tag : ""), font: { size: 20 } },
    { type: "label", text: filled || "Words only", colour: SECONDARY, font: { size: 15 }, constraints: { position: "left" } },
    { type: "view", layout: "inline", spacing: 18, constraints: { position: "right" }, components: [
      button("Undo", "⌘z", "undo", [answer.uuid, answer.words || ""]),
      button("Show in Logseq", "⌘o", "show", [answer.uuid]),
      Object.assign({ type: "button", text: "Add another  ↩", shortcut: "↩",
        events: [{ triggers: "actioned", action: { type: "json", src: { finish: { args: "again" } } } }] }, GLASS)
    ] }
  ] };
}
function addAnswer(words, where, tag, take, refused) {
  if (!words.trim()) return JSON.stringify({ update: { ids: { tagWhy: { text: "Type the note first", colour: "systemRedColor" } } } });
  try {
    const answer = pluginModel("note", { words: words.trim(), where: whereOf(where), tag: tag ? Number(tag) : null, take: take || "all", refused: refused ? Number(refused) : null });
    return JSON.stringify({ variables: { last_uuid: answer.uuid, last_words: words }, replace: { ids: { body: doneView(Object.assign({ words: words.trim() }, answer), where) } }, update: { relayout: true }, window: { resize: { height: "auto" } } });
  } catch (error) {
    // Without the plugin, the words alone, as the workflow always wrote them.
    try {
      const page = whereOf(where) === "open" ? openPage() : todayPage(), block = appendTo(page, words.trim());
      return JSON.stringify({ variables: { last_uuid: nodeUuid(block) || "" }, replace: { ids: { body: doneView({ uuid: nodeUuid(block) || "", page: nodeTitle(page), tag: "", wrote: [] }, where) } }, update: { relayout: true } });
    } catch (again) {
      return JSON.stringify({ update: { ids: { tagWhy: { text: messageFrom(again), colour: "systemRedColor" } } } });
    }
  }
}
function undoAnswer(uuid, words) {
  try { pluginModel("undo", { uuid: uuid }); }
  catch (error) { try { api("logseq.Editor.removeBlock", [uuid]); } catch (again) { return JSON.stringify({ update: { ids: { doneLine: { text: messageFrom(again), colour: "systemRedColor" } } } }); } }
  // The words come back in a fresh panel, so nothing typed is lost (the full set, panel 7).
  return JSON.stringify({ finish: { args: "again", variables: { again_words: words || "" } } });
}
// ⌘T: every tag of yours in a sheet over the panel, in the tree's order, filtered as you type; ↩ picks the lit one.
function tagsAnswer(mode) {
  let list = [];
  try { list = (pluginModel("tags", {}) || {}).tags || []; } catch (error) { return JSON.stringify({ update: { ids: { tagWhy: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const rows = list.map(function (t) {
    return { uid: String(t.id), "sheetTag.text": " ".repeat(t.depth) + "#" + t.title, "sheetPath.text": t.depth ? t.path : "", "sheetFields.text": (t.fields || []).join(", "), "sheetId.text": String(t.id), "sheetTitle.text": t.title, "sheetFind.text": t.title + " " + t.path };
  });
  const pick = mode === "triage"
    ? { type: "script", src: "tag", args: ["{var:t_uuid}", "{value:sheetList.selected.sheetId.text}", "{var:t_passed}", "{var:t_tagged}", "{var:t_summary},{value:sheetList.selected.sheetTitle.text}"] }
    : { type: "script", src: "pick", args: ["{value:words.text}", "{value:where.selected.value}", "{value:sheetList.selected.sheetId.text}"] };
  return JSON.stringify({ sheet: { id: "tagSheet", root: {
    type: "view", layout: "border", padding: 22, spacing: 12, constraints: { size: { width: 760, height: 540 } },
    shortcuts: [
      { shortcut: "↑", action: { type: "function", src: "sheetList", args: "selectup" } },
      { shortcut: "↓", action: { type: "function", src: "sheetList", args: "selectdown" } }
    ],
    components: [
      { type: "textfield", id: "sheetFilter", focus: true, bordered: false, focusring: false, placeholder: "Find a tag", font: { size: 26, weight: "light" }, constraints: { region: "top" },
        events: [
          { triggers: "changed", action: [{ type: "function", src: "sheetList", args: "filterdata" }, { type: "function", src: "sheetList", args: "selectfirst" }] },
          { triggers: "actioned", action: pick }
        ] },
      { type: "dataview", id: "sheetList", placeholder: "No tag by that name. New tags are made in Logseq.", constraints: { region: "centre" },
        cell: { height: 44,
          init: { "sheetRow.background": null, "sheetTag.colour": "labelColor", "sheetFields.colour": SECONDARY },
          selected: { "sheetRow.background": SOFT_ROW },
          root: { type: "view", id: "sheetRow", layout: "border", padding: 10, cornerradius: 12, components: [
          { type: "label", id: "sheetTag", font: { size: 18, name: "New York" }, constraints: { region: "left" } },
          { type: "label", id: "sheetFields", colour: SECONDARY, font: { size: 14 }, textalign: "right", linebreak: "truncatetail", constraints: { region: "centre", position: "right" } },
          { type: "label", id: "sheetPath", hidden: true }, { type: "label", id: "sheetId", hidden: true }, { type: "label", id: "sheetTitle", hidden: true }, { type: "label", id: "sheetFind", hidden: true }
        ] } },
        behaviour: { selection: { wrap: "vertical" } }, select: list.length ? String(list[0].id) : "",
        data: { type: "basic", src: rows, filter: { type: "basic", args: ["sheetFind.text"], match: "{value:sheetFilter.text}" } } },
      { type: "label", text: "↑↓ to move · ↩ uses the tag · esc closes", colour: SECONDARY, font: { size: 14 }, constraints: { region: "bottom" } }
    ] } } });
}
function pickAnswer(words, where, tagId) {
  const answer = JSON.parse(guessAnswer(words, where, tagId));
  answer.sheet = { close: "tagSheet" };
  return JSON.stringify(answer);
}

/* ---------- Tag what came in (triage.alfredui) ----------
   Notes added from Alfred with no tag, one at a time: the tags each could be on ⌘1–3 (⌘T for any tag), Tab to pass one by, ⌘⌫ to
   leave it untagged for good. The panel keeps what it did (tagged ids, passed ids) in its variables, for one Undo at the end.
     panel-triage-next <passed> <tagged> <summary>
     panel-triage-tag <uuid> <tagId> <passed> <tagged> <summary>      (tagId empty: leave it untagged)
     panel-triage-undo <tagged>                                      */
const csv = text => String(text || "").split(",").filter(Boolean);
function triageNext(passed, tagged, summary) {
  let got;
  try { got = pluginModel("waiting", { max: 1, skip: csv(passed) }) || { count: 0, notes: [] }; }
  catch (error) { return JSON.stringify({ update: { ids: { tCount: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const note = (got.notes || [])[0], done = csv(tagged).length;
  if (!note) {
    const counts = {};
    csv(summary).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    const line = Object.keys(counts).map(function (t) { return t + " " + counts[t]; }).join(" · ");
    return JSON.stringify({ replace: { ids: { tbody: { type: "view", id: "tbody", layout: "inline", direction: "vertical", spacing: 16, components: [
      { type: "label", text: done ? "✓  " + plural(done, "note") + " tagged" + (got.count ? ", " + got.count + " passed by for now" : "") : got.count ? "Only notes you passed by are left: " + got.count : "Nothing waiting: every note from Alfred has a tag.", font: { size: 20 }, constraints: { position: "left" } },
      { type: "label", text: line, colour: SECONDARY, font: { size: 15 }, hidden: !line, constraints: { position: "left" } },
      { type: "view", layout: "inline", spacing: 18, constraints: { position: "right" }, components: [
        { type: "button", bordered: false, hidden: !done, text: "Undo all " + done + "  ⌘Z", shortcut: "⌘z", contenttintcolour: SECONDARY, font: { size: 15 }, events: [{ triggers: "actioned", action: { type: "script", src: "undo", args: [tagged] } }] },
        Object.assign({ type: "button", text: "Done  ↩", shortcut: "↩", events: [{ triggers: "actioned", action: { type: "json", src: { finish: {} } } }] }, GLASS)
      ] }
    ] } } }, sheet: { close: "tagSheet" }, update: { relayout: true }, window: { resize: { height: "auto" } } });
  }
  const buttons = (note.choices || []).slice(0, 3).map(function (c, i) {
    return { type: "button", bordered: false, text: "⌘" + (i + 1) + "   #" + c.title + (c.why ? "     " + c.why : ""), shortcut: "⌘" + (i + 1), contenttintcolour: i ? SECONDARY : "labelColor", font: { size: 16 }, constraints: { position: "left" },
      events: [{ triggers: "actioned", action: { type: "script", src: "tag", args: [note.uuid, String(c.id), passed, tagged, summary + "," + c.title] } }] };
  });
  return JSON.stringify({ variables: { t_uuid: note.uuid, t_passed: passed, t_tagged: tagged, t_summary: summary }, sheet: { close: "tagSheet" },
    update: { relayout: true, ids: {
      tCount: { text: (csv(passed).length + done + 1) + " of " + (got.count + done) + " · " + (note.page || "") },
      tWords: { text: note.words }
    } },
    replace: { ids: { tChoices: { type: "view", id: "tChoices", layout: "inline", direction: "vertical", spacing: 8, constraints: { position: "left" },
      components: buttons.length ? buttons : [{ type: "label", text: "No tag to suggest for these words. ⌘T lists all your tags.", colour: SECONDARY, font: { size: 15 } }] } } },
    window: { resize: { height: "auto" } } });
}
function triageTag(uuid, tagId, passed, tagged, summary) {
  try { pluginModel("tagWaiting", { uuid: uuid, tag: tagId ? Number(tagId) : null }); }
  catch (error) { return JSON.stringify({ update: { ids: { tCount: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  return triageNext(passed, tagId ? (tagged ? tagged + "," : "") + uuid : tagged, tagId ? summary : summary.replace(/,[^,]*$/, ""));
}
function triageUndo(tagged) {
  csv(tagged).forEach(function (uuid) { try { pluginModel("undo", { uuid: uuid }); } catch (_) { /* already changed by hand */ } });
  return JSON.stringify({ update: { ids: { tbody: {} } }, finish: {} });
}

/* ---------- Home (home.alfredui): one keyword that leads everywhere ----------
   At rest: the things you do, with what is waiting, then pages you came back to. Typing: pages by name at once, then the words
   as a note to add (⇥). ↩ goes: the panel closes and the workflow opens the next one (route).
     panel-home-start          panel-home-find <words>          panel-route <where>                                        */
const SUB_FONT = { size: 14 }, HEAD_FONT = { size: 14, weight: "semibold" }, HOME_ROW = 66;
const homeRow = (icon, title, sub, go, key) => ({ uid: go, "hIcon.image": { type: "symbol", src: icon }, "hTitle.text": title, "hSub.text": sub || "", "hSub.font": SUB_FONT, "hKey.text": key || "", "hGo.text": go });
// A group's heading: a row of the list with its words on the lower line; the arrows step past it (homePane).
const homeHead = text => ({ uid: "h:" + text, "hIcon.image": null, "hTitle.text": "", "hSub.text": text, "hSub.font": HEAD_FONT, "hKey.text": "", "hGo.text": "" });
const pageRow = (p, sub) => homeRow("doc.text", nodeTitle(p) || p.title || "", sub, "read:" + nodeUuid(p));
const tagsOf = p => (p.tags || []).map(t => t.title || t).filter(t => t && t !== "Page");
// The list as tall as its rows, and the panel with it, as Alfred's own results grow.
const homeAnswer = (rows, lit) => JSON.stringify({ variables: { h_order: rows.map(r => r.uid).join("¦"), h_lit: lit },
  update: { relayout: true, ids: { homeList: { data: { src: rows }, select: lit, constraints: { region: "centre", size: { height: rows.length * HOME_ROW + 6 } } } } }, window: { resize: { height: "auto" } } });

/* The second pane (19 November 2026): beside the list, what the lit row cannot say on its own line. A page shows its tags, its
   properties and where it leads; a note shows its words in full. An action has no pane, and the list takes the whole width. */
const PANE_FILL = { light: "#0000000a", dark: "#ffffff12" };   // the fill the selection panel's card has
const noPane = id => ({ type: "view", id: id, hidden: true, constraints: { region: "right", size: { width: 1 } }, components: [] });
const PANE_GAP = 16;
const paneLine = () => ({ type: "view", background: "separatorColor", constraints: { stretch: "horizontal", size: { height: 1 } } });
function paneView(id, uuid, width, withWords, lead) {
  const got = pluginModel("read", { uuid: uuid });
  const tags = [], inner = width - 36;
  const words = String(got.text || "").replace(/^# .*\n+/, "").split("\n").filter(function (line) {
    if (/^\s*(#\S+\s*)+$/.test(line)) { line.trim().split(/\s+/).forEach(t => tags.push(t.replace(/^#/, ""))); return false; }
    return true;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const left = { position: "left" }, parts = [];
  if (got.isPage || !withWords) {
    parts.push({ type: "label", text: got.title || "Untitled", font: { size: 20, weight: "medium" }, linebreak: "wordwrap", constraints: { position: "left", size: { width: inner } } });
    if (tags.length) parts.push({ type: "label", text: tags.join(", "), colour: SECONDARY, font: { size: 14 }, constraints: left });
  } else {
    if (lead || tags.length) parts.push({ type: "label", text: lead || tags.join(", "), colour: SECONDARY, font: { size: 14 }, linebreak: "truncatetail", constraints: left });
    parts.push({ type: "label", text: (words || got.title || "").slice(0, 600), font: { size: 16 }, linebreak: "wordwrap", constraints: { position: "left", size: { width: inner } } });
  }
  const props = (got.properties || []).filter(p => (p.values || []).length).slice(0, 6), form = [];
  props.forEach(function (p) {
    form.push({ type: "label", text: p.name, colour: SECONDARY, font: { size: 15 }, constraints: { position: "right" } });
    form.push({ type: "label", text: p.values.map(v => v.label).join(", "), font: { size: 15 }, linebreak: "truncatetail" });
  });
  if (form.length) parts.push({ type: "view", layout: "form", spacing: 7, components: form, constraints: left });
  const leads = (got.pointed || []).map(g => [g.name + " of", plural(g.nodes.length + g.more, g.kind || "node")]);
  if ((got.mentioned || []).length) leads.push(["Mentioned in", plural(got.mentionedCount, "node")]);
  if (leads.length) {
    parts.push(paneLine());
    leads.slice(0, 6).forEach(function (l) {
      parts.push({ type: "view", layout: "border", constraints: { stretch: "horizontal" }, components: [
        { type: "label", text: l[0], font: { size: 15 }, constraints: { region: "left" } },
        { type: "label", text: l[1], colour: SECONDARY, font: { size: 15 }, textalign: "right", constraints: { region: "centre", position: "right" } }
      ] });
    });
  }
  return { type: "view", id: id, layout: "inline", constraints: { region: "right", position: "top", size: { width: width + PANE_GAP } }, components: [
    { type: "view", constraints: { size: { width: PANE_GAP } }, components: [] },
    { type: "view", layout: "inline", direction: "vertical", padding: 18, spacing: 10, cornerradius: 16, background: PANE_FILL, constraints: { size: { width: width } }, components: parts }
  ] };
}
// The lit row changed. A heading is stepped past, the way the arrows were going; a page gets its pane; an action has none.
function homePane(go, title, order, lit) {
  const ids = String(order || "").split("¦");
  if (!go && !title) {
    const at = ids.findIndex(u => u.indexOf("h:") === 0), was = ids.indexOf(lit);
    const to = at < 0 ? "" : (was >= 0 && was > at ? ids[at - 1] : ids[at + 1]) || ids[at - 1] || "";
    return JSON.stringify(to ? { update: { ids: { homeList: { select: to } } } } : {});
  }
  const out = { variables: { h_lit: go }, replace: { ids: {} }, update: { relayout: true, ids: {} }, window: { resize: { height: "auto" } } };
  if (go.indexOf("read:") === 0) {
    try { out.replace.ids.hPane = paneView("hPane", go.slice(5), 330, false); } catch (_) { out.replace.ids.hPane = noPane("hPane"); }
    out.update.ids.hFoot = { text: "Read ↩      Open in Logseq ⌘↩" };
  } else {
    out.replace.ids.hPane = noPane("hPane");
    out.update.ids.hFoot = { text: go.indexOf("search:") === 0 ? "Search ↩" : "Open ↩" };
  }
  return JSON.stringify(out);
}
// "3 today · 1 late", from Todo's own list; nothing when the Todo part is off.
function todoCounts() {
  try {
    const got = pluginModel("todoList", {}) || { parts: [] }, today = (got.parts || []).find(p => p.head === "Today");
    const all = (got.parts || []).reduce((n, p) => n + p.rows.length + (p.more || 0), 0);
    if (!today) return plural(all, "open task");
    const late = today.rows.filter(r => r.late).length, now = today.rows.length - late;
    return [now ? now + " today" : "", late ? late + " late" : "", !now && !late ? plural(all, "open task") : ""].filter(Boolean).join(" · ");
  } catch (_) { return "Open tasks"; }
}
function homeStart() {
  let waiting = 0;
  try { waiting = (pluginModel("waiting", { max: 0 }) || {}).count || 0; } catch (_) { /* the plugin is off: no count */ }
  const rows = [
    homeRow("plus.circle", "Add to today", "Tag guessed as you write", "add:", "⌘1"),
    homeRow("number", "Tag what came in", waiting ? plural(waiting, "note") + " added from Alfred have no tag" : "Nothing waiting", "triage", "⌘2"),
    homeRow("checkmark.circle", "Todo", todoCounts(), "todo", "⌘3")
  ];
  let recent = [];
  try { recent = api("logseq.App.getCurrentGraphRecent", []) || []; } catch (_) { /* none */ }
  recent = recent.filter(p => p && nodeUuid(p)).slice(0, 5);
  if (recent.length) rows.push(homeHead("Pages you came back to"));
  recent.forEach(function (p) { rows.push(pageRow(p, tagsOf(p).join(", "))); });
  return homeAnswer(rows, "add:");
}
function homeFind(words) {
  if (!words.trim()) return homeStart();
  const q = words.trim().toLowerCase().replace(/["\\]/g, "");
  let pages = [];
  try {
    pages = (api("logseq.DB.datascriptQuery", ["[:find (pull ?p [:block/uuid :block/title {:block/tags [:block/title]}]) :where [?p :block/name ?n] [(clojure.string/includes? ?n \"" + q + "\")] (not [?p :logseq.property/deleted-at _])]"]) || []).map(r => r[0]);
  } catch (_) { /* nothing found */ }
  pages.sort(function (a, b) { const x = a.title.toLowerCase().indexOf(q), y = b.title.toLowerCase().indexOf(q); return (x === 0 ? 0 : 1) - (y === 0 ? 0 : 1) || a.title.length - b.title.length; });
  const rows = pages.slice(0, 7).map(p => pageRow(p, tagsOf(p).join(", ")));
  rows.push(homeRow("magnifyingglass", "Search notes for “" + words.trim() + "”", "Logseq's search, each note with its kind and day", "search:" + words.trim(), "⌘F"));
  rows.push(homeRow("plus.circle", "Add “" + words.trim() + "” to today", "tag guessed as you write", "add:" + words.trim(), "⇥"));
  return homeAnswer(rows, rows[0].uid);
}
// Where ↩ went: another panel, or a page shown in Logseq.
function route(where) {
  const at = where.indexOf(":"), kind = at < 0 ? where : where.slice(0, at), arg = at < 0 ? "" : where.slice(at + 1);
  // ⌘↩: the node itself in Logseq, a page shown, a bullet scrolled to on its page.
  if (kind === "open") {
    const uuid = arg.replace(/^[a-z]+:/, "");
    let node = null;
    try { node = api("logseq.Editor.getBlock", [uuid]); } catch (_) { /* a page */ }
    if (node && node.page && node.name == null) { try { api("logseq.Editor.scrollToBlockInPage", [uuid]); } catch (_) { /* gone */ } }
    else { try { api("logseq.App.pushState", ["page", { name: uuid }]); } catch (_) { /* gone */ } }
    return "";
  }
  if (kind === "block") { try { api("logseq.Editor.scrollToBlockInPage", [arg]); } catch (_) { /* gone */ } return ""; }
  if (kind === "page") { try { api("logseq.App.pushState", ["page", { name: arg }]); } catch (_) { /* gone */ } return ""; }
  const trigger = { add: "add", triage: "triage", todo: "todo", search: "search", read: "read", files: "files" }[kind];
  if (trigger) app.doShellScript("/usr/bin/osascript -e " + shellQuote('tell application id "com.runningwithcrayons.Alfred" to run trigger "' + trigger + '" in workflow "com.openai.alfred.logseq-db" with argument ' + JSON.stringify(arg)) + " >/dev/null 2>&1 &");
  return "";
}

/* ---------- Todo (todo.alfredui): the Todo page's list, grouped as it is there ----------
   Typing filters the list; ↩ with words adds them as a task ("by friday" is its Deadline, said before it is added); ⌘D marks the
   lit task done, ⌘G doing, ⌘Z takes the last change back, ⌘O shows the task in Logseq.
     panel-todo-list [note]   panel-todo-read <words>   panel-todo-add <words>   panel-todo-status <uuid> <status>   panel-todo-undo <uuid> */
const STATUS_SYMBOL = { todo: "circle", doing: "circle.lefthalf.filled", "in-review": "circle.dotted", backlog: "circle.dashed", done: "checkmark.circle.fill", canceled: "xmark.circle" };
function todoRows() {
  const got = pluginModel("todoList", {}) || { parts: [] }, rows = [];
  (got.parts || []).forEach(function (part) {
    if (!part.rows.length) return;   // an empty group is left out here: the panel is short
    rows.push({ uid: "h:" + part.head, "tIcon.image": null, "tWords.text": "", "tHead.text": part.head, "tDay.text": "", "tUuid.text": "", "tFind.text": "" });
    part.rows.forEach(function (r) {
      rows.push({ uid: r.uuid, "tIcon.image": { type: "symbol", src: STATUS_SYMBOL[r.status] || "circle" }, "tWords.text": r.words, "tHead.text": "", "tDay.text": r.day + (r.page ? (r.day ? " · " : "") + r.page : ""), "tDay.colour": r.late ? "systemRedColor" : SECONDARY, "tUuid.text": r.uuid, "tFind.text": r.words + " " + r.page });
    });
  });
  return rows;
}
function todoAnswer(note, lit) {
  let rows;
  try { rows = todoRows(); } catch (error) { return JSON.stringify({ update: { ids: { tNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const first = rows.find(r => r["tUuid.text"]);
  const out = { update: { relayout: true, ids: { todoList: { data: { src: rows }, select: lit || (first ? first.uid : ""), constraints: { stretch: "horizontal", size: { height: Math.min(rows.length, 9) * 50 + 6 } } } } }, window: { resize: { height: "auto" } } };
  if (note !== undefined) out.update.ids.tNote = { text: note, colour: SECONDARY };
  return JSON.stringify(out);
}
function todoRead(words) {
  // What ↩ would add, said before it is added: the words and the day read from them.
  if (!words.trim()) return JSON.stringify({ update: { ids: { tNote: { text: "" } } } });
  return JSON.stringify({ update: { ids: { tNote: { text: "↩ adds “" + words.trim() + "” as a task on today's journal", colour: SECONDARY } } } });
}
function todoAdd(words) {
  if (!words.trim()) return JSON.stringify({});
  try {
    const made = pluginModel("todoAdd", { words: words });
    const out = JSON.parse(todoAnswer("Added “" + made.words + "”" + (made.day ? ", deadline " + made.day : "") + ".   Undo ⌘Z", made.uuid));
    out.variables = { last_uuid: made.uuid };
    out.update.ids.tq = { text: "" };
    return JSON.stringify(out);
  } catch (error) { return JSON.stringify({ update: { ids: { tNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
}
function todoStatus(uuid, status) {
  if (!uuid) return JSON.stringify({});
  try {
    pluginModel("todoStatus", { uuid: uuid, status: status });
    const out = JSON.parse(todoAnswer((status === "done" ? "Done" : "Set to " + status) + ".   Undo ⌘Z", uuid));
    out.variables = { last_uuid: uuid };
    return JSON.stringify(out);
  } catch (error) { return JSON.stringify({ update: { ids: { tNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
}
function todoUndo(uuid) {
  try { pluginModel("todoUndo", { uuid: uuid }); return todoAnswer("Taken back.", uuid); }
  catch (error) { return JSON.stringify({ update: { ids: { tNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
}

/* ---------- Search (search.alfredui) and a page read here (read.alfredui) ----------
   Search: Logseq's own search through Find, each node with its kind and day; ↩ reads it here, ⌘↩ opens it in Logseq.
   A page read here: its words as DB Export writes them, then where it leads: its properties' pages, and what points at it by
   property, as Find opens a node in place. ↩ steps into the lit node, ⌘[ steps back along the path, ⌘↩ opens it in Logseq.
     panel-search <words>      panel-read <uuid> <path>      panel-back <path>                                             */
const nodeSub = n => [n.kind, n.day, n.page].filter(Boolean).join(" · ");
const nodeRow = (n, sub) => ({ uid: n.uuid, "rIcon.image": { type: "symbol", src: n.isPage ? "doc.text" : "text.alignleft" }, "rTitle.text": n.title, "rSub.text": sub == null ? nodeSub(n) : sub, "rHead.text": "", "rUuid.text": n.uuid });
// A group's heading: small and grey on the row's lower line, where Alfred puts a result's subtitle.
const headRow = (key, text) => ({ uid: "h:" + key, "rIcon.image": null, "rTitle.text": "", "rSub.text": text, "rHead.text": "", "rUuid.text": "" });
const listAnswer = (id, rows, lit, most) => ({ ids: { [id]: { data: { src: rows }, select: lit || (rows.find(r => r["rUuid.text"]) || {}).uid || "", constraints: { [id === "searchList" ? "region" : "stretch"]: id === "searchList" ? "centre" : "horizontal", size: { height: Math.max(1, Math.min(rows.length, most)) * 66 + 6 } } } } });
function searchAnswer(words) {
  let got = { nodes: [] };
  try { if (words.trim()) got = pluginModel("find", { words: words, limit: 30 }) || got; }
  catch (error) { return JSON.stringify({ update: { ids: { sNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const seen = {}, rows = (got.nodes || []).filter(n => !seen[n.uuid] && (seen[n.uuid] = true)).map(n => nodeRow(n));
  const out = { update: Object.assign({ relayout: true }, listAnswer("searchList", rows, "", 7)), window: { resize: { height: "auto" } } };
  out.update.ids.sNote = { text: !words.trim() ? "" : rows.length ? plural(rows.length, "node") : "Nothing has these words.", colour: SECONDARY };
  return JSON.stringify(out);
}
// The lit result changed: its pane. A page shows its tags, properties and where it leads; a note its words in full.
function searchPane(uuid, sub) {
  const out = { replace: { ids: {} }, update: { relayout: true }, window: { resize: { height: "auto" } } };
  try { out.replace.ids.sPane = uuid ? paneView("sPane", uuid, 360, true, sub) : noPane("sPane"); } catch (_) { out.replace.ids.sPane = noPane("sPane"); }
  return JSON.stringify(out);
}
function readAnswer(uuid, path) {
  let got;
  try { got = pluginModel("read", { uuid: uuid }); }
  catch (error) { return JSON.stringify({ update: { ids: { pTitle: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const rows = [];
  const linked = (got.properties || []).filter(p => p.values.some(v => v.uuid));
  if (linked.length) {
    rows.push(headRow("props", "Its properties"));
    linked.forEach(p => p.values.filter(v => v.uuid).forEach(v => rows.push(nodeRow({ uuid: v.uuid, title: v.label, isPage: true }, p.name))));
  }
  (got.pointed || []).forEach(function (g, i) {
    rows.push(headRow("g" + i, g.name + " of · " + plural(g.nodes.length + g.more, g.kind || "node")));
    g.nodes.forEach(n => rows.push(nodeRow(n)));
  });
  if ((got.mentioned || []).length) {
    rows.push(headRow("m", "Mentioned in · " + plural(got.mentionedCount, "node")));
    got.mentioned.forEach(n => rows.push(nodeRow(n)));
  }
  // The words as DB Export writes them, less the title (drawn above) and the tag line (drawn beside the title: Alfred's Markdown
  // reads "#Doctor" as a heading).
  const tags = [];
  const words = String(got.text || "").replace(/^# .*\n+/, "").split("\n").filter(function (line) {
    if (/^\s*(#\S+\s*)+$/.test(line)) { line.trim().split(/\s+/).forEach(t => tags.push(t)); return false; }
    return true;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Relations below the bullets (the owner, 19 November 2026): DB Export writes a page's properties above its bullets; here the
  // bullets come first, then the properties. One whose value is a page is left to its row in the list under them, said once.
  const blocks = words.split(/\n\n+/), isProp = line => /^[^:\n]{1,60}: \S/.test(line.trim());
  let shown = words;
  if (blocks.length && blocks[0].split("\n").every(isProp)) {
    const linkedNames = linked.map(p => p.name.toLowerCase());
    const kept = blocks[0].split("\n").filter(line => linkedNames.indexOf(line.split(":")[0].trim().toLowerCase()) < 0);
    shown = blocks.slice(1).concat(kept.length ? [kept.join("\n")] : []).join("\n\n").trim();
  }
  const trail = csv(path).concat([uuid]);
  const out = { variables: { r_path: trail.join(","), r_uuid: uuid, r_page: got.isPage ? "1" : "" },
    update: Object.assign({ relayout: true }, listAnswer("readList", rows, "", 7)), window: { resize: { height: "auto" } } };
  Object.assign(out.update.ids, {
    pTrail: { text: trail.length > 1 ? "Back ⌘[ · " + plural(trail.length - 1, "step") + " walked" : "" },
    pTitle: { text: got.title || "Untitled", colour: "labelColor" },
    pTags: { text: tags.join("  ") },
    pText: { text: shown || "—", hidden: !shown, constraints: { stretch: "horizontal", size: { height: Math.min(300, 18 + 30 * shown.split("\n").filter(Boolean).length) } } },
    pFoot: { text: rows.length ? "↩ walks into the lit one      ⌘[ back      ⌘↩ open in Logseq" : "Nothing points here.      ⌘[ back      ⌘↩ open in Logseq" }
  });
  return JSON.stringify(out);
}
function backAnswer(path) {
  const trail = csv(path);
  trail.pop();
  const to = trail.pop();
  return to ? readAnswer(to, trail.join(",")) : JSON.stringify({ finish: {} });
}

/* ---------- The files tray (files.alfredui) ----------
   Files from Finder (the Universal Action) or the Open dialog: each with the name its node will have, and the ones already in the
   graph named before anything is added (they are linked, not copied again). While adding, a progress bar the plugin moves; then
   what went in, with one Undo for all.
     panel-files-show <paths> [more]    panel-files-add <paths> <where>    panel-files-progress    panel-files-undo <made>        */
function pathsIn(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(String); } catch (_) { /* plain words */ }
  return raw.split(/\t|\n/).map(s => s.trim()).filter(p => p.indexOf("/") === 0);
}
const sizeText = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " bytes";
function filesShow(text, more) {
  const paths = pathsIn(text).concat(pathsIn(more)).filter((p, i, all) => all.indexOf(p) === i);
  if (!paths.length) return JSON.stringify({ update: { ids: { fHead: { text: "Choose files with ⌘O, or send them here from Finder" } } } });
  let got;
  try { got = pluginModel("check", { files: paths }) || { files: [] }; }
  catch (error) { return JSON.stringify({ update: { ids: { fHead: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const fresh = got.files.filter(f => !f.twin && !f.said), twins = got.files.filter(f => f.twin), bad = got.files.filter(f => f.said);
  const rows = got.files.map(f => ({ uid: f.path,
    "fIcon.image": /^(PNG|JPE?G|GIF|HEIC|WEBP)$/.test(f.type) ? { type: "file", src: f.path } : { type: "fileicon", src: f.path },
    "fTitle.text": f.title, "fSub.text": f.said ? f.said : f.twin ? "already in the graph as “" + f.twin + "”: it will be linked, not copied again" : [f.type, sizeText(f.size)].filter(Boolean).join(" · "),
    "fSub.colour": f.said ? "systemRedColor" : SECONDARY, "fState.text": "" }));
  const sentence = [fresh.length ? plural(fresh.length, "file") + (fresh.length === 1 ? " goes in" : " go in") : "Nothing new to copy",
    twins.length ? plural(twins.length, "file") + " " + (twins.length === 1 ? "is" : "are") + " already in the graph and will be linked" : "",
    bad.length ? plural(bad.length, "file") + " could not be read" : ""].filter(Boolean).join(". ") + ".";
  return JSON.stringify({ variables: { f_paths: JSON.stringify(got.files.filter(f => !f.said).map(f => f.path)) },
    update: { relayout: true, ids: {
      fHead: { text: "Add " + plural(paths.length, "file") },
      fList: { data: { src: rows }, constraints: { stretch: "horizontal", size: { height: Math.min(rows.length, 6) * 66 + 6 } } },
      fCard: { text: sentence, hidden: false },
      // The key named by what it does: "Add 2 files, link 1".
      fGo: { text: [fresh.length ? "Add " + plural(fresh.length, "file") : "", twins.length ? (fresh.length ? "link " : "Link ") + twins.length : ""].filter(Boolean).join(", ") + "  ↩", enabled: fresh.length + twins.length > 0 }
    } }, window: { resize: { height: "auto" } } });
}
function filesAdd(text, where) {
  const paths = pathsIn(text);
  if (!paths.length) return JSON.stringify({});
  try {
    const answer = api("logseq.App.invokeExternalPluginCmd", [PLUGIN_ID, "models", "add", [{ files: paths, where: whereOf(where), linkTwins: true }]], 120) || {};
    return answer.pending ? JSON.stringify({}) : filesProgress();
  } catch (error) { return JSON.stringify({ pulse: { interval: 0 }, update: { ids: { fCard: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
}
function filesProgress() {
  let p;
  try { p = pluginModel("progress", {}) || {}; } catch (error) { return JSON.stringify({}); }
  const total = Math.max(1, p.total || 0), finished = !p.now && p.done >= (p.total || 0);
  const out = { update: { ids: {
    fBar: { progress: (p.done || 0) / total, hidden: false },
    fCard: { text: p.failed ? p.failed : finished ? "✓  " + plural(p.done || 0, "file") + " in on " + (p.page || "the page") + (p.linked && p.linked.length ? ", " + plural(p.linked.length, "file") + " linked" : "") + ". You can close this." : (p.done || 0) + " of " + (p.total || 0) + " in · Logseq is taking " + (p.now || "the next") + "… You can close this: the files keep going in.", colour: p.failed ? "systemRedColor" : "labelColor" }
  } } };
  if (finished || p.failed) {
    out.pulse = { interval: 0 };
    out.variables = { f_made: (p.made || []).join(",") };
    out.replace = { ids: { fGo: Object.assign({ type: "button", id: "fGo", text: "Done  ↩", shortcut: "↩", constraints: { region: "right", position: "right" }, events: [{ triggers: "actioned", action: { type: "json", src: { finish: {} } } }] }, GLASS) } };
    out.update.ids.fUndo = { hidden: !(p.made || []).length };
    out.variables.f_done = "1";
  }
  return JSON.stringify(out);
}
function filesUndo(made) {
  try { pluginModel("unadd", { made: csv(made) }); } catch (error) { return JSON.stringify({ update: { ids: { fCard: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  return JSON.stringify({ update: { ids: { fCard: { text: "Taken back out of the page. The files' copies stay in the graph's assets folder.", colour: "labelColor" }, fUndo: { hidden: true } } } });
}

/* ---------- A selection, seen before it goes in (selection.alfredui) ----------
   The Universal Action or the hotkey reads the selection first (selection-prepare, as the workflow always has: a quote with its
   citation, a web page's link, a document), then the panel shows what will be written, where, and the tag it could be.
   Files go to the files tray instead.
     selection-prepare <items…>     panel-sel-show <prepared>     panel-sel-add <prepared> <where> <tag> <own words>          */
function appName() {
  const id = env("source_app", "");
  if (!id) return "";
  try { const url = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(id); return url && !url.isNil() ? ObjC.unwrap(url.lastPathComponent).replace(/\.app$/, "") : ""; } catch (_) { return ""; }
}
// The prepared selection travels to the panel as base64: Alfred UI reads braces in a launch argument as placeholders (an argument
// holding JSON arrived empty, 18 November 2026).
function packed(object) { return ObjC.unwrap($(JSON.stringify(object)).dataUsingEncoding($.NSUTF8StringEncoding).base64EncodedStringWithOptions(0)); }
function unpacked(text) {
  const raw = String(text || "").trim();
  if (!raw || raw.charAt(0) === "{") return JSON.parse(raw || "{}");
  const data = $.NSData.alloc.initWithBase64EncodedStringOptions($(raw), 0);
  return JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)));
}
function selectionPrepare(items) {
  const files = items.filter(isFile);
  try {
    if (files.length) return packed({ files: files });
    const found = selectionContent(items.join("\n"));
    if (found.file) return packed({ files: [found.file] });
    return packed({ content: found.content, title: found.title || "", hasWords: Boolean(found.hasWords), app: appName() });
  } catch (error) { return packed({ said: messageFrom(error) }); }
}
// The quote as it will read in Logseq, not as Markdown: a quoted line in quotation marks, a link as its words and its site.
function readable(markdown) {
  return String(markdown).split("\n").map(function (line) {
    const quoted = /^>\s?(.*)$/.exec(line);
    return (quoted ? "“" + quoted[1] + "”" : line).replace(/\[([^\]]+)\]\((https?:\/\/([^\/)]+)[^)]*)\)/g, function (_, words, url, host) { return words + " · " + host.replace(/^www\./, ""); });
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}
function selShow(prepared) {
  let got = {};
  try { got = unpacked(prepared); } catch (_) { got = { said: "The selection could not be read" }; }
  if (got.files) return JSON.stringify({ finish: { args: "files:" + got.files.join("\t") } });
  if (got.said) return JSON.stringify({ update: { ids: { sSource: { text: got.said, colour: "systemRedColor" } } } });
  const answer = JSON.parse(guessAnswer(String(got.content || "").split("\n")[0].replace(/^>\s*/, ""), "today", ""));
  Object.assign(answer.update.ids, {
    sSource: { text: [got.app ? "From " + got.app : "", got.title].filter(Boolean).join(" · ") },
    sText: { text: readable(got.content || "") },
    sGo: { text: (got.hasWords ? "Add quote" : "Add link") + "  ↩" }
  });
  answer.variables.s_title = got.title || "";
  return JSON.stringify(answer);
}
function selAdd(prepared, where, tag, own) {
  let got = {};
  try { got = unpacked(prepared); } catch (_) { /* nothing */ }
  if (!got.content) return JSON.stringify({});
  const target = where === "page" ? { page: got.title || "Untitled" } : whereOf(where);
  try {
    const answer = pluginModel("note", { words: got.content, where: target, tag: tag ? Number(tag) : null, take: "all" });
    if (own && own.trim()) api("logseq.Editor.insertBlock", [answer.uuid, own.trim(), { sibling: false }]);
    return JSON.stringify({ variables: { last_uuid: answer.uuid }, replace: { ids: { body: doneView(Object.assign({ words: "" }, answer), where) } }, update: { relayout: true }, window: { resize: { height: "auto" } } });
  } catch (error) { return JSON.stringify({ update: { ids: { sSource: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
}

function panel(command, items) {
  if (command === "panel-guess") return guessAnswer(items[0] || "", items[1] || "today", items[2] || "");
  if (command === "panel-add") return addAnswer(items[0] || "", items[1] || "today", items[2] || "", items[3] || "all", items[4] || "");
  if (command === "panel-sel-show") return selShow(items[0] || "");
  if (command === "panel-sel-add") return selAdd(items[0] || "", items[1] || "today", items[2] || "", items[3] || "");
  if (command === "panel-files-show") return filesShow(items[0] || "", items[1] || "");
  if (command === "panel-files-add") return filesAdd(items[0] || "", items[1] || "today");
  if (command === "panel-files-progress") return filesProgress();
  if (command === "panel-files-undo") return filesUndo(items[0] || "");
  if (command === "panel-search") return searchAnswer(items[0] || "");
  if (command === "panel-search-pane") return searchPane(items[0] || "", items[1] || "");
  if (command === "panel-read") return readAnswer(items[0] || "", items[1] || "");
  if (command === "panel-back") return backAnswer(items[0] || "");
  if (command === "panel-todo-list") return todoAnswer("");
  if (command === "panel-todo-read") return todoRead(items[0] || "");
  if (command === "panel-todo-add") return todoAdd(items[0] || "");
  if (command === "panel-todo-status") return todoStatus(items[0] || "", items[1] || "done");
  if (command === "panel-todo-undo") return todoUndo(items[0] || "");
  if (command === "panel-home-start") return homeStart();
  if (command === "panel-home-find") return homeFind(items[0] || "");
  if (command === "panel-home-pane") return homePane(items[0] || "", items[1] || "", items[2] || "", items[3] || "");
  if (command === "panel-route") return route(items[0] || "");
  if (command === "panel-triage-next") return triageNext(items[0] || "", items[1] || "", items[2] || "");
  if (command === "panel-triage-tag") return triageTag(items[0] || "", items[1] || "", items[2] || "", items[3] || "", items[4] || "");
  if (command === "panel-triage-undo") return triageUndo(items[0] || "");
  if (command === "panel-tags") return tagsAnswer(items[0] || "");
  if (command === "panel-pick") return pickAnswer(items[0] || "", items[1] || "today", items[2] || "");
  if (command === "panel-undo") return undoAnswer(items[0] || "", items[1] || "");
  if (command === "panel-show") { try { api("logseq.Editor.scrollToBlockInPage", [items[0]]); } catch (_) { /* gone */ } return JSON.stringify({ finish: {} }); }
  return "";
}

function main(argv) {
  const command = argv.length ? String(argv[0]) : "";
  const items = argv.slice(1).map(String).filter(function (s) { return s.trim(); });
  const words = items.join(" ").trim();
  // The panel's commands keep their arguments apart (an empty one counts), and answer in Alfred UI's JSON.
  if (command.indexOf("panel-") === 0) return panel(command, argv.slice(1).map(String));
  if (command === "selection-prepare") return selectionPrepare(items);
  try {
    requireDbGraph();
    if (command === "today") {
      if (!words) throw new Error("Type what to add");
      appendTo(todayPage(), words);
      return "Added to Today";
    }
    if (command === "active") {
      if (!words) throw new Error("Type what to add");
      const page = openPage();
      appendTo(page, words);
      return "Added to “" + nodeTitle(page) + "”";
    }
    if (command === "page") {
      const named = pageNamed(words);
      showPage(named.page);
      const tagged = named.tags.length ? " with #" + named.tags.join(" #") : "";
      return (named.made ? "Made the page “" : "Found the page “") + nodeTitle(named.page) + "”" + tagged;
    }
    if (command === "picture") {
      const path = clipboardPicture();
      const answer = addFiles([path], words ? { page: words } : "today");
      return stillGoing(answer, ["the picture"]) || (words ? "Added the picture to “" + words + "”" : "Added the picture to Today");
    }
    if (command === "today-selection") return selectionToToday(items);
    if (command === "page-selection") return selectionToPage(items);
    throw new Error("Unknown workflow command");
  } catch (error) {
    return "Error: " + messageFrom(error);
  }
}

function run(argv) {
  return main(argv || []);
}
