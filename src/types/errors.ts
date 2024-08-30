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

export class PostNotFoundError extends Error {
    constructor(message?: string) {
        super(message || 'Post not found');
        this.name = 'PostNotFoundError';
    }
}

export class InvalidFormatError extends Error {
    constructor(message?: string) {
        super(message || 'Invalid format');
        this.name = 'InvalidFormatError';
    }
}

export class ConflictResolutionError extends Error {
    constructor(message?: string) {
        super(message || 'Conflict resolution needed');
        this.name = 'ConflictResolutionError';
    }
}

export class InvalidBibTexError extends Error {
    constructor(message?: string) {
        super(message || 'Invalid BibTex');
        this.name = 'InvalidBibTexError';
    }
}