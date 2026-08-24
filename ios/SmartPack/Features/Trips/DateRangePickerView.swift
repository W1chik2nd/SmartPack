import SwiftUI

/// Date range selection. The first tap sets the start, the second the end;
/// tapping earlier than the start restarts the range.
///
/// Dates travel as "YYYY-MM-DD" and are always built from local calendar
/// components — never from a UTC conversion, which east of Greenwich turns the
/// 1st into the previous month's 31st.
struct DateRange: Equatable, Hashable {
    var start: String
    var end: String
}

struct DateRangePickerView: View {
    @Binding var value: DateRange?

    @Environment(\.lang) private var lang
    @State private var cursor: (year: Int, month: Int)

    init(value: Binding<DateRange?>) {
        _value = value
        // Open on the month of an existing range, otherwise on this month.
        let today = Calendar.current.dateComponents([.year, .month], from: Date())
        if let range = value.wrappedValue, let parts = TripDate.components(range.start) {
            _cursor = State(initialValue: (parts.year ?? today.year!, parts.month ?? today.month!))
        } else {
            _cursor = State(initialValue: (today.year!, today.month!))
        }
    }

    private static let weekdays: [Lang: [String]] = [
        .en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
        .zh: ["一", "二", "三", "四", "五", "六", "日"],
    ]

    var body: some View {
        VStack(spacing: 0) {
            header
            Rule(width: Theme.hairline)
            weekdayRow
            grid
        }
        .bauhausPanel()
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 0) {
            monthButton("‹", -1, label: Strings.prevMonth(lang))
            Text(monthLabel)
                .font(Theme.heavy(17))
                .foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.updatesFrequently)
            monthButton("›", 1, label: Strings.nextMonth(lang))
        }
        .padding(.vertical, Theme.space1)
        .background(Theme.white)
    }

    private func monthButton(_ glyph: String, _ delta: Int, label: String) -> some View {
        Button { shiftMonth(delta) } label: {
            Text(glyph)
                .font(Theme.heavy(24))
                .foregroundStyle(Theme.text)
                .frame(width: 44, height: 36)
        }
        .accessibilityLabel(label)
    }

    private var monthLabel: String {
        guard let date = Calendar.current.date(from: DateComponents(year: cursor.year, month: cursor.month, day: 1))
        else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: lang.localeIdentifier)
        formatter.setLocalizedDateFormatFromTemplate("yMMMM")
        return formatter.string(from: date)
    }

    private func shiftMonth(_ delta: Int) {
        var components = DateComponents(year: cursor.year, month: cursor.month + delta, day: 1)
        guard let date = Calendar.current.date(from: components) else { return }
        components = Calendar.current.dateComponents([.year, .month], from: date)
        cursor = (components.year ?? cursor.year, components.month ?? cursor.month)
    }

    // MARK: - Grid

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(Self.weekdays[lang] ?? [], id: \.self) { day in
                Text(day)
                    .font(Theme.bold(12))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 6)
        .background(Theme.bg)
        .accessibilityHidden(true)
    }

    private var grid: some View {
        let days = daysInMonth
        let lead = firstWeekday
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
            ForEach(0..<lead, id: \.self) { index in
                Color.clear.frame(height: 44).id("lead-\(index)")
            }
            ForEach(1...days, id: \.self) { day in
                dayCell(day)
            }
        }
        .padding(.bottom, Theme.space1)
        .background(Theme.white)
        .accessibilityLabel(Strings.pickDates(lang))
    }

    private func dayCell(_ day: Int) -> some View {
        let iso = TripDate.iso(year: cursor.year, month: cursor.month, day: day)
        let isPast = iso < TripDate.todayISO
        let beyondMax = latestEnd.map { iso > $0 } ?? false
        let inRange = value.map { iso >= $0.start && iso <= $0.end } ?? false
        let isEdge = value.map { iso == $0.start || iso == $0.end } ?? false
        let isToday = iso == TripDate.todayISO

        return Button {
            pick(iso)
        } label: {
            Text("\(day)")
                .font(isEdge ? Theme.heavy(15) : Theme.bold(15))
                .foregroundStyle(cellTint(isEdge: isEdge, disabled: isPast || beyondMax))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(cellFill(inRange: inRange, isEdge: isEdge))
                .overlay {
                    if isToday { Rectangle().strokeBorder(Theme.blue, lineWidth: Theme.hairline) }
                }
        }
        .disabled(isPast || beyondMax)
        .accessibilityLabel(iso)
        .accessibilityAddTraits(inRange ? [.isSelected, .isButton] : .isButton)
    }

    private func cellFill(inRange: Bool, isEdge: Bool) -> Color {
        if isEdge { return Theme.red }
        if inRange { return Theme.yellow }
        return Theme.white
    }

    private func cellTint(isEdge: Bool, disabled: Bool) -> Color {
        if disabled { return Theme.disabledText }
        return isEdge ? Theme.white : Theme.text
    }

    // MARK: - Selection

    private func pick(_ day: String) {
        // Nothing picked yet, or a full range already chosen → start over.
        // Only a start with no end gets completed.
        guard let current = value, current.start == current.end, day >= current.start else {
            value = DateRange(start: day, end: day)
            return
        }
        value = DateRange(start: current.start, end: day)
    }

    /// While only a start is set, days past the trip-length cap are unreachable.
    /// The server checks again on save; this only greys them out.
    private var latestEnd: String? {
        guard let value, value.start == value.end else { return nil }
        return TripDate.addingDays(value.start, TripConstraints.maxTripDays - 1)
    }

    private var daysInMonth: Int {
        guard let date = Calendar.current.date(from: DateComponents(year: cursor.year, month: cursor.month, day: 1)),
              let range = Calendar.current.range(of: .day, in: .month, for: date)
        else { return 30 }
        return range.count
    }

    /// Weekday of the 1st, Monday-first — the convention both languages use.
    private var firstWeekday: Int {
        guard let date = Calendar.current.date(from: DateComponents(year: cursor.year, month: cursor.month, day: 1))
        else { return 0 }
        let sundayFirst = Calendar.current.component(.weekday, from: date) // 1 = Sunday
        return (sundayFirst + 5) % 7
    }
}
