#!/bin/sh
# Has this Mac draw its own symbols (SF Symbols) for the plugin's icons, once, into the plugin's storage in Logseq:
#   ~/.logseq/storages/logseq-plugin/mac-symbols.json     (a symbol's name and its picture; plugin.js, Door.symbols, reads it)
# Run:  sh tools/mac-symbols.sh            (or with a file to write instead, for a test Logseq with a home folder of its own)
# Then reload the plugin, or flip Mac symbols off and on in its settings.
#
# Apple's symbols may be drawn by a Mac and shown on it; they are never copied into the plugin. So this script holds no picture
# and no name of its own: the names are read from plugin.js (its SYMBOLS list), the pictures are made here and stay on this Mac,
# outside the plugin's folder. Not a Mac: nothing is written and the icons stay as they are. A symbol this macOS does not have
# is left out, and that icon stays as it is.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
out="${1:-$HOME/.logseq/storages/logseq-plugin/mac-symbols.json}"
if [ "$(uname)" != "Darwin" ] || ! command -v osascript >/dev/null 2>&1; then
  echo "Not a Mac: no symbols drawn. The icons stay as they are."
  exit 0
fi
mkdir -p "$(dirname "$out")"
/usr/bin/osascript -l JavaScript - "$here/plugin.js" "$out" <<'JS'
ObjC.import('AppKit');
function run(argv) {
  const text = path => ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
  // The names, from the library itself: plugin.js run with nothing around it, as its own test runs it.
  const window = {};
  let names = [];
  try { (new Function('window', text(argv[0])))(window); names = window.PluginDoor.symbols.names(); } catch (error) { return 'The list of symbols could not be read from plugin.js: ' + error; }
  /* Each symbol at one size on one square, so they keep their sizes beside each other: a round one (a circle, a globe) fills
     three quarters of the square, as the icons it stands for do; the few wider than the square are brought down to fit. Medium
     weight, the nearest to the icons' own line. Black on clear: only the shape is used, as a mask in the icon's colour.
  A name may ask for another drawing after an @ (plugin.js says where): @semibold a step heavier at the same size; @small for
     an icon shown small and faint, bold and an eighth larger, so its lines still read; @heavy the same, heavier still. */
  const BOX = 72, POINT = 96 * BOX / 150, LARGE = 3;
  const DRAWINGS = { '': [0.23, 1], semibold: [0.3, 1], small: [0.4, 1.12], heavy: [0.62, 1.12] };   // weight (medium, semibold, bold, black), size
  const symbols = {}, missing = [];
  for (const name of names) {
    const [symbol, how = ''] = name.split('@'), [weight, larger] = DRAWINGS[how] || DRAWINGS[''];
    let image = $.NSImage.imageWithSystemSymbolNameAccessibilityDescription(symbol, $());
    if (!image || image.isNil()) { missing.push(name); continue; }
    image = image.imageWithSymbolConfiguration($.NSImageSymbolConfiguration.configurationWithPointSizeWeightScale(POINT * larger, weight, LARGE));
    const size = image.size, fit = Math.min(1, BOX / size.width, BOX / size.height), w = size.width * fit, h = size.height * fit;
    const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, BOX, BOX, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
    const context = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(context);
    image.drawInRectFromRectOperationFraction($.NSMakeRect((BOX - w) / 2, (BOX - h) / 2, w, h), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1.0);
    context.flushGraphics;
    $.NSGraphicsContext.restoreGraphicsState;
    const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary);
    symbols[name] = 'data:image/png;base64,' + ObjC.unwrap(png.base64EncodedStringWithOptions(0));
  }
  const drawn = Object.keys(symbols).length;
  if (!drawn) return 'This Mac drew none of the ' + names.length + ' symbols: nothing was written, and the icons stay as they are.';
  const file = { made: new Date().toISOString().slice(0, 10), macOS: ObjC.unwrap($.NSProcessInfo.processInfo.operatingSystemVersionString), symbols };
  // Written whole or not at all, so Logseq never reads half a file.
  if (!$(JSON.stringify(file)).writeToFileAtomicallyEncodingError(argv[1], true, $.NSUTF8StringEncoding, null)) return 'The symbols could not be written to ' + argv[1];
  return drawn + ' of ' + names.length + ' symbols drawn by this Mac into ' + argv[1] + (missing.length ? '. This macOS has no ' + missing.join(', ') + ': those icons stay as they are.' : '.');
}
JS
