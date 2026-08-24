import SwiftUI

/// Draws the brand artwork that the web app loads from `/public/*.svg`.
///
/// Rather than duplicating the logo and world map as bitmaps — which would
/// drift the moment the web files change — the same `.svg` files ship in the
/// app bundle and are parsed here. Only the path subset those files use is
/// supported (M/L/H/V/C/Q/Z, absolute and relative); anything else is skipped
/// rather than guessed at.
struct SVGShape: Shape {
    let asset: SVGAsset

    func path(in rect: CGRect) -> Path {
        asset.path(in: rect)
    }
}

/// A parsed `.svg` file: its viewBox plus every `<path d="…">` in document
/// order. Parsing happens once per file and is cached — these are static
/// assets, so re-reading them on every layout pass would be pure waste.
struct SVGAsset {
    let viewBox: CGRect
    let subpaths: [Path]

    private static var cache: [String: SVGAsset] = [:]

    static func named(_ name: String) -> SVGAsset? {
        if let hit = cache[name] { return hit }
        guard let url = Bundle.main.url(forResource: name, withExtension: "svg"),
              let source = try? String(contentsOf: url, encoding: .utf8)
        else { return nil }
        let asset = SVGAsset(source: source)
        cache[name] = asset
        return asset
    }

    init(source: String) {
        viewBox = Self.parseViewBox(source) ?? CGRect(x: 0, y: 0, width: 100, height: 100)
        subpaths = Self.parsePathData(source).map(SVGPathParser.path(from:))
    }

    /// Scales the artwork to fit `rect` while keeping its aspect ratio.
    func path(in rect: CGRect) -> Path {
        guard viewBox.width > 0, viewBox.height > 0 else { return Path() }
        let scale = min(rect.width / viewBox.width, rect.height / viewBox.height)
        let dx = rect.minX + (rect.width - viewBox.width * scale) / 2 - viewBox.minX * scale
        let dy = rect.minY + (rect.height - viewBox.height * scale) / 2 - viewBox.minY * scale
        let transform = CGAffineTransform(translationX: dx, y: dy).scaledBy(x: scale, y: scale)

        var combined = Path()
        for subpath in subpaths {
            combined.addPath(subpath, transform: transform)
        }
        return combined
    }

    private static func parseViewBox(_ source: String) -> CGRect? {
        guard let raw = attribute("viewBox", in: source) else { return nil }
        let numbers = raw.split(whereSeparator: { $0 == " " || $0 == "," }).compactMap { Double($0) }
        guard numbers.count == 4 else { return nil }
        return CGRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3])
    }

    private static func attribute(_ name: String, in source: String) -> String? {
        guard let range = source.range(of: "\(name)=\"") else { return nil }
        let rest = source[range.upperBound...]
        guard let end = rest.firstIndex(of: "\"") else { return nil }
        return String(rest[..<end])
    }

    private static func parsePathData(_ source: String) -> [String] {
        var data: [String] = []
        var cursor = source.startIndex
        while let range = source.range(of: " d=\"", range: cursor..<source.endIndex) {
            let rest = source[range.upperBound...]
            guard let end = rest.firstIndex(of: "\"") else { break }
            data.append(String(rest[..<end]))
            cursor = end
        }
        return data
    }
}

/// Minimal SVG path-data reader. Enough for the project's own artwork; it is
/// not a general SVG engine and does not pretend to be one.
enum SVGPathParser {
    static func path(from data: String) -> Path {
        var path = Path()
        var numbers: [CGFloat] = []
        var command: Character = "M"
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero

        func flush() {
            guard !numbers.isEmpty || command == "Z" || command == "z" else { return }
            apply(command, numbers, to: &path, current: &current, subpathStart: &subpathStart)
            numbers.removeAll(keepingCapacity: true)
        }

        var scanner = NumberScanner(data)
        while let token = scanner.next() {
            switch token {
            case .command(let letter):
                flush()
                command = letter
                if letter == "Z" || letter == "z" {
                    apply(letter, [], to: &path, current: &current, subpathStart: &subpathStart)
                }
            case .number(let value):
                numbers.append(value)
            }
        }
        flush()
        return path
    }

