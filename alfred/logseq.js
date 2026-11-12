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
  api("logseq.Editor.appendBlockInPage", [nodeUuid(page), content, {}]);
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

function main(argv) {
  const command = argv.length ? String(argv[0]) : "";
  const items = argv.slice(1).map(String).filter(function (s) { return s.trim(); });
  const words = items.join(" ").trim();
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
