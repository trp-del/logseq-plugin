import AppKit
import QuartzCore


// --------------------------------------------------
// MARK: Custom vertically-centered text
// --------------------------------------------------

final class ToastTextView: NSView {

    let text: String
    let font: NSFont
    let horizontalPadding: CGFloat
    let iconSize: CGFloat
    let iconSpacing: CGFloat

    private let iconView = NSImageView()

    init(
        frame: NSRect,
        text: String,
        font: NSFont,
        horizontalPadding: CGFloat,
        iconSize: CGFloat,
        iconSpacing: CGFloat,
        isFailure: Bool
    ) {
        self.text = text
        self.font = font
        self.horizontalPadding = horizontalPadding
        self.iconSize = iconSize
        self.iconSpacing = iconSpacing

        super.init(frame: frame)

        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        let symbolName =
            isFailure
                ? "xmark.circle.fill"
                : "checkmark.circle.fill"

        let symbolConfiguration =
            NSImage.SymbolConfiguration(
                pointSize: iconSize,
                weight: .semibold
            )

        iconView.image =
            NSImage(
                systemSymbolName: symbolName,
                accessibilityDescription:
                    isFailure
                        ? "Error"
                        : "Success"
            )?
            .withSymbolConfiguration(symbolConfiguration)

        iconView.contentTintColor =
            isFailure
                ? NSColor.systemRed
                : NSColor.systemGreen

        iconView.imageScaling =
            .scaleProportionallyUpOrDown

        addSubview(iconView)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func contentFrames()
        -> (
            icon: NSRect,
            text: NSRect
        )
    {
        let measuredTextWidth = ceil(
            (text as NSString).size(
                withAttributes: [
                    .font: font
                ]
            ).width
        )

        let maximumTextWidth = max(
            bounds.width
                - horizontalPadding * 2
                - iconSize
                - iconSpacing,
            0
        )

        let visibleTextWidth = min(
            measuredTextWidth,
            maximumTextWidth
        )

        let groupWidth =
            iconSize
            + iconSpacing
            + visibleTextWidth

        let groupX = floor(
            (bounds.width - groupWidth) / 2
        )

        let lineHeight = ceil(
            font.ascender
            - font.descender
            + font.leading
        )

        let textY = floor(
            (bounds.height - lineHeight) / 2
        )

        let iconY = floor(
            (bounds.height - iconSize) / 2
        )

        return (
            icon: NSRect(
                x: groupX,
                y: iconY,
                width: iconSize,
                height: iconSize
            ),
            text: NSRect(
                x: groupX + iconSize + iconSpacing,
                y: textY,
                width: visibleTextWidth,
                height: lineHeight
            )
        )
    }

    override func layout() {
        super.layout()

        iconView.frame =
            contentFrames().icon
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .left
        paragraph.lineBreakMode = .byTruncatingTail

        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: NSColor.white.withAlphaComponent(0.96),
            .paragraphStyle: paragraph
        ]

        let textRect =
            contentFrames().text

        (text as NSString).draw(
            with: textRect,
            options: [
                .usesLineFragmentOrigin,
                .truncatesLastVisibleLine
            ],
            attributes: attributes
        )
    }
}


// --------------------------------------------------
// MARK: Application
// --------------------------------------------------

let app = NSApplication.shared
app.setActivationPolicy(.accessory)


// --------------------------------------------------
// MARK: Message
// --------------------------------------------------

// Alfred can sometimes pass newlines, carriage returns,
// tabs, or other whitespace.
//
// Collapse all of that into ordinary single spaces.

let rawMessage =
    CommandLine.arguments
        .dropFirst()
        .joined(separator: " ")

let cleanMessage =
    rawMessage
        .split(whereSeparator: { $0.isWhitespace })
        .joined(separator: " ")

let text =
    cleanMessage.isEmpty
        ? "Done"
        : cleanMessage

let isFailure =
    text
        .lowercased()
        .hasPrefix("error:")


// --------------------------------------------------
// MARK: Screen
// --------------------------------------------------

// Use the screen containing the mouse cursor.

let mouseLocation = NSEvent.mouseLocation

let screen =
    NSScreen.screens.first {
        $0.frame.contains(mouseLocation)
    }
    ?? NSScreen.main
    ?? NSScreen.screens.first!

let screenFrame = screen.visibleFrame


// --------------------------------------------------
// MARK: Appearance
// --------------------------------------------------

let font = NSFont.systemFont(
    ofSize: 14,
    weight: .medium
)


// Measure the CLEANED text.

let textWidth = ceil(
    (text as NSString).size(
        withAttributes: [
            .font: font
        ]
    ).width
)


// Space between text and glass edge.

let horizontalPadding: CGFloat = 28


// Status icon and gap before the message.

let iconSize: CGFloat = 17

let iconSpacing: CGFloat = 8


// Height of visible HUD.

let toastHeight: CGFloat = 36


// Slightly less than half the height,
// giving the Caffeinate-style rounded rectangle.

let cornerRadius: CGFloat = 17


