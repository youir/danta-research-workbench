#!/usr/bin/swift
import Foundation
import Security
import Darwin

private let keychainService = "ai.danta.research-workbench.typesafe"
private let keychainAccount = "TYPESAFE_API_KEY"

private func readKey() -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data,
          let value = String(data: data, encoding: .utf8), !value.isEmpty else { return nil }
    return value
}

private func storeKey(_ value: String) -> OSStatus {
    let base: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount
    ]
    let data = Data(value.utf8)
    let update = SecItemUpdate(base as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if update == errSecSuccess { return update }
    guard update == errSecItemNotFound else { return update }
    var add = base
    add[kSecValueData as String] = data
    add[kSecAttrLabel as String] = "Danta research workbench Jev API key"
    return SecItemAdd(add as CFDictionary, nil)
}

private func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

guard CommandLine.arguments.count == 2 else {
    fail("Usage: swift scripts/jev_mcp_launcher.swift setup|check|run")
}

switch CommandLine.arguments[1] {
case "setup":
    guard let raw = getpass("TypeSafe API key (input hidden): ") else {
        fail("Could not read key from terminal.")
    }
    let value = String(cString: raw)
    memset(raw, 0, strlen(raw))
    guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        fail("No key entered; Keychain was not changed.")
    }
    let status = storeKey(value)
    guard status == errSecSuccess else {
        fail("macOS Keychain could not save the key (status \(status)).")
    }
    print("TypeSafe API key saved in this Mac's login Keychain.")
case "check":
    if readKey() != nil {
        print("TypeSafe API key is present in this Mac's login Keychain.")
    } else {
        fail("TypeSafe API key is not configured. Run: swift scripts/jev_mcp_launcher.swift setup", code: 2)
    }
case "run":
    guard let key = readKey() else {
        fail("TypeSafe API key is missing from this Mac's login Keychain. Run: swift scripts/jev_mcp_launcher.swift setup", code: 78)
    }
    let process = Process()
    var environment = ProcessInfo.processInfo.environment
    environment["TYPESAFE_API_KEY"] = key
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    let bundledNode = "\(home)/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
    var pathEntries = (environment["PATH"] ?? "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin").split(separator: ":").map(String.init)
    if FileManager.default.isExecutableFile(atPath: "\(bundledNode)/node") {
        pathEntries.insert(bundledNode, at: 0)
    }
    for standardPath in ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin"] where !pathEntries.contains(standardPath) {
        pathEntries.append(standardPath)
    }
    environment["PATH"] = pathEntries.joined(separator: ":")

    // Codex's bundled Node is new enough for Jev, but it has no matching npm.
    // Reuse the installed npm CLI explicitly when both are available.
    let npmCliCandidates = ["/usr/local/lib/node_modules/npm/bin/npx-cli.js",
                            "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js"]
    if FileManager.default.isExecutableFile(atPath: "\(bundledNode)/node"),
       let npmCli = npmCliCandidates.first(where: { FileManager.default.fileExists(atPath: $0) }) {
        process.executableURL = URL(fileURLWithPath: "\(bundledNode)/node")
        process.arguments = [npmCli, "-y", "@jkudish/jev-mcp"]
        environment["npm_config_prefix"] = npmCli.hasPrefix("/opt/homebrew/") ? "/opt/homebrew" : "/usr/local"
    } else {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["npx", "-y", "@jkudish/jev-mcp"]
    }
    process.environment = environment
    do {
        try process.run()
        process.waitUntilExit()
        exit(process.terminationStatus)
    } catch {
        fail("Could not start Jev MCP through npx. Check Node.js 22+ and npm access.", code: 127)
    }
default:
    fail("Unknown action. Use setup, check, or run.")
}
