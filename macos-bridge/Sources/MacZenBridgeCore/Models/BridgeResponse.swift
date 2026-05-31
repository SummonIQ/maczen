import Foundation

public struct BridgeErrorResponse: Codable {
    public let code: String
    public let message: String
}

public struct BridgeResponse: Codable {
    public let id: String
    public let success: Bool
    public let data: [String: JSONValue]?
    public let error: BridgeErrorResponse?
    public let timing_ms: Int

    public static func success(
        id: String,
        payload: [String: JSONValue],
        startedAt: Date
    ) -> BridgeResponse {
        BridgeResponse(
            id: id,
            success: true,
            data: payload,
            error: nil,
            timing_ms: Int(Date().timeIntervalSince(startedAt) * 1000)
        )
    }

    public static func failure(
        id: String,
        code: String,
        message: String,
        startedAt: Date
    ) -> BridgeResponse {
        BridgeResponse(
            id: id,
            success: false,
            data: nil,
            error: BridgeErrorResponse(code: code, message: message),
            timing_ms: Int(Date().timeIntervalSince(startedAt) * 1000)
        )
    }
}
