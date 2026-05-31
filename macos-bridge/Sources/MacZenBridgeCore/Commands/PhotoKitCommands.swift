import AppKit
import Foundation
import Photos
import CoreGraphics

enum PhotoKitCommands {
    static func thumbnail(localIdentifier: String, size: CGFloat, quality: CGFloat) throws -> [String: JSONValue] {
        let authStatus = requestAuthorization()
        guard authStatus == .authorized || authStatus == .limited else {
            throw BridgeError.photosAccessDenied
        }

        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        guard let asset = fetchResult.firstObject else {
            throw BridgeError.operationFailed("Photo asset not found")
        }

        let imageManager = PHImageManager.default()
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
        options.isNetworkAccessAllowed = true
        options.isSynchronous = false

        let requested = CGSize(width: max(1, size), height: max(1, size))
        let semaphore = DispatchSemaphore(value: 0)
        var resultDataUrl: String?
        var resultError: String?

        imageManager.requestImage(
            for: asset,
            targetSize: requested,
            contentMode: .aspectFit,
            options: options
        ) { image, info in
            defer { semaphore.signal() }

            if let image,
               let data = jpegData(from: image, quality: max(0.1, min(1.0, quality))) {
                resultDataUrl = "data:image/jpeg;base64,\(data.base64EncodedString())"
                return
            }

            if let error = info?[PHImageErrorKey] as? Error {
                resultError = error.localizedDescription
                return
            }

            if let cancelled = info?[PHImageCancelledKey] as? Bool, cancelled {
                resultError = "PhotoKit thumbnail request cancelled"
                return
            }

            resultError = "PhotoKit did not return an image"
        }

        _ = semaphore.wait(timeout: .now() + 30)

        if let resultDataUrl {
            return ["dataUrl": .string(resultDataUrl)]
        }
        throw BridgeError.operationFailed(resultError ?? "PhotoKit thumbnail request timed out")
    }

