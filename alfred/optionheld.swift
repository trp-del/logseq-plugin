// Says whether the Option key is held right now: "1" or "0". Asked by the panels' pulse (read.alfredui/keys), so that the
// foot's guide shows only while Option is held. It reads the keyboard's state and nothing else; it needs no permission.
import CoreGraphics
print(CGEventSource.flagsState(.combinedSessionState).contains(.maskAlternate) ? "1" : "0")
