import SwiftUI

/// The assistant. The server owns the prompt, the personalization, and the
/// actions it returns; this sheet sends the transcript and renders the reply.
///
/// Phone adaptation: the web floats a panel above the page. A sheet is the
/// phone equivalent — it keeps the page underneath, resizes with the keyboard,
/// and dismisses with a swipe.
struct ChatView: View {
    @Environment(AppState.self) private var app
    @Environment(\.lang) private var lang
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Rule()
            transcript
            Rule()
            composer
        }
        .background(Theme.bg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear { inputFocused = true }
    }

    private var header: some View {
        HStack {
            Text(Strings.chatTitle(lang).uppercased())
                .font(Theme.heavy(18))
                .tracking(0.6)
            Spacer()
            Button {
                dismiss()
            } label: {
                Text("×")
                    .font(Theme.heavy(24))
                    .foregroundStyle(Theme.text)
                    .frame(width: 34, height: 34)
            }
            .accessibilityLabel(Strings.chatCloseDialog(lang))
        }
        .padding(.horizontal, Theme.space2)
        .padding(.vertical, Theme.space1)
        .background(Theme.yellow)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.space1) {
                    // The greeting is presentation only: it is rendered from
                    // the string table and never sent to /api/chat.
                    bubble(Strings.chatGreeting(lang), role: .assistant)

                    ForEach(messages) { message in
                        bubble(message.content, role: message.role)
                    }

                    if busy {
                        bubble(Strings.chatThinking(lang), role: .assistant, muted: true)
                    }
                    if let error {
                        ErrorBanner(message: error)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(Theme.space2)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: messages.count) { withAnimation { proxy.scrollTo("bottom") } }
            .onChange(of: busy) { withAnimation { proxy.scrollTo("bottom") } }
        }
    }

    private func bubble(_ text: String, role: ChatMessage.Role, muted: Bool = false) -> some View {
        Text(text)
            .font(Theme.regular(15))
            .foregroundStyle(role == .user ? Theme.white : (muted ? Theme.textSecondary : Theme.text))
            .fixedSize(horizontal: false, vertical: true)
            .padding(Theme.space2)
            .background(role == .user ? Theme.blue : Theme.white)
            .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
            .frame(maxWidth: .infinity, alignment: role == .user ? .trailing : .leading)
    }

    private var composer: some View {
        HStack(spacing: Theme.space1) {
            TextField(Strings.chatPlaceholder(lang), text: $input, axis: .vertical)
                .font(Theme.regular(15))
                .foregroundStyle(Theme.text)
                .tint(Theme.blue)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .background(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.hairline))
                .accessibilityLabel(Strings.chatTitle(lang))

            Button {
                Task { await send() }
            } label: {
                Text(Strings.chatSend(lang))
            }
            .buttonStyle(BauhausButtonStyle(fill: Theme.red, tint: Theme.white))
            .disabled(busy || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(Theme.space2)
        .background(Theme.bg)
    }

    private func send() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy else { return }

        error = nil
        input = ""
        messages.append(ChatMessage(role: .user, content: text))
        busy = true
        defer { busy = false }

        do {
            let response = try await APIClient.shared.chat(messages: messages)
            messages.append(ChatMessage(role: .assistant, content: response.reply))
            if let actions = response.actions, !actions.isEmpty {
                dismiss()
                await app.apply(actions)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// The floating launcher: a Bauhaus speech bubble — rectangle plus triangular
/// tail, three primary dots. Pure geometry.
struct ChatLauncher: View {
    @Binding var open: Bool
    @Environment(\.lang) private var lang

    var body: some View {
        Button {
            open.toggle()
        } label: {
            SpeechBubbleMark()
                .frame(width: 34, height: 34)
                .padding(12)
                .background(Theme.white)
                .overlay(Rectangle().strokeBorder(Theme.black, lineWidth: Theme.borderWidth))
                .background(Rectangle().fill(Theme.black).offset(x: 4, y: 4))
        }
        .accessibilityLabel(Strings.chatOpen(lang))
    }
}

struct SpeechBubbleMark: View {
    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width, geo.size.height) / 28
            ZStack(alignment: .topLeading) {
                Path { path in
                    path.addRect(CGRect(x: 2 * scale, y: 4 * scale, width: 24 * scale, height: 15 * scale))
                    path.move(to: CGPoint(x: 8 * scale, y: 19 * scale))
                    path.addLine(to: CGPoint(x: 8 * scale, y: 26 * scale))
                    path.addLine(to: CGPoint(x: 15 * scale, y: 19 * scale))
                    path.closeSubpath()
                }
                .fill(Theme.blue)

                let dots: [(CGFloat, Color)] = [(8.5, Theme.red), (14.0, Theme.yellow), (19.5, Theme.white)]
                ForEach(Array(dots.enumerated()), id: \.offset) { _, dot in
                    Circle()
                        .fill(dot.1)
                        .frame(width: 4.4 * scale, height: 4.4 * scale)
                        .offset(x: (dot.0 - 2.2) * scale, y: (11.5 - 2.2) * scale)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
