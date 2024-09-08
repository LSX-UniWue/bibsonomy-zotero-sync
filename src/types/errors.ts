export class UnauthorizedError extends Error {
    constructor(message?: string) {
        super(message || 'Unauthorized access');
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message?: string) {
        super(message || 'Forbidden access');
        this.name = 'ForbiddenError';
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

export class ResourceNotFoundError extends Error {
    constructor(message?: string) {
        super(message || 'Resource not found');
        this.name = 'ResourceNotFoundError';
    }
}

export class InvalidModelError extends Error {
    constructor(message?: string) {
        super(message || 'Invalid model');
        this.name = 'InvalidModelError';
    }
}

export class InvalidRangeError extends Error {
    constructor(message?: string) {
        super(message || 'Invalid range');
        this.name = 'InvalidRangeError';
    }
}

export class UnsupportedMediaTypeError extends Error {
    constructor(message?: string) {
        super(message || 'Unsupported media type');
        this.name = 'UnsupportedMediaTypeError';
    }
}

export class BadRequestError extends Error {
    constructor(message?: string) {
        super(message || 'Bad request');
        this.name = 'BadRequestError';
    }
}

export class InternalServerError extends Error {
    constructor(message?: string) {
        super(message || 'Internal server error');
        this.name = 'InternalServerError';
    }
}

export class ServiceUnavailableError extends Error {
    constructor(message?: string) {
        super(message || 'Service unavailable');
        this.name = 'ServiceUnavailableError';
    }
}

export class UnexpectedAPIError extends Error {
    constructor(message?: string) {
        super(message || 'Unexpected API error');
        this.name = 'UnexpectedAPIError';
    }
}

// If there is no network connection the service is, by definition, unavailable
export class NoNetworkError extends ServiceUnavailableError {
    constructor(message?: string) {
        super(message || 'No network');
        this.name = 'NoNetworkError';
    }
}