    static func photosPermissionGranted() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .authorized || status == .limited
    }

    static func requestPhotosPermission() -> Bool {
        let status = requestAuthorization()
        return status == .authorized || status == .limited
    }

    static func listAssets(lookbackDays: Int, importAll: Bool) throws -> [String: JSONValue] {
        try ensurePhotosAuthorized()

        let fetchOptions = PHFetchOptions()
        if !importAll {
            let cutoff = Date().addingTimeInterval(TimeInterval(-lookbackDays * 24 * 60 * 60))
            fetchOptions.predicate = NSPredicate(format: "creationDate > %@", cutoff as NSDate)
        }
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]

        let results = PHAsset.fetchAssets(with: fetchOptions)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var items: [JSONValue] = []
        results.enumerateObjects { asset, _, _ in
            let resources = PHAssetResource.assetResources(for: asset)
            let fileName = resources.first?.originalFilename ?? ""
            let creation = asset.creationDate ?? Date()
            let width = asset.pixelWidth > 0 ? JSONValue.number(Double(asset.pixelWidth)) : .null
            let height = asset.pixelHeight > 0 ? JSONValue.number(Double(asset.pixelHeight)) : .null
            let isMovie = asset.mediaType == .video
            let isLivePhoto = asset.mediaSubtypes.contains(.photoLive)
            let keywords = (asset.value(forKey: "keywords") as? [String]) ?? []

            items.append(
                .object([
                    "id": .string(asset.localIdentifier),
                    "date": .string(formatter.string(from: creation)),
                    "name": .string(fileName),
                    "width": width,
                    "height": height,
                    "isMovie": .bool(isMovie),
                    "isLivePhoto": .bool(isLivePhoto),
                    "keywords": .array(keywords.map(JSONValue.string))
                ])
            )
        }

        return ["items": .array(items)]
    }

    static func listAlbums() throws -> [String: JSONValue] {
        try ensurePhotosAuthorized()

        var albums: [JSONValue] = []
        var seen = Set<String>()

        func appendCollection(_ collection: PHAssetCollection, type: String, folder: String? = nil) {
            let title = collection.localizedTitle ?? ""
            if title.isEmpty { return }

            let count = PHAsset.fetchAssets(in: collection, options: nil).count
            if count < 0 { return }

            let key = "\(collection.localIdentifier)|\(type)|\(folder ?? "")"
            if !seen.insert(key).inserted { return }

            albums.append(
                .object([
                    "id": .string(collection.localIdentifier),
                    "title": .string(title),
                    "count": .number(Double(count)),
                    "type": .string(type),
                    "folder": folder.map(JSONValue.string) ?? .null
                ])
            )
        }

        let userAlbums = PHAssetCollection.fetchAssetCollections(
            with: .album,
            subtype: .albumRegular,
            options: nil
        )
        userAlbums.enumerateObjects { collection, _, _ in
            appendCollection(collection, type: "user")
        }

        let folders = PHCollectionList.fetchTopLevelUserCollections(with: nil)
        folders.enumerateObjects { collection, _, _ in
            guard let folder = collection as? PHCollectionList else { return }
            let folderTitle = folder.localizedTitle ?? ""
            if folderTitle.isEmpty { return }
            let children = PHCollection.fetchCollections(in: folder, options: nil)
            children.enumerateObjects { child, _, _ in
                if let album = child as? PHAssetCollection {
                    appendCollection(album, type: "user", folder: folderTitle)
                }
            }
        }

        let smartAlbums = PHAssetCollection.fetchAssetCollections(
            with: .smartAlbum,
            subtype: .any,
            options: nil
        )
        smartAlbums.enumerateObjects { collection, _, _ in
            let count = PHAsset.fetchAssets(in: collection, options: nil).count
            if count > 0 {
                appendCollection(collection, type: "smart")
            }
        }

        let sharedAlbums = PHAssetCollection.fetchAssetCollections(
            with: .album,
            subtype: .albumCloudShared,
            options: nil
        )
        sharedAlbums.enumerateObjects { collection, _, _ in
            appendCollection(collection, type: "shared")
        }

        return ["albums": .array(albums)]
    }

    static func listAlbumAssets(albumId: String) throws -> [String: JSONValue] {
        try ensurePhotosAuthorized()

        let collections = PHAssetCollection.fetchAssetCollections(
            withLocalIdentifiers: [albumId],
            options: nil
        )
        guard let collection = collections.firstObject else {
            throw BridgeError.operationFailed("Album not found")
        }

        let fetchOptions = PHFetchOptions()
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        let results = PHAsset.fetchAssets(in: collection, options: fetchOptions)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var assets: [JSONValue] = []
        results.enumerateObjects { asset, _, _ in
            let resources = PHAssetResource.assetResources(for: asset)
            let fileName = resources.first?.originalFilename ?? ""
            let creation = asset.creationDate ?? Date()
            let width = asset.pixelWidth > 0 ? JSONValue.number(Double(asset.pixelWidth)) : .null
            let height = asset.pixelHeight > 0 ? JSONValue.number(Double(asset.pixelHeight)) : .null
            let isMovie = asset.mediaType == .video
            let isLivePhoto = asset.mediaSubtypes.contains(.photoLive)

            assets.append(
                .object([
                    "id": .string(asset.localIdentifier),
                    "date": .string(formatter.string(from: creation)),
                    "name": .string(fileName),
                    "width": width,
                    "height": height,
                    "isMovie": .bool(isMovie),
                    "isLivePhoto": .bool(isLivePhoto)
                ])
            )
        }

        return ["assets": .array(assets)]
    }

    static func importAssets(
        outDir: String?,
        lookbackDays: Int,
        importAll: Bool,
        limit: Int?
    ) throws -> [String: JSONValue] {
        try ensurePhotosAuthorized()

        let destinationRoot: String = {
            if let outDir, !outDir.isEmpty {
                return outDir
            }
            return URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("maczen-imports", isDirectory: true)
                .path
        }()

        do {
            try FileManager.default.createDirectory(
                atPath: destinationRoot,
                withIntermediateDirectories: true
            )
        } catch {
            throw BridgeError.operationFailed("Unable to create import destination: \(error.localizedDescription)")
        }

        let fetchOptions = PHFetchOptions()
        if !importAll {
            let cutoff = Date().addingTimeInterval(TimeInterval(-lookbackDays * 24 * 60 * 60))
            fetchOptions.predicate = NSPredicate(format: "creationDate > %@", cutoff as NSDate)
        }
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        let results = PHAsset.fetchAssets(with: fetchOptions)

        var imported: [JSONValue] = []
        var failedCount = 0
        let totalLimit = max(1, limit ?? Int.max)
        var processed = 0

        results.enumerateObjects { asset, _, stop in
            if processed >= totalLimit {
                stop.pointee = true
                return
            }
            processed += 1

            guard let resource = pickResource(for: asset) else {
                failedCount += 1
                return
            }

            let originalName = resource.originalFilename.isEmpty ? "Asset" : resource.originalFilename
            let safeName = originalName.replacingOccurrences(of: "/", with: "-")
            let fileName = "\(UUID().uuidString)-\(safeName)"
            let outputUrl = URL(fileURLWithPath: destinationRoot).appendingPathComponent(fileName)

            do {
                try writeResource(resource, to: outputUrl, timeoutSeconds: 120)
            } catch {
                failedCount += 1
                return
            }

            imported.append(
                .object([
                    "id": .string(asset.localIdentifier),
                    "path": .string(outputUrl.path),
                    "name": .string(fileName),
                    "isMovie": .bool(asset.mediaType == .video),
                    "isLivePhoto": .bool(asset.mediaSubtypes.contains(.photoLive))
                ])
            )
        }

        return [
            "destination": .string(destinationRoot),
            "importedCount": .number(Double(imported.count)),
            "failedCount": .number(Double(failedCount)),
            "items": .array(imported)
        ]
    }

    static func livePhotoVideoPath(localIdentifier: String, outDir: String?) throws -> [String: JSONValue] {
        try ensurePhotosAuthorized()

        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        guard let asset = fetchResult.firstObject else {
            throw BridgeError.operationFailed("Photo asset not found")
        }

        let resources = PHAssetResource.assetResources(for: asset)
        guard let pairedVideo = resources.first(where: { $0.type == .pairedVideo }) else {
            throw BridgeError.operationFailed("Live Photo paired video not found")
        }

        let outputDir: String = {
            if let outDir, !outDir.isEmpty { return outDir }
            return URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("maczen-live-photo", isDirectory: true)
                .path
        }()

        do {
            try FileManager.default.createDirectory(
                atPath: outputDir,
                withIntermediateDirectories: true
            )
        } catch {
            throw BridgeError.operationFailed("Unable to create output dir: \(error.localizedDescription)")
        }

        let originalName = pairedVideo.originalFilename.isEmpty ? "LivePhoto.mov" : pairedVideo.originalFilename
        let safeName = originalName.replacingOccurrences(of: "/", with: "-")
        let fileName = "\(UUID().uuidString)-\(safeName)"
        let outputUrl = URL(fileURLWithPath: outputDir).appendingPathComponent(fileName)

        try writeResource(pairedVideo, to: outputUrl, timeoutSeconds: 120)

        return [
            "path": .string(outputUrl.path)
        ]
    }

    private static func ensurePhotosAuthorized() throws {
        let status = requestAuthorization()
        guard status == .authorized || status == .limited else {
            throw BridgeError.photosAccessDenied
        }
    }
}

