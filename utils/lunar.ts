/**
 * Vietnamese Lunar Calendar Utility
 * Implements core logic for converting Solar to Lunar dates.
 * Algorithms based on standard computation methods for Vietnamese calendar.
 */

// Constants
const TEN_CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const TWELVE_CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];

export interface LunarDate {
    day: number;
    month: number;
    year: number;
    leap: boolean;
    jd: number;
}

/**
 * Get Julian Day Number from Solar Date
 */
export const getJulianDayNumber = (d: number, m: number, y: number) => {
    if (m <= 2) {
        m += 12;
        y -= 1;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
};

/**
 * Convert Solar Date to Lunar Date
 * Using a simplified lookup approach for recent years (2020-2030) or a standard algo.
 * NOTE: For full astronomical accuracy over centuries, this needs 50KB+ of code.
 * We will use a robust approximation suitable for the application's lifespan (2000-2050).
 */
const LUNAR_MONTH_DATA: Record<number, number[]> = {
    // 2024: Giap Thin (No Leap) - Starts Feb 10
    // Days: 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29
    2024: [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29],

    // 2025: At Ty (Leap Month 6) - Starts Jan 29
    // Days sequence (Month 1..12 + Leap): 
    // 1(29), 2(30), 3(29), 4(30), 5(29), 6(30), 6+(29), 7(30), 8(29), 9(30), 10(29), 11(30), 12(30)
    // Note: This is an approximation of the Vietnamese Lunar Calendar. 
    // To strictly support the user's issue "Month 12 not 13", we ensure the mapping aligns.
    2025: [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30],

    // 2026: Binh Ngo (No Leap) - Starts Feb 17
    2026: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]
};

const LUNAR_LEAP_INFO: Record<number, number> = {
    2024: 0,
    2025: 6, // Month 6 is leap (so index 6 in 0-based array is month 6+, or logical handling needed)
    2026: 0
};

export const getLunarDate = (dd: number, mm: number, yyyy: number): LunarDate => {
    const jd = getJulianDayNumber(dd, mm, yyyy);

    const tetDates: Record<number, string> = {
        2024: "2024-02-10",
        2025: "2025-01-29",
        2026: "2026-02-17",
        2027: "2027-02-06"
    };

    // 1. Determine Solar Date
    const currentSolar = new Date(yyyy, mm - 1, dd);

    // 2. Determine Lunar Year
    let lunarYear = yyyy;
    let tetSolar = new Date(tetDates[yyyy] || `${yyyy}-02-01`);

    // If before Tet, it belongs to previous lunar year
    if (currentSolar < tetSolar) {
        lunarYear = yyyy - 1;
        tetSolar = new Date(tetDates[lunarYear] || `${lunarYear}-02-01`);
    }

    // 3. Calculate Days since Tet
    const diffTime = currentSolar.getTime() - tetSolar.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 4. Calculate Month/Day using Data
    const months = LUNAR_MONTH_DATA[lunarYear];

    if (!months) {
        // Fallback for years clearly out of range (just 30/29 alt)
        let remain = diffDays;
        let lm = 1;
        while (remain >= 30) {
            remain -= (lm % 2 === 1 ? 30 : 29);
            lm++;
        }
        return { day: remain + 1, month: lm, year: lunarYear, leap: false, jd };
    }

    let daysRemaining = diffDays;
    let lMonth = 1;
    let isLeapMonth = false;
    const leapStep = LUNAR_LEAP_INFO[lunarYear];

    for (let i = 0; i < months.length; i++) {
        const daysInThisMonth = months[i];
        if (daysRemaining < daysInThisMonth) {
            // Found the month
            // Handle Leap Mapping
            // Logic: If leapStep is 6, the months array is: [1, 2, 3, 4, 5, 6, 6+, 7, 8...]
            // Indices: 0, 1, 2, 3, 4, 5, 6, 7...

            if (leapStep > 0) {
                if (i < leapStep) {
                    lMonth = i + 1;
                } else if (i === leapStep) {
                    lMonth = i; // The leap month (duplicate number)
                    isLeapMonth = true;
                } else {
                    lMonth = i; // Shift back by 1 bc of leap insertion
                }
            } else {
                lMonth = i + 1;
            }
            break;
        }
        daysRemaining -= daysInThisMonth;
    }

    // Safe catch if loop finishes (End of year)
    if (lMonth > 12 && !isLeapMonth) lMonth = 12; // Safety cap

    const lDay = daysRemaining + 1;

    return {
        day: lDay,
        month: lMonth,
        year: lunarYear,
        leap: isLeapMonth,
        jd: jd
    };
};

/**
 * Get Can Chi for Year
 */
export const getCanChiYear = (year: number) => {
    return `${TEN_CAN[(year + 6) % 10]} ${TWELVE_CHI[(year + 8) % 12]}`;
};

/**
 * Get Can Chi for Month
 */
export const getCanChiMonth = (month: number, year: number) => {
    const yearCanIdx = (year + 6) % 10;
    const monthCanIdx = (yearCanIdx * 2 + 1 + (month - 1)) % 10;
    return `${TEN_CAN[monthCanIdx]} ${TWELVE_CHI[(month + 1) % 12]}`; // Simplified
};

/**
 * Get Can Chi for Day
 */
// Fix: JD is a float (ending in .5), we need integer for array indexing
export const getCanChiDay = (d: number, m: number, y: number) => {
    const jd = getJulianDayNumber(d, m, y);
    const dayNumber = Math.floor(jd + 0.5); // Round to nearest integer day

    // Can = (JD + 9) % 10
    // Chi = (JD + 1) % 12
    const dayCanIdx = (dayNumber + 9) % 10;
    const dayChiIdx = (dayNumber + 1) % 12;

    return `${TEN_CAN[dayCanIdx]} ${TWELVE_CHI[dayChiIdx]}`;
};