    private static func apply(
        _ command: Character,
        _ values: [CGFloat],
        to path: inout Path,
        current: inout CGPoint,
        subpathStart: inout CGPoint
    ) {
        // Work on locals: the helpers below capture them, and a closure may
        // not capture an inout parameter.
        var cursor = current
        var start = subpathStart
        defer {
            current = cursor
            subpathStart = start
        }

        let relative = command.isLowercase
        // Relative commands are measured from wherever the pen is now, so the
        // origin is re-read after every point.
        func origin() -> CGPoint { relative ? cursor : .zero }
        func point(_ index: Int) -> CGPoint {
            CGPoint(x: origin().x + values[index], y: origin().y + values[index + 1])
        }

        guard let letter = command.uppercased().first else { return }
        switch letter {
        case "M":
            guard values.count >= 2 else { return }
            cursor = point(0)
            path.move(to: cursor)
            start = cursor
            // Extra pairs after a moveto are implicit linetos.
            var index = 2
            while index + 1 < values.count {
                cursor = point(index)
                path.addLine(to: cursor)
                index += 2
            }
        case "L":
            var index = 0
            while index + 1 < values.count {
                cursor = point(index)
                path.addLine(to: cursor)
                index += 2
            }
        case "H":
            for value in values {
                cursor = CGPoint(x: (relative ? cursor.x : 0) + value, y: cursor.y)
                path.addLine(to: cursor)
            }
        case "V":
            for value in values {
                cursor = CGPoint(x: cursor.x, y: (relative ? cursor.y : 0) + value)
                path.addLine(to: cursor)
            }
        case "C":
            var index = 0
            while index + 5 < values.count {
                let c1 = point(index)
                let c2 = point(index + 2)
                let end = point(index + 4)
                path.addCurve(to: end, control1: c1, control2: c2)
                cursor = end
                index += 6
            }
        case "Q":
            var index = 0
            while index + 3 < values.count {
                let control = point(index)
                let end = point(index + 2)
                path.addQuadCurve(to: end, control: control)
                cursor = end
                index += 4
            }
        case "Z":
            path.closeSubpath()
            cursor = start
        default:
            break // Unsupported command: skip rather than draw something wrong.
        }
    }

    /// Splits path data into commands and numbers. Handles the separators SVG
    /// allows: spaces, commas, and signs that butt straight up against digits.
    private struct NumberScanner {
        enum Token {
            case command(Character)
            case number(CGFloat)
        }

        private let characters: [Character]
        private var index = 0

        init(_ text: String) { characters = Array(text) }

        mutating func next() -> Token? {
            while index < characters.count, characters[index] == " " || characters[index] == ","
                || characters[index] == "\n" || characters[index] == "\t" {
                index += 1
            }
            guard index < characters.count else { return nil }

            let character = characters[index]
            if character.isLetter {
                index += 1
                return .command(character)
            }

            var text = ""
            if character == "-" || character == "+" {
                text.append(character)
                index += 1
            }
            while index < characters.count,
                  characters[index].isNumber || characters[index] == "." || characters[index] == "e"
                    || ((characters[index] == "-" || characters[index] == "+") && text.last == "e") {
                text.append(characters[index])
                index += 1
            }
            guard let value = Double(text) else { return next() }
            return .number(CGFloat(value))
        }
    }
}

/// An inline SVG path, for the small drawings the web keeps in JSX rather than
/// in a file (the wardrobe's hand-drawn tee, for example).
struct SVGPathShape: Shape {
    let data: String
    let viewBox: CGRect

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / viewBox.width, rect.height / viewBox.height)
        let dx = rect.minX + (rect.width - viewBox.width * scale) / 2 - viewBox.minX * scale
        let dy = rect.minY + (rect.height - viewBox.height * scale) / 2 - viewBox.minY * scale
        return SVGPathParser.path(from: data)
            .applying(CGAffineTransform(translationX: dx, y: dy).scaledBy(x: scale, y: scale))
    }
}
