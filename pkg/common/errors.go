package common

import (
	"errors"
	"net/http"
)

// AppError represents an application error with HTTP status code
type AppError struct {
	Code       int    `json:"-"`
	Message    string `json:"message"`
	InternalError error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.InternalError != nil {
		return e.InternalError.Error()
	}
	return e.Message
}

// Unwrap returns the internal error
func (e *AppError) Unwrap() error {
	return e.InternalError
}

// Common errors
var (
	ErrNotFound           = &AppError{Code: http.StatusNotFound, Message: "resource not found"}
	ErrUnauthorized       = &AppError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbidden          = &AppError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrBadRequest         = &AppError{Code: http.StatusBadRequest, Message: "bad request"}
	ErrInternalServer     = &AppError{Code: http.StatusInternalServerError, Message: "internal server error"}
	ErrConflict           = &AppError{Code: http.StatusConflict, Message: "resource already exists"}
	ErrTooManyRequests    = &AppError{Code: http.StatusTooManyRequests, Message: "too many requests"}
	ErrServiceUnavailable = &AppError{Code: http.StatusServiceUnavailable, Message: "service unavailable"}
)

// NewBadRequestError creates a new bad request error
func NewBadRequestError(message string) *AppError {
	return &AppError{
		Code:    http.StatusBadRequest,
		Message: message,
	}
}

// NewNotFoundError creates a new not found error
func NewNotFoundError(message string) *AppError {
	return &AppError{
		Code:    http.StatusNotFound,
		Message: message,
	}
}

// NewUnauthorizedError creates a new unauthorized error
func NewUnauthorizedError(message string) *AppError {
	return &AppError{
		Code:    http.StatusUnauthorized,
		Message: message,
	}
}

// NewForbiddenError creates a new forbidden error
func NewForbiddenError(message string) *AppError {
	return &AppError{
		Code:    http.StatusForbidden,
		Message: message,
	}
}

// NewConflictError creates a new conflict error
func NewConflictError(message string) *AppError {
	return &AppError{
		Code:    http.StatusConflict,
		Message: message,
	}
}

// NewInternalServerError creates a new internal server error
func NewInternalServerError(message string, err error) *AppError {
	return &AppError{
		Code:          http.StatusInternalServerError,
		Message:       message,
		InternalError: err,
	}
}

// WrapError wraps an error with application error
func WrapError(err error, message string) *AppError {
	if err == nil {
		return nil
	}

	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}

	return &AppError{
		Code:          http.StatusInternalServerError,
		Message:       message,
		InternalError: err,
	}
}

// IsNotFoundError checks if error is not found error
func IsNotFoundError(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code == http.StatusNotFound
	}
	return false
}

// IsUnauthorizedError checks if error is unauthorized error
func IsUnauthorizedError(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code == http.StatusUnauthorized
	}
	return false
}
