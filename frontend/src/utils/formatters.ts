/**
 * Format a user's name as "Surname Initials" (e.g., "Ivanov I.I.")
 * @param fullName The full name of the user (optional)
 * @param username The username (fallback)
 * @returns Formatted name string
 */
export const formatName = (fullName: string | null | undefined, username: string): string => {
    if (!fullName) return username;

    const parts = fullName.trim().split(/\s+/);

    // Handle "Surname Name Patronymic" (3+ parts) or "Surname Name" (2 parts)
    if (parts.length >= 2) {
        const surname = parts[0];
        const initials = parts.slice(1).map(part => part.charAt(0).toUpperCase() + '.').join('');
        return `${surname} ${initials}`;
    }

    // Handle single word (just return it)
    if (parts.length === 1) {
        return parts[0];
    }

    return username;
};

const rankAbbreviations: Record<string, string> = {
    'рядовой': 'ряд.',
    'ефрейтор': 'ефр.',
    'младший сержант': 'мл. с-т',
    'сержант': 'с-т',
    'старший сержант': 'ст. с-т',
    'старшина': 'ст-на',
    'прапорщик': 'пр-к',
    'старший прапорщик': 'ст. пр-к',
    'младший лейтенант': 'мл. л-т',
    'лейтенант': 'л-т',
    'старший лейтенант': 'ст. л-т',
    'капитан': 'к-н',
    'майор': 'м-р',
    'подполковник': 'п/п-к',
    'полковник': 'п-к',
    'генерал-майор': 'ген. м-р',
    'генерал-лейтенант': 'ген. л-т',
    'генерал-полковник': 'ген. п-к',
    'генерал армии': 'ген. арм.'
};

/**
 * Abbreviate a military rank string
 * @param rank The full rank string
 * @returns Abbreviated rank or original if not found
 */
export const abbreviateRank = (rank: string | null | undefined): string => {
    if (!rank) return '';
    const lowerRank = rank.toLowerCase().trim();
    return rankAbbreviations[lowerRank] || rank;
};
