import Foundation
import CoreGraphics

public enum BridgeError: Error {
    case invalidPayload(String)
    case notImplemented(String)
    case photosAccessDenied
    case operationFailed(String)
}

extension BridgeError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .invalidPayload(let field):
            return "Invalid or missing payload field: \(field)"
        case .notImplemented(let command):
            return "\(command) is not implemented yet"
        case .photosAccessDenied:
            return "PhotoKit access denied"
        case .operationFailed(let message):
            return message
        }
    }
}

enum BridgeCommandRouter {
    static func handle(request: BridgeRequest, startedAt: Date) -> BridgeResponse {
        do {
            switch request.command {
            case "bridge.health":
                return .success(
                    id: request.id,
                    payload: [
                        "status": .string("ok"),
                        "version": .string("0.0.1")
                    ],
                    startedAt: startedAt
                )

            case "photokit.thumbnail":
                let localIdentifier = try stringValue("localIdentifier", from: request.payload)
                let size = try optionalNumberValue("size", from: request.payload) ?? 360
                let quality = try optionalNumberValue("quality", from: request.payload) ?? 0.7
                let payload = try PhotoKitCommands.thumbnail(
                    localIdentifier: localIdentifier,
                    size: CGFloat(size),
                    quality: CGFloat(quality)
                )
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "photokit.list":
                let lookbackDays =
                    Int(try optionalNumberValue("lookbackDays", from: request.payload) ?? 30)
                let importAll = try optionalBoolValue("importAll", from: request.payload) ?? false
                let payload = try PhotoKitCommands.listAssets(
                    lookbackDays: max(1, lookbackDays),
                    importAll: importAll
                )
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "photokit.list_albums":
                let payload = try PhotoKitCommands.listAlbums()
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "photokit.list_album_assets":
                let albumId = try stringValue("albumId", from: request.payload)
                let payload = try PhotoKitCommands.listAlbumAssets(albumId: albumId)
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "photokit.import":
                let outDir = try optionalStringValue("outDir", from: request.payload)
                let lookbackDays =
                    Int(try optionalNumberValue("lookbackDays", from: request.payload) ?? 30)
                let importAll = try optionalBoolValue("importAll", from: request.payload) ?? false
                let limit = Int(try optionalNumberValue("limit", from: request.payload) ?? 0)
                let payload = try PhotoKitCommands.importAssets(
                    outDir: outDir,
                    lookbackDays: max(1, lookbackDays),
                    importAll: importAll,
                    limit: limit > 0 ? limit : nil
                )
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "media.ocr":
                let filePath = try stringValue("filePath", from: request.payload)
                let payload = try MediaOcrCommands.recognizeText(filePath: filePath)
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "media.video_thumbnail":
                let filePath = try stringValue("filePath", from: request.payload)
                let maxDimension = try optionalNumberValue("maxDimension", from: request.payload) ?? 640
                let quality = try optionalNumberValue("quality", from: request.payload) ?? 0.7
                let payload = try MediaVideoCommands.generateThumbnail(
                    filePath: filePath,
                    maxDimension: CGFloat(maxDimension),
                    quality: CGFloat(quality)
                )
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "media.live_photo_video":
                let localIdentifier = try stringValue("localIdentifier", from: request.payload)
                let outDir = try optionalStringValue("outDir", from: request.payload)
                let payload = try PhotoKitCommands.livePhotoVideoPath(
                    localIdentifier: localIdentifier,
                    outDir: outDir
                )
                return .success(
                    id: request.id,
                    payload: payload,
                    startedAt: startedAt
                )

            case "permissions.photos":
                return .success(
                    id: request.id,
                    payload: ["granted": .bool(PhotoKitCommands.photosPermissionGranted())],
                    startedAt: startedAt
                )

            case "permissions.photos.request":
                return .success(
                    id: request.id,
                    payload: ["granted": .bool(PhotoKitCommands.requestPhotosPermission())],
                    startedAt: startedAt
                )

            case "permissions.screen_recording":
                return .success(
                    id: request.id,
                    payload: ["granted": .bool(CGPreflightScreenCaptureAccess())],
                    startedAt: startedAt
                )

            default:
                throw BridgeError.notImplemented(request.command)
            }
        } catch {
            let bridgeError = error as? BridgeError
            return .failure(
                id: request.id,
                code: code(for: bridgeError),
                message: error.localizedDescription,
                startedAt: startedAt
            )
        }
    }

    private static func code(for error: BridgeError?) -> String {
        switch error {
        case .invalidPayload:
            return "INVALID_PAYLOAD"
        case .notImplemented:
            return "NOT_IMPLEMENTED"
        case .photosAccessDenied:
            return "PHOTOS_ACCESS_DENIED"
        case .operationFailed:
            return "OPERATION_FAILED"
        case nil:
            return "UNKNOWN_ERROR"
        }
    }

    private static func stringValue(
        _ key: String,
        from payload: [String: JSONValue]
    ) throws -> String {
        guard let value = payload[key], case .string(let string) = value else {
            throw BridgeError.invalidPayload(key)
        }
        return string
    }

    private static func optionalNumberValue(
        _ key: String,
        from payload: [String: JSONValue]
    ) throws -> Double? {
        guard let value = payload[key] else {
            return nil
        }
        guard case .number(let number) = value else {
            throw BridgeError.invalidPayload(key)
        }
        return number
    }

    private static func optionalBoolValue(
        _ key: String,
        from payload: [String: JSONValue]
    ) throws -> Bool? {
        guard let value = payload[key] else {
            return nil
        }
        guard case .bool(let bool) = value else {
            throw BridgeError.invalidPayload(key)
        }
        return bool
    }

    private static func optionalStringValue(
        _ key: String,
        from payload: [String: JSONValue]
    ) throws -> String? {
        guard let value = payload[key] else {
            return nil
        }
        guard case .string(let string) = value else {
            throw BridgeError.invalidPayload(key)
        }
        return string
    }
}
