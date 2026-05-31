import AppKit
import Foundation
import ImageIO
import Vision

enum MediaOcrCommands {
    static func recognizeText(filePath: String) throws -> [String: JSONValue] {
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw BridgeError.invalidPayload("filePath")
        }

        guard let sourceImage = cgImage(from: filePath),
              let image = rasterizedImageForOCR(sourceImage) else {
            throw BridgeError.operationFailed("Unable to load image for OCR")
        }

        if image.width < 8 || image.height < 8 {
            return [
                "text": .string(""),
                "lineCount": .number(0),
                "averageConfidence": .null
            ]
        }

        var dedupedLines: [String] = []
        var seen = Set<String>()
        var confidenceSum = 0.0
        var confidenceCount = 0

        do {
            for region in ocrRegions(for: image) {
                let recognized = try recognizeLines(in: region)
                for line in recognized {
                    if seen.insert(line.text).inserted {
                        dedupedLines.append(line.text)
                        confidenceSum += line.confidence
                        confidenceCount += 1
                    }
                }
            }
        } catch {
            throw BridgeError.operationFailed("Vision request failed: \(error.localizedDescription)")
        }

        let averageConfidence = confidenceCount > 0
            ? JSONValue.number(confidenceSum / Double(confidenceCount))
            : .null

        return [
            "text": .string(dedupedLines.joined(separator: "\n")),
            "lineCount": .number(Double(dedupedLines.count)),
            "averageConfidence": averageConfidence
        ]
    }
}

private struct RecognizedLine {
    let text: String
    let confidence: Double
}

private func cgImage(from filePath: String) -> CGImage? {
    let url = URL(fileURLWithPath: filePath)
    if let source = CGImageSourceCreateWithURL(url as CFURL, nil),
       let image = CGImageSourceCreateImageAtIndex(source, 0, nil) {
        return image
    }
    guard let image = NSImage(contentsOfFile: filePath) else {
        return nil
    }
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

private func rasterizedImageForOCR(_ image: CGImage) -> CGImage? {
    let sourceWidth = image.width
    let sourceHeight = image.height
    guard sourceWidth > 0, sourceHeight > 0 else { return nil }

    let scale: CGFloat = max(sourceWidth, sourceHeight) < 1800 ? 2.0 : 1.0
    let targetWidth = max(1, Int(CGFloat(sourceWidth) * scale))
    let targetHeight = max(1, Int(CGFloat(sourceHeight) * scale))

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil,
            width: targetWidth,
            height: targetHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) else {
        return image
    }

    context.interpolationQuality = .high
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    context.draw(image, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    return context.makeImage() ?? image
}

private func ocrRegions(for image: CGImage) -> [CGImage] {
    var regions: [CGImage] = [image]
    let columns = image.width >= 1200 ? 2 : 1
    let rows = image.height >= 700 ? 2 : 1
    if columns == 1 && rows == 1 {
        return regions
    }

    let overlapRatio: CGFloat = 0.16
    let tileWidth = CGFloat(image.width) / CGFloat(columns)
    let tileHeight = CGFloat(image.height) / CGFloat(rows)

    for row in 0..<rows {
        for column in 0..<columns {
            let x = max(0, CGFloat(column) * tileWidth - tileWidth * overlapRatio)
            let y = max(0, CGFloat(row) * tileHeight - tileHeight * overlapRatio)
            let maxX = min(CGFloat(image.width), CGFloat(column + 1) * tileWidth + tileWidth * overlapRatio)
            let maxY = min(CGFloat(image.height), CGFloat(row + 1) * tileHeight + tileHeight * overlapRatio)
            let rect = CGRect(
                x: x.rounded(.down),
                y: y.rounded(.down),
                width: (maxX - x).rounded(.up),
                height: (maxY - y).rounded(.up)
            ).integral

            if let tile = image.cropping(to: rect) {
                regions.append(tile)
            }
        }
    }

    return regions
}

private func recognizeLines(in image: CGImage) throws -> [RecognizedLine] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.008
    request.recognitionLanguages = ["en-US"]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations.compactMap { observation -> RecognizedLine? in
        guard let candidate = observation.topCandidates(1).first else {
            return nil
        }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
            return nil
        }
        return RecognizedLine(text: text, confidence: Double(candidate.confidence))
    }
}
