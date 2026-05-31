import AVFoundation
import AppKit
import Foundation

enum MediaVideoCommands {
    static func generateThumbnail(
        filePath: String,
        maxDimension: CGFloat,
        quality: CGFloat
    ) throws -> [String: JSONValue] {
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw BridgeError.invalidPayload("filePath")
        }

        let asset = AVAsset(url: URL(fileURLWithPath: filePath))
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = CGSize(width: max(1, maxDimension), height: max(1, maxDimension))

        let time = CMTime(seconds: 0, preferredTimescale: 600)
        let cgImage: CGImage
        do {
            cgImage = try imageGenerator.copyCGImage(at: time, actualTime: nil)
        } catch {
            throw BridgeError.operationFailed("Unable to render video frame: \(error.localizedDescription)")
        }

        let bounded = resizeImageIfNeeded(cgImage, maxDimension: max(1, maxDimension))
        let rep = NSBitmapImageRep(cgImage: bounded)
        guard let data = rep.representation(
            using: .jpeg,
            properties: [.compressionFactor: max(0.1, min(1.0, quality))]
        ) else {
            throw BridgeError.operationFailed("Unable to encode video thumbnail")
        }

        return [
            "dataUrl": .string("data:image/jpeg;base64,\(data.base64EncodedString())"),
            "width": .number(Double(bounded.width)),
            "height": .number(Double(bounded.height))
        ]
    }
}

private func resizeImageIfNeeded(_ image: CGImage, maxDimension: CGFloat) -> CGImage {
    let width = CGFloat(image.width)
    let height = CGFloat(image.height)
    let largest = max(width, height)
    if largest <= maxDimension {
        return image
    }

    let scale = maxDimension / largest
    let targetWidth = max(1, Int((width * scale).rounded()))
    let targetHeight = max(1, Int((height * scale).rounded()))

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
    context.draw(image, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    return context.makeImage() ?? image
}
