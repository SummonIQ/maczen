// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacZenBridge",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(name: "MacZenBridgeCore", targets: ["MacZenBridgeCore"]),
        .executable(name: "MacZenBridgeCLI", targets: ["MacZenBridgeCLI"])
    ],
    targets: [
        .target(
            name: "MacZenBridgeCore",
            path: "Sources/MacZenBridgeCore"
        ),
        .executableTarget(
            name: "MacZenBridgeCLI",
            dependencies: ["MacZenBridgeCore"],
            path: "Sources/MacZenBridgeCLI"
        )
    ]
)