// Transparent room around the glass.
//
// Needed so the edge and shadow aren't clipped by
// the actual NSPanel boundary.

let glassMargin: CGFloat = 12


// --------------------------------------------------
// MARK: Width
// --------------------------------------------------

let desiredToastWidth = max(
    textWidth
        + iconSize
        + iconSpacing
        + horizontalPadding * 2,
    140
)

// Maximum width of the visible toast.
// Longer messages will truncate with an ellipsis.
let maxToastWidth: CGFloat = 520

let toastWidth = min(
    desiredToastWidth,
    maxToastWidth
)


// The NSPanel itself is larger than the visible toast.

let windowWidth =
    toastWidth + glassMargin * 2

let windowHeight =
    toastHeight + glassMargin * 2


// --------------------------------------------------
// MARK: Panel
// --------------------------------------------------

let panel = NSPanel(
    contentRect: NSRect(
        x: 0,
        y: 0,
        width: windowWidth,
        height: windowHeight
    ),
    styleMask: [
        .borderless,
        .nonactivatingPanel
    ],
    backing: .buffered,
    defer: false
)

panel.isOpaque = false

panel.backgroundColor = .clear

// Don't use the NSWindow shadow.
// It can expose the rectangular window boundary.

panel.hasShadow = false

panel.level = .statusBar

panel.ignoresMouseEvents = true

panel.hidesOnDeactivate = false

panel.collectionBehavior = [
    .canJoinAllSpaces,
    .fullScreenAuxiliary,
    .transient,
    .ignoresCycle
]


// --------------------------------------------------
// MARK: Root
// --------------------------------------------------

let root = NSView(
    frame: NSRect(
        x: 0,
        y: 0,
        width: windowWidth,
        height: windowHeight
    )
)

root.wantsLayer = true

root.layer?.backgroundColor =
    NSColor.clear.cgColor

panel.contentView = root


// --------------------------------------------------
// MARK: Visible toast frame
// --------------------------------------------------

let toastFrame = NSRect(
    x: glassMargin,
    y: glassMargin,
    width: toastWidth,
    height: toastHeight
)


// --------------------------------------------------
// MARK: macOS 26 Liquid Glass
// --------------------------------------------------

