package common

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAppError(t *testing.T) {
	err := &AppError{
		Code:    http.StatusBadRequest,
		Message: "validation failed",
	}

	assert.Equal(t, http.StatusBadRequest, err.Code)
	assert.Equal(t, "validation failed", err.Message)
	assert.Equal(t, "validation failed", err.Error())
}

func TestAppErrorWithInternalError(t *testing.T) {
	internalErr := errors.New("database connection failed")
	err := &AppError{
		Code:          http.StatusInternalServerError,
		Message:       "internal error",
		InternalError: internalErr,
	}

	assert.Equal(t, "database connection failed", err.Error())
	assert.Equal(t, internalErr, errors.Unwrap(err))
}

func TestNewBadRequestError(t *testing.T) {
	err := NewBadRequestError("invalid email format")
	assert.Equal(t, http.StatusBadRequest, err.Code)
	assert.Equal(t, "invalid email format", err.Message)
}

func TestNewNotFoundError(t *testing.T) {
	err := NewNotFoundError("user not found")
	assert.Equal(t, http.StatusNotFound, err.Code)
	assert.Equal(t, "user not found", err.Message)
}

func TestNewUnauthorizedError(t *testing.T) {
	err := NewUnauthorizedError("invalid token")
	assert.Equal(t, http.StatusUnauthorized, err.Code)
	assert.Equal(t, "invalid token", err.Message)
}

func TestNewForbiddenError(t *testing.T) {
	err := NewForbiddenError("access denied")
	assert.Equal(t, http.StatusForbidden, err.Code)
	assert.Equal(t, "access denied", err.Message)
}

func TestNewConflictError(t *testing.T) {
	err := NewConflictError("email already exists")
	assert.Equal(t, http.StatusConflict, err.Code)
	assert.Equal(t, "email already exists", err.Message)
}

func TestNewInternalServerError(t *testing.T) {
	cause := errors.New("db error")
	err := NewInternalServerError("database error", cause)
	assert.Equal(t, http.StatusInternalServerError, err.Code)
	assert.Equal(t, "database error", err.Message)
	assert.Equal(t, cause, err.InternalError)
}

func TestWrapError(t *testing.T) {
	// Test with nil error
	assert.Nil(t, WrapError(nil, "should not wrap"))

	// Test with regular error
	regularErr := errors.New("some error")
	wrapped := WrapError(regularErr, "wrapped message")
	assert.Equal(t, http.StatusInternalServerError, wrapped.Code)
	assert.Equal(t, "wrapped message", wrapped.Message)
	assert.Equal(t, regularErr, wrapped.InternalError)

	// Test with AppError - should return same error
	appErr := NewBadRequestError("original")
	wrappedApp := WrapError(appErr, "should not change")
	assert.Equal(t, appErr, wrappedApp)
}

func TestIsNotFoundError(t *testing.T) {
	notFoundErr := NewNotFoundError("not found")
	otherErr := NewBadRequestError("bad request")
	regularErr := errors.New("regular error")

	assert.True(t, IsNotFoundError(notFoundErr))
	assert.False(t, IsNotFoundError(otherErr))
	assert.False(t, IsNotFoundError(regularErr))
}

func TestIsUnauthorizedError(t *testing.T) {
	unauthErr := NewUnauthorizedError("unauthorized")
	otherErr := NewBadRequestError("bad request")
	regularErr := errors.New("regular error")

	assert.True(t, IsUnauthorizedError(unauthErr))
	assert.False(t, IsUnauthorizedError(otherErr))
	assert.False(t, IsUnauthorizedError(regularErr))
}

func TestCommonErrors(t *testing.T) {
	assert.Equal(t, http.StatusNotFound, ErrNotFound.Code)
	assert.Equal(t, http.StatusUnauthorized, ErrUnauthorized.Code)
	assert.Equal(t, http.StatusForbidden, ErrForbidden.Code)
	assert.Equal(t, http.StatusBadRequest, ErrBadRequest.Code)
	assert.Equal(t, http.StatusInternalServerError, ErrInternalServer.Code)
	assert.Equal(t, http.StatusConflict, ErrConflict.Code)
	assert.Equal(t, http.StatusTooManyRequests, ErrTooManyRequests.Code)
	assert.Equal(t, http.StatusServiceUnavailable, ErrServiceUnavailable.Code)
}
