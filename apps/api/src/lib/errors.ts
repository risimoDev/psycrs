/** Base application error with HTTP status code */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}

export class VideoProcessingError extends AppError {
  constructor(message = 'Video processing failed') {
    super(message, 500, true);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token expired', 401);
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super('Token invalid', 401);
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 502, true);
  }
}

export class WebhookError extends AppError {
  constructor(message = 'Webhook processing failed') {
    super(message, 500, true);
  }
}

export class DuplicateWebhookError extends AppError {
  constructor(eventId: string) {
    super(`Webhook already processed: ${eventId}`, 200, true);
  }
}
