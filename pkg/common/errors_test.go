package common

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewAppError(t *testing.T) {
	tests := []struct {
		name         string
		errorType    ErrorType
		message      string
		expectedCode int
	}{
		{
			name:         "validation error",
			errorType:    ErrValidation,
			message:      "invalid email format",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "authentication error",
			errorType:    ErrAuthentication,
			message:      "invalid credentials",
			expectedCode: http.StatusUnauthorized,
		},
		{
			name:         "authorization error",
			errorType:    ErrAuthorization,
			message:      "access denied",
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "not found error",
			errorType:    ErrNotFound,
			message:      "resource not found",
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "conflict error",
			errorType:    ErrConflict,
			message:      "resource already exists",
			expectedCode: http.StatusConflict,
		},
		{
			name:         "internal error",
			errorType:    ErrInternal,
			message:      "internal server error",
			expectedCode: http.StatusInternalServerError,
		},
		{
			name:         "rate limit error",
			errorType:    ErrRateLimit,
			message:      "too many requests",
			expectedCode: http.StatusTooManyRequests,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := NewAppError(tt.errorType, tt.message, nil)

			assert.NotNil(t, err)
			assert.Equal(t, tt.errorType, err.Type)
			assert.Equal(t, tt.message, err.Message)
			assert.Equal(t, tt.expectedCode, err.StatusCode())
		})
	}
}

func TestAppErrorWithCause(t *testing.T) {
	cause := errors.New("underlying database error")
	err := NewAppError(ErrInternal, "failed to fetch data", cause)

	assert.NotNil(t, err)
	assert.Equal(t, cause, err.Cause)
	assert.Equal(t, ErrInternal, err.Type)
}

func TestAppErrorError(t *testing.T) {
	err := NewAppError(ErrValidation, "invalid input", nil)
	assert.Equal(t, "invalid input", err.Error())

	errWithCause := NewAppError(ErrInternal, "operation failed", errors.New("cause"))
	assert.Contains(t, errWithCause.Error(), "operation failed")
}

func TestAppErrorUnwrap(t *testing.T) {
	cause := errors.New("root cause")
	err := NewAppError(ErrInternal, "wrapper error", cause)

	unwrapped := errors.Unwrap(err)
	assert.Equal(t, cause, unwrapped)
}

func TestIsAppError(t *testing.T) {
	appErr := NewAppError(ErrValidation, "test error", nil)
	regularErr := errors.New("regular error")

	assert.True(t, IsAppError(appErr))
	assert.False(t, IsAppError(regularErr))
	assert.False(t, IsAppError(nil))
}

func TestWrapError(t *testing.T) {
	originalErr := errors.New("original error")
	wrapped := WrapError(originalErr, ErrInternal, "wrapped message")

	assert.Equal(t, ErrInternal, wrapped.Type)
	assert.Equal(t, "wrapped message", wrapped.Message)
	assert.Equal(t, originalErr, wrapped.Cause)
}

func TestErrorHelpers(t *testing.T) {
	validationErr := ValidationError("field is required")
	assert.Equal(t, ErrValidation, validationErr.Type)
	assert.Equal(t, http.StatusBadRequest, validationErr.StatusCode())

	authErr := AuthenticationError("invalid token")
	assert.Equal(t, ErrAuthentication, authErr.Type)
	assert.Equal(t, http.StatusUnauthorized, authErr.StatusCode())

	notFoundErr := NotFoundError("user not found")
	assert.Equal(t, ErrNotFound, notFoundErr.Type)
	assert.Equal(t, http.StatusNotFound, notFoundErr.StatusCode())

	internalErr := InternalError("unexpected error", nil)
	assert.Equal(t, ErrInternal, internalErr.Type)
	assert.Equal(t, http.StatusInternalServerError, internalErr.StatusCode())
}
