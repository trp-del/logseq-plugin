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
// A model the running plugin does not have answers null (the plugin off, reloading, or older than this workflow). For what a panel cannot
// do without, that is said in the panel instead of leaving it waiting (the owner's page view stood at "Reading…", 19 November 2026).
const PLUGIN_OLD = "The Logseq Plugin in Logseq did not answer. It may be off, reloading, or older than this workflow. Try again in a moment.";
function pluginMust(name, request) {
  const got = pluginModel(name, request);
  if (got == null) throw new Error(PLUGIN_OLD);
  return got;
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
  return { type: "view", id: "body", layout: "inline", direction: "vertical", spacing: 12, components: [
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
  const pick = { type: "script", src: "pick", args: ["{value:words.text}", "{value:where.selected.value}", "{value:sheetList.selected.sheetId.text}"] };
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

/* ---------- Home (home.alfredui): Home as Find, below the pane ---------- */
const SUB_FONT = { size: 14 }, HEAD_FONT = { size: 14, weight: "semibold" };

/* The second pane (19 November 2026): beside the list, what the lit row cannot say on its own line. A page shows its tags, its
   properties and where it leads; a note shows its words in full. An action has no pane, and the list takes the whole width. */
const PANE_FILL = { light: "#0000000a", dark: "#ffffff12" };   // the fill the selection panel's card has
const noPane = id => ({ type: "view", id: id, hidden: true, constraints: { region: "right", size: { width: 1 } }, components: [] });
const PANE_GAP = 12;
const paneLine = () => ({ type: "view", background: "separatorColor", constraints: { stretch: "horizontal", size: { height: 1 } } });
// The lit row changed. A heading is stepped past, the way the arrows were going; a page gets its pane; an action has none.
function homePane(go, title, order, lit, tabLabel) {
  const ids = String(order || "").split("¦");
  if (!go && !title) {
    const at = ids.findIndex(u => u.indexOf("h:") === 0), was = ids.indexOf(lit);
    const to = at < 0 ? "" : (was >= 0 && was > at ? ids[at - 1] : ids[at + 1]) || ids[at - 1] || "";
    return JSON.stringify(to ? { update: { ids: { homeList: { select: to } } } } : {});
  }
  const out = { variables: { h_lit: go }, replace: { ids: {} }, update: { relayout: true, ids: {} }, window: { resize: { height: "auto" } } };
  if (go.indexOf("read:") === 0) {
    try { out.replace.ids.hPane = paneView("hPane", go.slice(5), 330, false); } catch (_) { out.replace.ids.hPane = noPane("hPane"); }
  } else out.replace.ids.hPane = noPane("hPane");
  Object.assign(out.update.ids, homeFoot(go, tabLabel || "", null));
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
/* Home as Find (the owner, 19 November 2026: "is it possible to make it more like find from plugin?"). One panel that finds,
   narrows and walks, as the plugin's Find does, from the plugin's browse:
     nothing typed   Add to today (⌘1) and Todo (⌘2) as buttons, your kinds with counts, the pages you came back to
     letters         pages by name, then Logseq's search; the kinds among them as choices; the letters light a kind
     a kind taken    it stands before the line; its nodes newest first, the day in the margin; the choices the graph holds for
                     them (Provider, Topic, When; Status for tasks) as lines above; the letters narrow and light a choice
   ⇥ takes the lit choice (the letters that lit it go), a press on a choice takes it, ⌘⌫ or a press on a taken one lets it go;
   ↩ reads the lit row (the page view, walking on from there), ⌘↩ opens it in Logseq. With a task lit, ⌘D done, ⌘G doing, ⌘Z
   takes it back. The state travels in h_state (base64 JSON: kind, picks, month), so every script answers from it.
     panel-home-start   panel-home-find <words> <state>   panel-home-take <words> <state> <what>   panel-home-tab <words> <state> <tab>
     panel-home-untake <words> <state> [index]   panel-home-status <uuid> <status> <words> <state>   panel-home-undo <uuid> <words> <state> */
const HOME_ROW = 56, HOME_MOST = 7;
const SYMBOL_OF = r => r.status ? (STATUS_SYMBOL[r.status] || "circle") : r.isPage ? "doc.text" : "text.alignleft";
const homeState = text => { try { const st = unpacked(text || ""); return { kind: st.kind || null, kindTitle: st.kindTitle || "", picks: st.picks || [], month: st.month || null, monthLabel: st.monthLabel || "" }; } catch (_) { return { kind: null, kindTitle: "", picks: [], month: null, monthLabel: "" }; } };
const lastWord = words => (String(words).trim().split(/\s+/).pop() || "").toLowerCase();
const begins = (label, words) => { const w = lastWord(words); return w.length >= 2 && String(label).toLowerCase().split(/\s+/).some(x => x.replace(/^dr\.?$/, "").indexOf(w) === 0 && x.length) || (w.length >= 2 && String(label).toLowerCase().indexOf(w) === 0); };
function homeListView(rows, lit, withDay) {
  const left = [];
  if (withDay) left.push({ type: "label", id: "hDay", font: { size: 14 }, colour: SECONDARY, constraints: { position: "centre", size: { width: 56 } } });
  left.push({ type: "imageview", id: "hIcon", constraints: { position: "centre", size: { width: 24, height: 24 } } });
  return { type: "dataview", id: "homeList", placeholder: "Nothing found",
    constraints: { region: "centre", size: { height: Math.max(1, Math.min(rows.length, HOME_MOST)) * HOME_ROW + 6 } },
    behaviour: { selection: { wrap: "vertical" } },
    events: [{ triggers: "changed", action: { type: "script", src: "pane", async: true, args: ["{value:homeList.selected.hGo.text}", "{value:homeList.selected.hTitle.text}", "{var:h_order}", "{var:h_lit}", "{var:h_tabLabel}"] } }],
    cell: { height: HOME_ROW,
      init: { "hRow.background": null, "hTitle.colour": "labelColor", "hSub.colour": SECONDARY, "hIcon.contenttintcolour": SECONDARY },
      selected: { "hRow.background": SOFT_ROW },
      root: { type: "view", id: "hRow", layout: "border", padding: 8, spacing: 12, cornerradius: 12, components: [
        { type: "view", layout: "inline", spacing: 10, constraints: { region: "left", position: "centre" }, components: left },
        { type: "view", layout: "inline", direction: "vertical", spacing: 3, constraints: { region: "centre", size: { height: 44 } }, components: [
          { type: "label", id: "hTitle", font: { size: 18 }, linebreak: "truncatetail", constraints: { position: "left", size: { height: 24 } } },
          { type: "label", id: "hSub", font: { size: 14 }, linebreak: "truncatetail", constraints: { position: "left", size: { height: 19 } } }
        ] },
        { type: "label", id: "hGo", hidden: true }
      ] } },
    data: { type: "basic", src: rows }, select: lit };
}
const nodeHomeRow = (r, heading) => ({ uid: "read:" + r.uuid, "hIcon.image": { type: "symbol", src: SYMBOL_OF(r) }, "hDay.text": r.day || "", "hTitle.text": r.title,
  "hSub.text": heading ? [r.kind, r.page].filter(Boolean).join(" · ") : [r.kind, r.page].filter(Boolean).join(" · "), "hSub.font": SUB_FONT, "hGo.text": "read:" + r.uuid });
const homeHeadRow = text => ({ uid: "h:" + text, "hIcon.image": null, "hDay.text": "", "hTitle.text": "", "hSub.text": text, "hSub.font": HEAD_FONT, "hGo.text": "" });
const addRow = words => ({ uid: "add:" + words, "hIcon.image": { type: "symbol", src: "plus.circle" }, "hDay.text": "", "hTitle.text": "Add “" + words + "” to today", "hSub.text": "as a note, its tag guessed as you write", "hSub.font": SUB_FONT, "hGo.text": "add:" + words });
// A line of choices: its name, then its values as presses; the lit one (the letters began it) in a capsule.
function choiceLine(name, items) {
  return { type: "view", layout: "inline", spacing: 6, constraints: { position: "left" }, components: [
    { type: "label", text: name, colour: SECONDARY, font: { size: 14 }, constraints: { position: "centre", size: { width: 78 } } }
  ].concat(items.map(it => Object.assign({ type: "button", text: it.text, font: { size: 15 }, tooltip: it.tip || "",
    events: [{ triggers: "actioned", action: { type: "script", src: "take", args: ["{value:hq.text}", "{var:h_state}", it.what] } }] },
    it.lit ? { bordered: true, bordershape: "capsule" } : { bordered: false, contenttintcolour: it.key ? "labelColor" : "labelColor" }))) };
}
function doLine(todo) {
  const press = (text, key, go) => ({ type: "button", text: text + "   " + key, font: { size: 15 }, bordered: true, bordershape: "capsule", shortcut: key.toLowerCase(),
    events: [{ triggers: "actioned", action: { type: "json", src: { finish: { args: go } } } }] });
  return { type: "view", layout: "inline", spacing: 8, constraints: { position: "left" }, components: [
    { type: "label", text: "Do", colour: SECONDARY, font: { size: 14 }, constraints: { position: "centre", size: { width: 78 } } },
    press("Add to today", "⌘1", "add:{value:hq.text}"),
    press("Todo" + (todo ? " · " + todo : ""), "⌘2", "todo")
  ] };
}
// The picks before the line: each a capsule; a press lets it go.
function picksView(st) {
  const parts = [];
  if (st.kind) parts.push(st.kindTitle);
  st.picks.forEach(p => parts.push(p.label));
  if (st.month) parts.push(st.monthLabel);
  return { type: "view", id: "hPicks", layout: "inline", spacing: 6, hidden: !parts.length, constraints: { region: "left", position: "centre" },
    components: parts.map((label, i) => ({ type: "button", text: label + "  ×", font: { size: 16 }, bordered: true, bordershape: "capsule", tooltip: "Let it go",
      events: [{ triggers: "actioned", action: { type: "script", src: "untake", args: ["{value:hq.text}", "{var:h_state}", String(i)] } }] })) };
}
function homeAnswerFind(words, st, lit, note) {
  const typed = String(words || "").trim();
  const ask = { kind: st.kind, picks: st.picks.map(p => p.p), month: st.month, words: typed, limit: 40 };
  let got;
  try { got = pluginMust("browse", ask); }
  catch (error) { return JSON.stringify({ update: { ids: { hCount: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const lines = [], rows = [];
  let tab = "", tabLabel = "", count = "";
  if (!st.kind) {
    if (!typed) {
      lines.push(doLine(todoCounts()));
    }
    const kinds = (got.kinds || []).map(k => ({ text: k.title + "  " + k.count, what: "kind:" + k.id + ":" + k.title, lit: typed && !tab && begins(k.title, typed) && (tab = "kind:" + k.id + ":" + k.title) && (tabLabel = k.title) }));
    if (kinds.length) lines.push(choiceLine("Kind", kinds.slice(0, 6)));
    if (!typed && (got.rows || []).length) rows.push(homeHeadRow("Pages you came back to"));
    (got.rows || []).forEach(r => rows.push(nodeHomeRow(r)));
    if (typed) rows.push(addRow(typed));
    count = typed ? plural((got.rows || []).length, "node") : "";
  } else {
    (got.choices || []).forEach(function (c) {
      lines.push(choiceLine(c.name, c.values.slice(0, 4).map(v => {
        const what = "pick:" + c.name + "=" + v.key + ":" + v.label, on = typed && !tab && begins(v.label, typed);
        if (on) { tab = what; tabLabel = v.label; }
        return { text: v.label + "  " + v.count, what: what, lit: on };
      })));
    });
    if ((got.months || []).length > 1) lines.push(choiceLine("When", got.months.map(m => {
      const what = "month:" + m.key + ":" + m.label + " " + String(m.key).slice(0, 4), on = typed && !tab && begins(m.label, typed);
      if (on) { tab = what; tabLabel = m.label; }
      return { text: m.label + "  " + m.count, what: what, lit: on };
    })));
    (got.rows || []).forEach(r => rows.push(nodeHomeRow(r)));
    count = plural(got.total, got.kind.title === "Task" ? "task" : "node") + (got.cutFrom ? ", the newest of " + got.cutFrom : "");
  }
  const withDay = rows.some(r => r["hDay.text"]);
  const first = rows.find(r => r["hGo.text"]);
  lit = lit && rows.some(r => r.uid === lit) ? lit : first ? first.uid : "";
  const out = {
    variables: { h_state: packed(st), h_tab: tab, h_tabLabel: tabLabel, h_order: rows.map(r => r.uid).join("¦"), h_lit: lit },
    replace: { ids: {
      hPicks: picksView(st),
      hLines: { type: "view", id: "hLines", layout: "inline", direction: "vertical", spacing: 10, hidden: !lines.length, constraints: { stretch: "horizontal" }, components: lines },
      homeList: homeListView(rows, lit, withDay)
    } },
    update: { relayout: true, ids: {
      hLine2: { hidden: !lines.length },
      hCount: { text: note || count, colour: SECONDARY },
      hq: { placeholder: st.kind ? "Narrow " + st.kindTitle + " by words, or a choice" : "Find, or write a note" }
    } },
    window: { resize: { height: "auto" } }
  };
  Object.assign(out.update.ids, homeFoot(lit, tabLabel, st));
  return JSON.stringify(out);
}
// What ⇥ and ↩ do right now, at the foot (Find's foot: "narrow to Consultation", "read Dr. Mei Chen").
function homeFoot(go, tabLabel, st) {
  const parts = [];
  if (tabLabel) parts.push("⇥ narrow to " + tabLabel);
  if (go.indexOf("read:") === 0) parts.push("↩ read", "⌘↩ open in Logseq");
  else if (go.indexOf("add:") === 0) parts.push("↩ write the note");
  if (st && st.kindTitle === "Task") parts.unshift("Done ⌘D", "Doing ⌘G");
  return { hFoot: { text: parts.join("      ") } };
}
function homeStart() { return homeAnswerFind("", homeState(""), ""); }
function homeFind(words, state) { return homeAnswerFind(words, homeState(state), ""); }
// A choice taken, by a press or by ⇥: "kind:<id>:<title>", "pick:<Name=key>:<label>", "month:<key>:<label>". The letters that lit it go.
function homeTake(words, state, what) {
  const st = homeState(state), m = /^(kind|pick|month):([^:]*):(.*)$/.exec(String(what || ""));
  if (!m) return homeAnswerFind(words, st, "");
  if (m[1] === "kind") { st.kind = Number(m[2]); st.kindTitle = m[3]; st.picks = []; st.month = null; st.monthLabel = ""; }
  if (m[1] === "pick" && !st.picks.some(p => p.p === m[2])) st.picks.push({ p: m[2], label: m[3] });
  if (m[1] === "month") { st.month = Number(m[2]); st.monthLabel = m[3]; }
  const rest = begins(m[3], words) ? String(words).trim().split(/\s+/).slice(0, -1).join(" ") : String(words || "").trim();
  const out = JSON.parse(homeAnswerFind(rest, st, ""));
  out.update.ids.hq = Object.assign(out.update.ids.hq || {}, { text: rest });
  return JSON.stringify(out);
}
function homeTab(words, state, tab) { return tab ? homeTake(words, state, tab) : JSON.stringify({}); }
// A taken one let go: the one pressed, or (⌘⌫) the last. Letting the kind go lets everything go.
function homeUntake(words, state, index) {
  const st = homeState(state);
  const all = [].concat(st.kind ? ["kind"] : [], st.picks.map((p, i) => "pick" + i), st.month ? ["month"] : []);
  const which = index === "" || index == null ? all[all.length - 1] : all[Number(index)];
  if (!which) return JSON.stringify({});
  if (which === "kind") return homeAnswerFind(words, homeState(""), "");
  if (which === "month") { st.month = null; st.monthLabel = ""; }
  else st.picks.splice(Number(which.slice(4)), 1);
  return homeAnswerFind(words, st, "");
}
// ⌘D, ⌘G on a lit task, and ⌘Z: Todo's own writes with their Undo, then the list read again with the same row lit.
function homeStatus(go, status, words, state) {
  if (go.indexOf("read:") !== 0) return JSON.stringify({});
  const uuid = go.slice(5);
  try { pluginMust("todoStatus", { uuid: uuid, status: status }); }
  catch (error) { return JSON.stringify({ update: { ids: { hCount: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const out = JSON.parse(homeAnswerFind(words, homeState(state), go, (status === "done" ? "Done" : "Set to " + status) + ".   Undo ⌘Z"));
  out.variables.h_last = uuid;
  return JSON.stringify(out);
}
function homeUndo(uuid, words, state) {
  if (!uuid) return JSON.stringify({});
  try { pluginMust("todoUndo", { uuid: uuid }); }
  catch (error) { return JSON.stringify({ update: { ids: { hCount: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const out = JSON.parse(homeAnswerFind(words, homeState(state), "read:" + uuid, "Taken back."));
  out.variables.h_last = "";
  return JSON.stringify(out);
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
  const trigger = { home: "home", add: "add", todo: "todo", search: "search", read: "read", files: "files" }[kind];
  if (trigger) app.doShellScript("/usr/bin/osascript -e " + shellQuote('tell application id "com.runningwithcrayons.Alfred" to run trigger "' + trigger + '" in workflow "com.openai.alfred.logseq-db" with argument ' + JSON.stringify(arg)) + " >/dev/null 2>&1 &");
  return "";
}

/* ---------- Todo (todo.alfredui): the Todo page's list, grouped as it is there ----------
   Typing filters the list; ↩ with words adds them as a task ("by friday" is its Deadline, said before it is added); ⌘D marks the
   lit task done, ⌘G doing, ⌘Z takes the last change back, ⌘O shows the task in Logseq.
     panel-todo-list [note]   panel-todo-read <words>   panel-todo-add <words>   panel-todo-status <uuid> <status>   panel-todo-undo <uuid> */
const STATUS_SYMBOL = { todo: "circle", doing: "circle.lefthalf.filled", "in-review": "circle.dotted", backlog: "circle.dashed", done: "checkmark.circle.fill", canceled: "xmark.circle" };
function todoRows() {
  const got = pluginMust("todoList", {}), rows = [];
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
  const out = { update: { relayout: true, ids: { todoList: { data: { src: rows }, select: lit || (first ? first.uid : ""), constraints: { stretch: "horizontal", size: { height: Math.min(rows.length, 10) * 44 + 6 } } } } }, window: { resize: { height: "auto" } } };
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
    const made = pluginMust("todoAdd", { words: words });
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

/* ---------- Search (search.alfredui) and a node whole (read.alfredui) ----------
   Search: Logseq's own search through the plugin, each node with its kind and day; the lit one shows whole in the pane beside
   the list. ↩ opens it here, ⌘↩ opens it in Logseq, ⌘C copies it as Markdown.
   A node whole (25 November 2026): its name and tags, then one list of lines: each property with what it holds, each bullet
   in its place in the outline, then what points at the node, as Relations lists it. The arrows walk the lines and the node
   is changed here as on its own page, every change through the plugin, so each is the same change with Logseq's own Undo:
     ↩ on a bullet     the bullet becomes a field in its place; ↩ writes the words, esc lets go
     ↩ on a property   set choices and nodes: a list to pick from, filtered as you type; words, a number, a day: a field in
                       place; a tick box turns over
     ↩ on a node       goes to it here (⌥↩ does on a property's value and on a bullet); ⌘[ steps back
     ⌘N a new bullet after the lit one · ⇥ ⇧⇥ move a bullet in and out · ⌘T tags · ⌘D done · ⌘G doing · ⌘⌫ deletes a bullet
     or clears a property · ⌘Z takes the last change back · ⌘C copies the lit bullet with those under it, ⇧⌘C the whole node,
     as Markdown · ⌘↩ opens the node in Logseq
   No key is written on a panel at rest (the owner, 25 November 2026): while Option is held, the foot names what can be done
   to the lit line. Alfred UI has no event for a held key, so the panel's pulse asks the keyboard (keys, optionheld.swift).
   The common keys (Undo, Copy) work and are never named.
     panel-search <words>   panel-search-pane <uuid>   panel-search-copy <uuid>   panel-node <command> [arguments]          */
const ask = (name, request) => { const got = pluginMust(name, request); if (got && got.ok === false) throw new Error(got.said || "Logseq refused"); return got; };
const LINE = 30, MOST = 16, LEAD = 18, EM = " ", MONO = { size: 13, name: "Menlo" }, SERIF = size => ({ size: size, name: "New York" });
const leadOf = name => { const s = String(name || ""), cut = s.length > LEAD - 2 ? s.slice(0, LEAD - 3) + "…" : s; return cut + " ".repeat(LEAD - cut.length); };
const markOf = line => (line.task === "done" ? "✓" : line.task ? "○" : "•");
const oneLine = words => String(words || "").split("\n")[0].replace(/#\[\[([^\[\]]+)\]\]/g, "#$1").replace(/\[\[([^\[\]]+)\]\]/g, "$1");
const bulletText = line => EM.repeat(line.depth * 2) + markOf(line) + "  " + oneLine(line.words);
const listOf = text => String(text || "").split("¦").filter(Boolean);
const GAP = "      ";
// What the foot names while Option is held: the key ↩ presses, then the keys a person could not guess.
const GUIDE = {
  bullet: ["Write  ↩", ["New bullet ⌘N", "Move ⇥ ⇧⇥", "Tag ⌘T", "Done ⌘D", "Doing ⌘G", "Open it ⌥↩", "Delete ⌘⌫", "Back ⌘[", "In Logseq ⌘↩"].join(GAP)],
  prop: ["Change  ↩", ["Go to it ⌥↩", "Clear ⌘⌫", "Tag ⌘T", "New bullet ⌘N", "Back ⌘[", "In Logseq ⌘↩"].join(GAP)],
  node: ["Go to it  ↩", ["Back ⌘[", "In Logseq ⌘↩"].join(GAP)],
  more: ["Open in Logseq  ↩", "Back ⌘["],
  none: ["New bullet  ⌘N", ["Tag ⌘T", "Back ⌘[", "In Logseq ⌘↩"].join(GAP)],
  words: ["Write  ↩", ["New line ⌥↩", "Let go esc"].join(GAP)],
  value: ["Write  ↩", "Let go esc"],
  search: ["Open here  ↩", "Open in Logseq ⌘↩"]
};

// Every line of a node, in the order it is shown: its properties, its bullets, then what points at it.
function nodeRows(node) {
  const rows = [];
  node.props.forEach(p => rows.push({ key: "p:" + p.ident, kind: "prop", group: "p", lead: leadOf(p.name), text: p.values.length ? p.values.map(v => v.text).join(", ") : "empty", colour: p.values.length ? "labelColor" : TERTIARY, end: "" }));
  node.lines.forEach(l => rows.push({ key: l.uuid, kind: "bullet", group: "b", lead: "", text: bulletText(l), colour: l.task === "done" ? SECONDARY : "labelColor", end: l.tag && l.tag !== "Task" ? l.tag : "" }));
  node.lists.forEach(function (list, i) {
    list.rows.forEach((r, j) => rows.push({ key: "n:" + r.uuid + ":" + i, kind: "node", group: "l" + i, lead: leadOf(j ? "" : list.name), text: r.title, colour: "labelColor", end: [r.kind, r.day].filter(Boolean).join(" · ") }));
    if (list.more) rows.push({ key: "m:" + i, kind: "more", group: "l" + i, lead: leadOf(""), text: "and " + list.more + " more, in Logseq", colour: SECONDARY, end: "" });
  });
  // A hairline over the first line of each group after the first sets the groups apart.
  rows.forEach(function (row, i) { row.first = i > 0 && rows[i - 1].group !== row.group; });
  return rows;
}
// The lines as one of Alfred's lists. pre: the cells' ids start with it, so two lists on the panel never share an id.
function linesView(id, pre, rows, lit, focus) {
  const cell = name => pre + name, data = rows.map(function (row) {
    const d = { uid: row.key };
    d[cell("Lead.text")] = row.lead; d[cell("Text.text")] = row.text; d[cell("Text.colour")] = row.colour; d[cell("End.text")] = row.end;
    d[cell("Key.text")] = row.key; d[cell("Go.text")] = GUIDE[row.kind][0]; d[cell("Guide.text")] = GUIDE[row.kind][1];
    d[cell("Rule.background")] = row.first ? "separatorColor" : null;
    return d;
  });
  const init = {}, selected = {};
  init[cell("Row.background")] = null; init[cell("Rule.background")] = null; init[cell("Text.colour")] = "labelColor"; selected[cell("Row.background")] = SOFT_ROW;
  const view = { type: "dataview", id: id, placeholder: "", select: lit || "",
    constraints: { stretch: "horizontal", size: { height: Math.max(1, Math.min(rows.length, MOST)) * LINE } },
    behaviour: { selection: focus ? { wrap: "vertical" } : { wrap: "none", allowempty: true } },
    cell: { height: LINE, init: init, selected: selected, root: { type: "view", id: cell("Row"), layout: "border", padding: 5, cornerradius: 9, components: [
      { type: "view", id: cell("Rule"), constraints: { region: "top", size: { height: 1 } }, components: [] },
      { type: "label", id: cell("Lead"), colour: SECONDARY, font: MONO, constraints: { region: "left", position: "centre" } },
      { type: "label", id: cell("Text"), font: { size: 16 }, linebreak: "truncatetail", constraints: { region: "centre", position: "left" } },
      { type: "label", id: cell("End"), colour: SECONDARY, font: { size: 14 }, constraints: { region: "right", position: "centre" } },
      { type: "label", id: cell("Key"), hidden: true }, { type: "label", id: cell("Go"), hidden: true }, { type: "label", id: cell("Guide"), hidden: true }
    ] } },
    data: { type: "basic", src: data } };
  if (focus) {
    view.focus = true;
    // The lit line changed: the foot's guide follows it (a few bytes of shell, no call to Logseq).
    view.events = [{ triggers: "changed", action: { type: "script", src: "lit", async: true, args: ["{value:" + id + ".selected." + cell("Go") + ".text}", "{value:" + id + ".selected." + cell("Guide") + ".text}"] } }];
  }
  return view;
}
const doIt = function () { return { type: "script", src: "do", args: Array.prototype.slice.call(arguments) }; };
const hairline = () => ({ type: "view", background: "separatorColor", constraints: { stretch: "horizontal", size: { height: 1 } }, components: [] });
// The foot: what was just done at its left; at its right, shown only while Option is held, the guide for the lit line.
function footView(note, guide, goAction, red) {
  const shown = env("k_shown", "") === "1";
  return { type: "view", id: "nFoot", layout: "border", spacing: 14, constraints: { stretch: "horizontal", size: { height: 34 } }, components: [
    { type: "label", id: "nNote", text: note || "", colour: red ? "systemRedColor" : "labelColor", font: { size: 14 }, linebreak: "truncatetail", constraints: { region: "left", position: "centre" } },
    { type: "label", id: "nKeys", text: guide[1], hidden: !shown, colour: SECONDARY, font: { size: 14 }, textalign: "right", linebreak: "truncatehead", constraints: { region: "centre", position: "right" } },
    Object.assign({ type: "button", id: "nGo", text: guide[0], hidden: !shown, constraints: { region: "right", position: "centre" }, events: [{ triggers: "actioned", action: goAction }] }, GLASS)
  ] };
}
/* Everything under the node's name, drawn anew at each step so that the place typing goes is always the one meant: the list
   while walking, the field while writing. st: { lit, note, red, edit }; edit: { key, at, lead, mono, text, lines, var }. */
function nodeBody(node, st) {
  const rows = nodeRows(node), parts = [], lit = "{value:nList.selected.lKey.text}";
  let shortcuts, guide, go;
  if (!st.edit) {
    const at = rows.some(r => r.key === st.lit) ? st.lit : rows.length ? rows[0].key : "", litRow = rows.filter(r => r.key === at)[0];
    const list = linesView("nList", "l", rows, at, true);
    if (!rows.length) list.placeholder = "No properties and no bullets yet.";
    parts.push(list);
    guide = GUIDE[litRow ? litRow.kind : "none"]; go = litRow ? doIt("act", lit) : doIt("new", "");
    shortcuts = [
      { shortcut: "↑", action: { type: "function", src: "nList", args: "selectup" } }, { shortcut: "↓", action: { type: "function", src: "nList", args: "selectdown" } },
      { shortcut: "↩", action: doIt("act", lit) }, { shortcut: "⌥↩", action: doIt("walk", lit) }, { shortcut: "⌘N", action: doIt("new", lit) },
      { shortcut: "⇥", action: doIt("move", lit, "in") }, { shortcut: "⇧⇥", action: doIt("move", lit, "out") },
      { shortcut: "⌘T", action: doIt("tags", lit) }, { shortcut: "⌘D", action: doIt("status", lit, "done") }, { shortcut: "⌘G", action: doIt("status", lit, "doing") },
      { shortcut: "⌘⌫", action: doIt("remove", lit) }, { shortcut: "⌘Z", action: doIt("undo", lit) }, { shortcut: "⌘C", action: doIt("copy", lit) }, { shortcut: "⇧⌘C", action: doIt("copy", "") },
      { shortcut: "⌘[", action: doIt("back") }, { shortcut: "⌘↩", action: { type: "json", src: { finish: { args: "open:" + node.uuid } } } }
    ];
  } else {
    // Writing: the field stands where the line stood, between the lines before it and the lines after it.
    const others = rows.filter(r => r.key !== st.edit.key), pos = Math.min(st.edit.at, others.length), from = Math.max(0, pos - 9), to = Math.min(others.length, from + MOST - 1);
    const before = others.slice(from, pos), after = others.slice(pos, to);
    if (after.length) after[0].first = st.edit.group !== after[0].group;
    if (before.length) parts.push(linesView("nList", "l", before, "", false));
    parts.push({ type: "view", id: "nEdit", layout: "border", padding: 5, cornerradius: 9, background: PANE_FILL, constraints: { stretch: "horizontal", size: { height: LINE } }, components: [
      { type: "label", id: "nEditLead", text: st.edit.lead, colour: SECONDARY, font: st.edit.mono ? MONO : { size: 16 }, constraints: { region: "left", position: "centre" } },
      { type: "textfield", id: "nField", focus: true, multiline: !!st.edit.lines, text: st.edit.text || "", placeholder: st.edit.hint || "", bordered: false, focusring: false, background: "#00000000", font: { size: 16 },
        constraints: { region: "centre" }, events: [{ triggers: "actioned", action: doIt("write", "{value:nField.text}") }] }
    ] });
    if (after.length) parts.push(linesView("nAfter", "a", after, "", false));
    guide = GUIDE[st.edit.lines ? "words" : "value"]; go = doIt("write", "{value:nField.text}");
    shortcuts = [{ shortcut: "⎋", action: doIt("letgo") }];
  }
  parts.push(hairline());
  parts.push(footView(st.note, guide, go, st.red));
  return { type: "view", id: "nBody", layout: "inline", direction: "vertical", spacing: 0, constraints: { stretch: "horizontal" }, shortcuts: shortcuts, components: parts };
}
// The panel's state travels in its variables (Alfred hands them to each script): the node shown, the way walked to it, what is
// being written, and how many steps of Logseq's Undo the last change was.
const nodeState = () => ({ uuid: env("n_uuid", ""), path: listOf(env("n_path", "")), titles: listOf(env("n_titles", "")), from: env("n_from", ""), steps: Number(env("n_steps", "0")) || 0, edit: env("n_edit", "") });
function nodeAnswer(node, st, vars) {
  const state = Object.assign(nodeState(), vars || {});
  const back = state.titles.length ? state.titles[state.titles.length - 1] : state.from || "";
  const out = {
    variables: { n_uuid: node.uuid, n_path: state.path.join("¦"), n_titles: state.titles.join("¦"), n_from: state.from, n_steps: String(state.steps), n_edit: st.edit ? st.edit.name : state.sheet || "" },
    update: { relayout: true, ids: {
      nTrail: { text: back ? "‹ " + back : "" }, nTitle: { text: node.title || "Untitled" },
      nTags: { text: node.tags.map(t => t.title).join("   ") }, nDay: { text: node.day || "" } } },
    replace: { ids: { nBody: nodeBody(node, st) } }, window: { resize: { height: "auto" } } };
  if (state.closeSheet) out.sheet = { close: "nSheet" };
  return JSON.stringify(out);
}
const nodeSays = (text, red) => JSON.stringify({ update: { ids: { nNote: { text: text, colour: red ? "systemRedColor" : "labelColor" } } } });
// A list to pick from, over the panel: a tag, a set choice, or a node for a property. Typing narrows it; ↩ takes the lit one.
function pickSheet(rows, lit, hint, empty, live) {
  const narrow = live ? [{ triggers: "typingstopped", action: { type: "script", src: "do", async: true, args: ["filter", "{value:vFilter.text}"] } }]
    : [{ triggers: "changed", action: [{ type: "function", src: "vList", args: "filterdata" }, { type: "function", src: "vList", args: "selectfirst" }] }];
  const data = { type: "basic", src: rows };
  if (!live) data.filter = { type: "basic", args: ["vFind.text"], match: "{value:vFilter.text}" };
  return { sheet: { id: "nSheet", root: { type: "view", layout: "border", padding: 22, spacing: 12, constraints: { size: { width: 620, height: 460 } },
    shortcuts: [{ shortcut: "↑", action: { type: "function", src: "vList", args: "selectup" } }, { shortcut: "↓", action: { type: "function", src: "vList", args: "selectdown" } }],
    components: [
      { type: "textfield", id: "vFilter", focus: true, bordered: false, focusring: false, placeholder: hint, font: { size: 24, weight: "light" }, constraints: { region: "top" },
        events: narrow.concat([{ triggers: "actioned", action: doIt("pick", "{value:vList.selected.vId.text}") }]) },
      { type: "dataview", id: "vList", placeholder: empty, constraints: { region: "centre" }, behaviour: { selection: { wrap: "vertical" } }, select: lit || (rows.length ? rows[0].uid : ""),
        cell: { height: 40, init: { "vRow.background": null }, selected: { "vRow.background": SOFT_ROW },
          root: { type: "view", id: "vRow", layout: "border", padding: 9, cornerradius: 10, components: [
            { type: "label", id: "vTick", font: { size: 16 }, constraints: { region: "left", position: "centre", size: { width: 22 } } },
            { type: "label", id: "vText", font: { size: 17 }, linebreak: "truncatetail", constraints: { region: "centre", position: "left" } },
            { type: "label", id: "vSub", colour: SECONDARY, font: { size: 14 }, constraints: { region: "right", position: "centre" } },
            { type: "label", id: "vId", hidden: true }, { type: "label", id: "vFind", hidden: true }
          ] } },
        data: data }
    ] } } };
}
const pickRow = (id, text, sub, on, find) => ({ uid: String(id), "vTick.text": on ? "✓" : "", "vText.text": text, "vSub.text": sub || "", "vId.text": String(id), "vFind.text": find || text });
const nodePickRows = (nodes, held) => nodes.map(n => pickRow(n.uuid, n.title, [n.kind, n.day].filter(Boolean).join(" · "), held.indexOf(n.uuid) >= 0));
function copyText(text) {
  const board = $.NSPasteboard.generalPasteboard;
  board.clearContents;
  board.setStringForType($(String(text)), $.NSPasteboardTypeString);
}

function nodePanel(command, args) {
  const state = nodeState();
  try {
    if (command === "open") {
      const arg = String(args[0] || "").trim(), cut = arg.indexOf(" "), uuid = cut < 0 ? arg : arg.slice(0, cut);
      let first;
      // The reason stands where the name would: the panel never stays at "Reading…" (the owner's page view did, 19 November 2026).
      try { first = ask("node", { uuid: uuid }).node; }
      catch (error) { return JSON.stringify({ variables: { n_from: cut < 0 ? "" : arg.slice(cut + 1).trim() }, update: { relayout: true, ids: { nTitle: { text: "This could not be read" }, nNote: { text: messageFrom(error), colour: "systemRedColor" } } }, window: { resize: { height: "auto" } } }); }
      return nodeAnswer(first, { lit: "" }, { path: [], titles: [], from: cut < 0 ? "" : arg.slice(cut + 1).trim(), steps: 0 });
    }
    if (command === "back") {
      if (!state.path.length) return JSON.stringify({ finish: { args: state.from ? "search:" + state.from : "home" } });
      const to = state.path[state.path.length - 1];
      return nodeAnswer(ask("node", { uuid: to }).node, { lit: "" }, { path: state.path.slice(0, -1), titles: state.titles.slice(0, -1), steps: 0 });
    }
    if (command === "undo") {
      const got = ask("undo", { node: state.uuid, steps: Math.max(1, state.steps) });
      return got.node ? nodeAnswer(got.node, { lit: String(args[0] || ""), note: got.said }, { steps: 1 }) : nodeSays("That node is no longer in the graph.", true);
    }
    const node = ask("node", { uuid: state.uuid }).node, rows = nodeRows(node), key = String(args[0] || "");
    const line = node.lines.filter(l => l.uuid === key)[0], prop = key.indexOf("p:") === 0 ? node.props.filter(p => "p:" + p.ident === key)[0] : null;
    const walkTo = function (uuid) {
      return nodeAnswer(ask("node", { uuid: uuid }).node, { lit: "" }, { path: state.path.concat([node.uuid]), titles: state.titles.concat([String(node.title).replace(/¦/g, " ").slice(0, 48)]), steps: 0 });
    };
    // What a change answers: the node as the graph now holds it, the changed line lit, and what was done said in the foot.
    const done = (got, vars) => nodeAnswer(got.node || node, { lit: got.lit || key, note: got.said || "" }, Object.assign({ steps: got.steps || state.steps }, vars || {}));
    const editOf = function (name, row, lead, mono, text, lines, hint) {
      const at = rows.map(r => r.key).indexOf(row.key);
      return { name: name, key: row.key, at: at, group: row.group, lead: lead, mono: mono, text: text, lines: lines, hint: hint || "" };
    };

    if (command === "act") {
      if (line) return nodeAnswer(node, { edit: editOf("b:" + line.uuid, { key: line.uuid, group: "b" }, EM.repeat(line.depth * 2) + markOf(line) + "  ", false, line.words, true) });
      if (prop) {
        if (prop.kind === "checkbox") return done(ask("setValue", { node: node.uuid, ident: prop.ident }));
        if (prop.kind === "choice") {
          const held = prop.values.map(v => String(v.raw));
          return JSON.stringify(Object.assign({ variables: { n_edit: "p:" + prop.ident } }, pickSheet(prop.choices.map(c => pickRow(c.raw, c.text, "", held.indexOf(String(c.raw)) >= 0)), held[0] || "", prop.name, "No choice by that name.", false)));
        }
        if (prop.kind === "node") {
          const held = prop.values.map(v => v.uuid), found = ask("candidates", { ident: prop.ident, words: "" }).nodes || [];
          return JSON.stringify(Object.assign({ variables: { n_edit: "p:" + prop.ident } }, pickSheet(nodePickRows(found, held), held[0] || "", prop.name, "Type to find a node.", true)));
        }
        return nodeAnswer(node, { edit: editOf("p:" + prop.ident, { key: key, group: "p" }, leadOf(prop.name), true, prop.values.map(v => v.text).join(", "), false, prop.kind === "date" ? "nov 18, or 2026-11-18" : "") });
      }
      if (key.indexOf("n:") === 0) return walkTo(key.split(":")[1]);
      if (key.indexOf("m:") === 0) return JSON.stringify({ finish: { args: "open:" + node.uuid } });
      return JSON.stringify({});
    }
    if (command === "walk") {
      if (line) return walkTo(line.uuid);
      if (prop) { const to = prop.values.filter(v => v.uuid)[0]; return to ? walkTo(to.uuid) : JSON.stringify({}); }
      if (key.indexOf("n:") === 0) return walkTo(key.split(":")[1]);
      return JSON.stringify({});
    }
    if (command === "new") {
      // After the lit bullet and the bullets under it, at its depth; with no bullet lit, last in the node.
      const lines = node.lines, i = line ? lines.indexOf(line) : -1, firstBullet = rows.map(r => r.kind).indexOf("bullet");
      const at = line ? rows.map(r => r.key).indexOf(line.uuid) + 1 + line.under : (firstBullet < 0 ? node.props.length : firstBullet + lines.length);
      const edit = { name: "new:" + (line ? line.uuid : ""), key: "", at: at, group: "b", lead: EM.repeat((i < 0 ? 0 : line.depth) * 2) + "•  ", mono: false, text: "", lines: true, hint: "" };
      return nodeAnswer(node, { edit: edit });
    }
    if (command === "write") {
      const text = String(args[0] == null ? "" : args[0]), what = state.edit;
      if (what.indexOf("b:") === 0) return done(ask("setWords", { node: node.uuid, uuid: what.slice(2), words: text }));
      if (what.indexOf("new:") === 0) { const got = ask("newBullet", { node: node.uuid, after: what.slice(4), words: text }); return nodeAnswer(got.node || node, { lit: got.lit || what.slice(4), note: "" }, { steps: got.steps || state.steps }); }
      if (what.indexOf("p:") === 0) { const got = ask("setValue", { node: node.uuid, ident: what.slice(2), text: text }); return nodeAnswer(got.node || node, { lit: what, note: got.said || "" }, { steps: got.steps || state.steps }); }
      return nodeAnswer(node, { lit: "" });
    }
    if (command === "letgo") {
      const what = state.edit;
      return nodeAnswer(node, { lit: what.indexOf("b:") === 0 ? what.slice(2) : what.indexOf("new:") === 0 ? what.slice(4) : what });
    }
    if (command === "move") return line ? done(ask("move", { node: node.uuid, uuid: line.uuid, way: args[1] === "out" ? "out" : "in" })) : JSON.stringify({});
    if (command === "status") return done(ask("status", { node: node.uuid, uuid: line ? line.uuid : node.uuid, to: args[1] === "doing" ? "doing" : "done" }));
    if (command === "remove") {
      if (line) return done(ask("remove", { node: node.uuid, uuid: line.uuid }));
      if (prop) return prop.values.length ? done(ask("setValue", { node: node.uuid, ident: prop.ident, text: "" })) : JSON.stringify({});
      return JSON.stringify({});
    }
    if (command === "copy") {
      const got = ask("markdown", { node: node.uuid, uuid: line ? line.uuid : "" });
      copyText(got.text || "");
      return nodeSays(got.said || "Copied", false);
    }
    if (command === "tags") {
      const target = line ? line.uuid : node.uuid, has = line ? [line.tag] : node.tags.map(t => t.title), list = ask("tags", {}).tags || [];
      const tagRows = list.map(t => pickRow(t.uuid, EM.repeat(t.depth) + t.title, "", has.indexOf(t.title) >= 0, t.title));
      return JSON.stringify(Object.assign({ variables: { n_edit: "t:" + target } }, pickSheet(tagRows, "", "Tag", "No tag by that name. New tags are made in Logseq.", false)));
    }
    if (command === "filter") {
      const what = state.edit, p = node.props.filter(one => "p:" + one.ident === what)[0];
      if (!p) return JSON.stringify({});
      const found = ask("candidates", { ident: p.ident, words: String(args[0] || "") }).nodes || [], picks = nodePickRows(found, p.values.map(v => v.uuid));
      return JSON.stringify({ update: { ids: { vList: { data: { src: picks }, select: picks.length ? picks[0].uid : "" } } } });
    }
    if (command === "pick") {
      const what = state.edit, id = String(args[0] || "");
      if (!id) return JSON.stringify({});
      if (what.indexOf("t:") === 0) { const got = ask("tag", { node: node.uuid, uuid: what.slice(2), tag: id }); return nodeAnswer(got.node || node, { lit: got.lit || "", note: got.said || "" }, { steps: got.steps || state.steps, closeSheet: true }); }
      if (what.indexOf("p:") === 0) { const got = ask("setValue", { node: node.uuid, ident: what.slice(2), pick: id }); return nodeAnswer(got.node || node, { lit: what, note: got.said || "" }, { steps: got.steps || state.steps, closeSheet: true }); }
      return JSON.stringify({});
    }
    return JSON.stringify({});
  } catch (error) { return nodeSays(messageFrom(error), true); }
}

/* The pane beside a list (Search, and Home): the lit node whole, to read. Its name, its tags, what it holds, the start of its
   outline, and how much points at it. Changing it is a step away: ↩ opens it across the panel. */
function nodePane(id, node, width) {
  const inner = width - 28, left = { position: "left" }, parts = [];
  parts.push({ type: "label", text: node.title || "Untitled", font: { size: 20, weight: "medium" }, linebreak: "wordwrap", constraints: { position: "left", size: { width: inner } } });
  if (node.tags.length || node.day) parts.push({ type: "view", layout: "inline", spacing: 10, constraints: left, components: [
    { type: "label", text: node.tags.map(t => t.title).join("   "), colour: SECONDARY, font: SERIF(15) }, { type: "label", text: node.day || "", colour: SECONDARY, font: { size: 14 } }] });
  const held = node.props.filter(p => p.values.length).slice(0, 6), form = [];
  held.forEach(function (p) {
    form.push({ type: "label", text: p.name, colour: SECONDARY, font: MONO, constraints: { position: "right" } });
    form.push({ type: "label", text: p.values.map(v => v.text).join(", "), font: { size: 15 }, linebreak: "truncatetail" });
  });
  if (form.length) parts.push({ type: "view", layout: "form", spacing: 7, components: form, constraints: left });
  const few = node.lines.slice(0, 8);
  few.forEach(l => parts.push({ type: "label", text: bulletText(l), colour: l.task === "done" ? SECONDARY : "labelColor", font: { size: 15 }, linebreak: "truncatetail", constraints: { position: "left", size: { width: inner } } }));
  if (node.lines.length > few.length) parts.push({ type: "label", text: plural(node.lines.length - few.length, "more bullet"), colour: SECONDARY, font: { size: 14 }, constraints: left });
  if (node.lists.length) {
    parts.push(paneLine());
    node.lists.slice(0, 6).forEach(function (list) {
      parts.push({ type: "view", layout: "border", constraints: { stretch: "horizontal" }, components: [
        { type: "label", text: list.name, font: { size: 15 }, constraints: { region: "left" } },
        { type: "label", text: list.said || plural(list.rows.length + list.more, "node"), colour: SECONDARY, font: { size: 15 }, textalign: "right", constraints: { region: "centre", position: "right" } }
      ] });
    });
  }
  return { type: "view", id: id, layout: "inline", constraints: { region: "right", position: "top", size: { width: width + PANE_GAP } }, components: [
    { type: "view", constraints: { size: { width: PANE_GAP } }, components: [] },
    { type: "view", layout: "inline", direction: "vertical", padding: 14, spacing: 8, cornerradius: 14, background: PANE_FILL, constraints: { size: { width: width } }, components: parts }
  ] };
}
const paneView = (id, uuid, width) => nodePane(id, ask("node", { uuid: uuid }).node, width);

const SEARCH_ROW = 66, SEARCH_MOST = 6;
const nodeSub = n => [n.kind, n.day].filter(Boolean).join(" · ");
const nodeRow = n => ({ uid: n.uuid, "rIcon.image": { type: "symbol", src: n.isPage ? "doc.text" : "text.alignleft" }, "rTitle.text": n.title, "rSub.text": nodeSub(n), "rUuid.text": n.uuid });
function searchAnswer(words) {
  let got = { nodes: [] };
  try { if (words.trim()) got = ask("find", { words: words, limit: 30 }); }
  catch (error) { return JSON.stringify({ update: { ids: { sNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
  const seen = {}, rows = (got.nodes || []).filter(n => !seen[n.uuid] && (seen[n.uuid] = true)).map(nodeRow);
  return JSON.stringify({ update: { relayout: true, ids: {
    searchList: { data: { src: rows }, select: rows.length ? rows[0].uid : "", constraints: { region: "centre", size: { height: Math.max(1, Math.min(rows.length, SEARCH_MOST)) * SEARCH_ROW } } },
    sNote: { text: !words.trim() ? "" : rows.length ? plural(rows.length, "node") : "Nothing has these words.", colour: SECONDARY } } }, window: { resize: { height: "auto" } } });
}
// The lit result changed: its pane.
function searchPane(uuid) {
  const out = { replace: { ids: {} }, update: { relayout: true }, window: { resize: { height: "auto" } } };
  try { out.replace.ids.sPane = uuid ? paneView("sPane", uuid, 430) : noPane("sPane"); } catch (_) { out.replace.ids.sPane = noPane("sPane"); }
  return JSON.stringify(out);
}
// ⌘C on a result: the node whole, as Markdown.
function searchCopy(uuid) {
  if (!uuid) return JSON.stringify({});
  try { const got = ask("markdown", { node: uuid, uuid: "" }); copyText(got.text || ""); return JSON.stringify({ update: { ids: { sNote: { text: got.said || "Copied", colour: "labelColor" } } } }); }
  catch (error) { return JSON.stringify({ update: { ids: { sNote: { text: messageFrom(error), colour: "systemRedColor" } } } }); }
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
      fList: { data: { src: rows }, constraints: { stretch: "horizontal", size: { height: Math.min(rows.length, 6) * 56 + 6 } } },
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
  if (command === "panel-search-pane") return searchPane(items[0] || "");
  if (command === "panel-search-copy") return searchCopy(items[0] || "");
  if (command === "panel-node") return nodePanel(items[0] || "", items.slice(1));
  if (command === "panel-todo-list") return todoAnswer("");
  if (command === "panel-todo-read") return todoRead(items[0] || "");
  if (command === "panel-todo-add") return todoAdd(items[0] || "");
  if (command === "panel-todo-status") return todoStatus(items[0] || "", items[1] || "done");
  if (command === "panel-todo-undo") return todoUndo(items[0] || "");
  if (command === "panel-home-start") return homeStart();
  if (command === "panel-home-find") return homeFind(items[0] || "", items[1] || "");
  if (command === "panel-home-pane") return homePane(items[0] || "", items[1] || "", items[2] || "", items[3] || "", items[4] || "");
  if (command === "panel-home-take") return homeTake(items[0] || "", items[1] || "", items[2] || "");
  if (command === "panel-home-tab") return homeTab(items[0] || "", items[1] || "", items[2] || "");
  if (command === "panel-home-untake") return homeUntake(items[0] || "", items[1] || "", items.length > 2 ? items[2] : "");
  if (command === "panel-home-status") return homeStatus(items[0] || "", items[1] || "done", items[2] || "", items[3] || "");
  if (command === "panel-home-undo") return homeUndo(items[0] || "", items[1] || "", items[2] || "");
  if (command === "panel-route") return route(items[0] || "");
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
