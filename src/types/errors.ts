export class UnauthorizedError extends Error {
    constructor(message?: string) {
        super(message || 'Unauthorized access');
        this.name = 'UnauthorizedError';
    }
}

export class DuplicateItemError extends Error {
    constructor(message?: string) {
        super(message || 'Duplicate item detected');
        this.name = 'DuplicateItemError';
    }
}