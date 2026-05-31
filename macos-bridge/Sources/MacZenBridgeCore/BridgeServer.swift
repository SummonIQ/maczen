import Foundation

public final class BridgeServer {
    public init() {}

    public func run() {
        while let line = readLine() {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                continue
            }

            let startedAt = Date()

            do {
                let requestData = Data(trimmed.utf8)
                let request = try JSONDecoder().decode(BridgeRequest.self, from: requestData)
                let response = BridgeCommandRouter.handle(request: request, startedAt: startedAt)
                try write(response: response)
            } catch {
                let response = BridgeResponse.failure(
                    id: "unknown",
                    code: "INVALID_REQUEST",
                    message: error.localizedDescription,
                    startedAt: startedAt
                )
                try? write(response: response)
            }
        }
    }

    private func write(response: BridgeResponse) throws {
        let data = try JSONEncoder().encode(response)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([0x0a]))
    }
}