if #available(macOS 26.0, *) {

    // --------------------------------------------------
    // Shadow
    // --------------------------------------------------

    let shadowView = NSView(
        frame: toastFrame
    )

    shadowView.wantsLayer = true

    shadowView.layer?.backgroundColor =
        NSColor.black
            .withAlphaComponent(0.42)
            .cgColor

    shadowView.layer?.cornerRadius =
        cornerRadius

    shadowView.layer?.cornerCurve =
        .continuous

    shadowView.layer?.shadowColor =
        NSColor.black.cgColor

    shadowView.layer?.shadowOpacity =
        0.38

    shadowView.layer?.shadowRadius =
        6

    shadowView.layer?.shadowOffset =
        CGSize(
            width: 0,
            height: -1
        )

    root.addSubview(shadowView)


    // --------------------------------------------------
    // Dark translucent backing
    // --------------------------------------------------

    let dimmer = NSView(
        frame: toastFrame
    )

    dimmer.wantsLayer = true

    dimmer.layer?.backgroundColor =
        NSColor.black
            .withAlphaComponent(0.50)
            .cgColor

    dimmer.layer?.cornerRadius =
        cornerRadius

    dimmer.layer?.cornerCurve =
        .continuous

    root.addSubview(dimmer)


    // --------------------------------------------------
    // Actual Apple Liquid Glass
    // --------------------------------------------------

    let glass = NSGlassEffectView(
        frame: toastFrame
    )

    glass.style = .clear

    glass.cornerRadius =
        cornerRadius

    glass.effectIsInteractive =
        false

    // Only a small tint.
    // The backing above provides most of the darkness.

    glass.tintColor =
        NSColor.black
            .withAlphaComponent(0.10)

    root.addSubview(glass)


    // --------------------------------------------------
    // Outer glass rim
    // --------------------------------------------------

    let outerRim = NSView(
        frame: toastFrame
    )

    outerRim.wantsLayer = true

    outerRim.layer?.backgroundColor =
        NSColor.clear.cgColor

    outerRim.layer?.cornerRadius =
        cornerRadius

    outerRim.layer?.cornerCurve =
        .continuous

    outerRim.layer?.borderWidth =
        1.0

    outerRim.layer?.borderColor =
        NSColor.white
            .withAlphaComponent(0.26)
            .cgColor

    root.addSubview(outerRim)


    // --------------------------------------------------
    // Inner rim
    // --------------------------------------------------

    let innerInset: CGFloat = 1.25

    let innerRim = NSView(
        frame: toastFrame.insetBy(
            dx: innerInset,
            dy: innerInset
        )
    )

    innerRim.wantsLayer = true

    innerRim.layer?.backgroundColor =
        NSColor.clear.cgColor

    innerRim.layer?.cornerRadius =
        cornerRadius - innerInset

    innerRim.layer?.cornerCurve =
        .continuous

    innerRim.layer?.borderWidth =
        0.75

    innerRim.layer?.borderColor =
        NSColor.white
            .withAlphaComponent(0.09)
            .cgColor

    root.addSubview(innerRim)


    // --------------------------------------------------
    // Glass edge highlight
    // --------------------------------------------------

    let highlightLayer =
        CAShapeLayer()

    let highlightRect =
        toastFrame.insetBy(
            dx: 0.75,
            dy: 0.75
        )

    let highlightPath =
        CGPath(
            roundedRect: highlightRect,
            cornerWidth:
                cornerRadius - 0.75,
            cornerHeight:
                cornerRadius - 0.75,
            transform: nil
        )

    highlightLayer.path =
        highlightPath

    highlightLayer.fillColor =
        NSColor.clear.cgColor

    highlightLayer.strokeColor =
        NSColor.white
            .withAlphaComponent(0.15)
            .cgColor

    highlightLayer.lineWidth =
        0.8

    highlightLayer.strokeStart =
        0.52

    highlightLayer.strokeEnd =
        0.98

    root.layer?.addSublayer(
        highlightLayer
    )


    // --------------------------------------------------
    // Text
    // --------------------------------------------------
    //
    // IMPORTANT:
    //
    // This is NOT an NSTextField.
    //
    // We draw directly into an NSView whose frame is
    // exactly the same as the visible glass frame.
    //
    // That avoids Alfred/NSTextField layout differences.
    // --------------------------------------------------

    let textView = ToastTextView(
        frame: toastFrame,
        text: text,
        font: font,
        horizontalPadding: horizontalPadding,
        iconSize: iconSize,
        iconSpacing: iconSpacing,
        isFailure: isFailure
    )

    // Add last so it's always above glass and rims.

    root.addSubview(textView)


} else {

    // --------------------------------------------------
    // MARK: Older macOS fallback
    // --------------------------------------------------

    let effect = NSVisualEffectView(
        frame: toastFrame
    )

    effect.material =
        .hudWindow

    effect.blendingMode =
        .behindWindow

    effect.state =
        .active

    effect.wantsLayer =
        true

    effect.layer?.cornerRadius =
        cornerRadius

    effect.layer?.cornerCurve =
        .continuous

    effect.layer?.masksToBounds =
        true


    // --------------------------------------------------
    // Dark backing
    // --------------------------------------------------

    let dark = NSView(
        frame: effect.bounds
    )

    dark.autoresizingMask = [
        .width,
        .height
    ]

    dark.wantsLayer = true

    dark.layer?.backgroundColor =
        NSColor.black
            .withAlphaComponent(0.52)
            .cgColor

    effect.addSubview(dark)

    root.addSubview(effect)


    // --------------------------------------------------
    // Rim
    // --------------------------------------------------

    let rim = NSView(
        frame: toastFrame
    )

    rim.wantsLayer = true

    rim.layer?.backgroundColor =
        NSColor.clear.cgColor

    rim.layer?.cornerRadius =
        cornerRadius

    rim.layer?.cornerCurve =
        .continuous

    rim.layer?.borderWidth =
        1

    rim.layer?.borderColor =
        NSColor.white
            .withAlphaComponent(0.25)
            .cgColor

    root.addSubview(rim)


    // --------------------------------------------------
    // Text
    // --------------------------------------------------

    let textView = ToastTextView(
        frame: toastFrame,
        text: text,
        font: font,
        horizontalPadding: horizontalPadding,
        iconSize: iconSize,
        iconSpacing: iconSpacing,
        isFailure: isFailure
    )

    root.addSubview(textView)
}


// --------------------------------------------------
// MARK: Position
// --------------------------------------------------

let topMargin: CGFloat = 18


// Center the entire window.
//
// Because glassMargin is equal on both sides,
// the visible toast is also exactly centered.

let x =
    screenFrame.midX
    - windowWidth / 2


let y =
    screenFrame.maxY
    - toastHeight
    - topMargin
    - glassMargin


panel.setFrameOrigin(
    NSPoint(
        x: round(x),
        y: round(y)
    )
)


// --------------------------------------------------
// MARK: Show
// --------------------------------------------------

panel.alphaValue = 0

panel.orderFrontRegardless()

NSAnimationContext.runAnimationGroup {
    context in

    context.duration =
        0.10

    context.timingFunction =
        CAMediaTimingFunction(
            name: .easeOut
        )

    panel.animator().alphaValue =
        1
}


// --------------------------------------------------
// MARK: Hide
// --------------------------------------------------

DispatchQueue.main.asyncAfter(
    deadline: .now() + 3.0
) {

    NSAnimationContext.runAnimationGroup(
        {
            context in

            context.duration =
                0.16

            context.timingFunction =
                CAMediaTimingFunction(
                    name: .easeIn
                )

            panel.animator().alphaValue =
                0
        },

        completionHandler: {

            panel.orderOut(nil)

            app.terminate(nil)
        }
    )
}


// --------------------------------------------------
// MARK: Run
// --------------------------------------------------

app.run()
