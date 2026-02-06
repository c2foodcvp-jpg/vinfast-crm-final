/**
 * Removes Vietnamese accents from a string for search purposes.
 * Example: 'Nguyễn Văn A' -> 'Nguyen Van A'
 */
export const removeAccents = (str: string): string => {
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};