private func pickResource(for asset: PHAsset) -> PHAssetResource? {
    let resources = PHAssetResource.assetResources(for: asset)

    if asset.mediaType == .video {
        return resources.first(where: { $0.type == .fullSizeVideo })
            ?? resources.first(where: { $0.type == .video })
    }

    return resources.first(where: { $0.type == .fullSizePhoto })
        ?? resources.first(where: { $0.type == .photo })
        ?? resources.first(where: { $0.type == .alternatePhoto })
}

private func writeResource(
    _ resource: PHAssetResource,
    to outputUrl: URL,
    timeoutSeconds: TimeInterval
) throws {
    let requestOptions = PHAssetResourceRequestOptions()
    requestOptions.isNetworkAccessAllowed = true

    let semaphore = DispatchSemaphore(value: 0)
    var exportError: Error?

    PHAssetResourceManager.default().writeData(
        for: resource,
        toFile: outputUrl,
        options: requestOptions
    ) { error in
        exportError = error
        semaphore.signal()
    }

    let waitResult = semaphore.wait(timeout: .now() + timeoutSeconds)
    if waitResult == .timedOut {
        throw BridgeError.operationFailed("PhotoKit export timed out")
    }
    if let exportError {
        throw BridgeError.operationFailed("PhotoKit export failed: \(exportError.localizedDescription)")
    }
}

private func requestAuthorization() -> PHAuthorizationStatus {
    let current = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if current != .notDetermined {
        return current
    }

    let semaphore = DispatchSemaphore(value: 0)
    var resolved = current
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
        resolved = status
        semaphore.signal()
    }
    _ = semaphore.wait(timeout: .now() + 15)
    return resolved
}

private func jpegData(from image: NSImage, quality: CGFloat) -> Data? {
    if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let rep = NSBitmapImageRep(cgImage: cgImage)
        return rep.representation(using: .jpeg, properties: [.compressionFactor: quality])
    }

    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else {
        return nil
    }
    return rep.representation(using: .jpeg, properties: [.compressionFactor: quality])
}
