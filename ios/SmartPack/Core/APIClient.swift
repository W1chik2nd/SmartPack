import Foundation

/// One HTTP layer for the whole app. Every screen calls these methods and
/// renders what comes back — no business rules live on this side of the wire
/// (AGENTS.md §3). The paths match `client/src/api.ts` exactly.
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Base URL

    /// Set in Info.plist (`SmartPackAPIBaseURL`) so the simulator, a LAN
    /// device, and a deployed backend can all be pointed at without a rebuild.
    nonisolated static var baseURL: URL {
        let configured = Bundle.main.object(forInfoDictionaryKey: "SmartPackAPIBaseURL") as? String
        let raw = (configured?.isEmpty == false ? configured! : "http://localhost:4177")
        return URL(string: raw) ?? URL(string: "http://localhost:4177")!
    }

    nonisolated static func url(_ path: String) -> URL {
        URL(string: path, relativeTo: baseURL) ?? baseURL
    }

    // MARK: - Request

    /// The API's error envelope: `{ "error": "…" }`.
    private struct ErrorBody: Decodable { let error: String? }

    struct APIError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        var req = URLRequest(url: Self.url(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = TokenStore.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            // A dead backend otherwise surfaces as a bare "cancelled" or
            // "could not connect", which reads like a bug in this app.
            throw APIError(message: Strings.backendUnreachable(path, error.localizedDescription))
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let detail = (try? decoder.decode(ErrorBody.self, from: data))?.error
            throw APIError(message: detail ?? "Request failed (\(status))")
        }
        return try decoder.decode(T.self, from: data)
    }

    private func send<T: Decodable, Body: Encodable>(
        _ path: String,
        method: String,
        _ payload: Body
    ) async throws -> T {
        try await request(path, method: method, body: try encoder.encode(payload))
    }

    private func query(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? value
    }

    // MARK: - Auth

    struct OK: Decodable { let ok: Bool? }

    func login(email: String, password: String) async throws -> AuthResponse {
        try await send("/api/login", method: "POST", ["email": email, "password": password])
    }

    func checkEmail(_ email: String) async throws -> OK {
        try await send("/api/check-email", method: "POST", ["email": email])
    }

    func register(credentials: Credentials, profile: Profile) async throws -> AuthResponse {
        var payload = profile
        payload["email"] = .text(credentials.email)
        payload["password"] = .text(credentials.password)
        return try await send("/api/register", method: "POST", payload)
    }

    func me() async throws -> UserResponse {
        try await request("/api/me")
    }

    func logout() async throws -> OK {
        try await request("/api/logout", method: "POST")
    }

    func profileOptions() async throws -> ProfileFieldsResponse {
        try await request("/api/profile-options")
    }

    func updateProfile(_ profile: Profile) async throws -> UserResponse {
        try await send("/api/profile", method: "PUT", profile)
    }

    // MARK: - Catalog

    func scenarios() async throws -> ScenariosResponse {
        try await request("/api/scenarios")
    }

    /// Without coordinates the server answers for its default city.
    func weather(lat: Double? = nil, lon: Double? = nil) async throws -> Weather {
        guard let lat, let lon else { return try await request("/api/weather") }
        return try await request("/api/weather?lat=\(lat)&lon=\(lon)")
    }

    // MARK: - Wardrobe

    func wardrobeItems() async throws -> WardrobeItemsResponse {
        try await request("/api/wardrobe/items")
    }

    func recognizeClothing(imageDataURL: String) async throws -> RecognizeResponse {
        try await send("/api/wardrobe/recognize", method: "POST", ["image": imageDataURL])
    }

    func deleteWardrobeItem(id: String) async throws -> OK {
        try await request("/api/wardrobe/items/\(query(id))", method: "DELETE")
    }

    /// Photo URL for `AsyncImage`. The token rides in the query string because
    /// image loaders send no Authorization header — same contract as the web.
    nonisolated static func wardrobePhotoURL(id: String) -> URL? {
        let encodedId = id.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? id
        let token = (TokenStore.token ?? "").addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? ""
        return URL(string: "/api/wardrobe/photo/\(encodedId)?token=\(token)", relativeTo: baseURL)
    }

    // MARK: - Assistant

    func chat(messages: [ChatMessage]) async throws -> ChatResponse {
        try await send("/api/chat", method: "POST", ["messages": messages])
    }

    // MARK: - Trip plans

    func searchPlaces(_ text: String, lang: Lang) async throws -> PlacesResponse {
        try await request("/api/places?q=\(query(text))&lang=\(lang.rawValue)")
    }

    func generateTripPlan(_ plan: NewTripPlan) async throws -> TripPlanResponse {
        try await send("/api/trip-plans/generate", method: "POST", plan)
    }

    func tripPlan(id: String) async throws -> TripPlanResponse {
        try await request("/api/trip-plans/\(query(id))")
    }

    func tripPlans() async throws -> TripPlansResponse {
        try await request("/api/trip-plans")
    }

    func tripWeather(id: String) async throws -> TripWeatherResponse {
        try await request("/api/trip-plans/\(query(id))/weather")
    }

    func deleteTripPlan(id: String) async throws -> OK {
        try await request("/api/trip-plans/\(query(id))", method: "DELETE")
    }

    // MARK: - Itinerary

    func itineraryTrips(scenario: String?) async throws -> TripsResponse {
        let suffix = scenario.map { "?scenario=\(query($0))" } ?? ""
        return try await request("/api/itinerary/trips\(suffix)")
    }

    func itineraryTrip(id: String) async throws -> SingleTripResponse {
        try await request("/api/itinerary/trips/\(query(id))")
    }

    func stopPhoto(stopId: String) async throws -> StopPhotoResponse {
        try await request("/api/itinerary/photo/\(query(stopId))")
    }

    // MARK: - Packing and outfits

    /// balance: 0 = pack lightest, 100 = most outfit variety.
    func packingPlan(balance: Double, tripPlanId: String) async throws -> PackingPlanResponse {
        try await request("/api/packing?balance=\(Int(balance))&tripPlanId=\(query(tripPlanId))")
    }

    func outfitPlan(tripPlanId: String?) async throws -> OutfitPlanResponse {
        let suffix = tripPlanId.map { "?tripPlanId=\(query($0))" } ?? ""
        return try await request("/api/outfit-plan\(suffix)")
    }
}

private extension CharacterSet {
    /// `urlQueryAllowed` still permits `&`, `?` and `+`, which corrupt values.
    static let urlQueryValueAllowed = CharacterSet.urlQueryAllowed
        .subtracting(CharacterSet(charactersIn: "&?+=/"))
}
