package common

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorInfo  `json:"error,omitempty"`
	Meta    *MetaInfo   `json:"meta,omitempty"`
}

// ErrorInfo represents error details in response
type ErrorInfo struct {
	Code    string `json:"code,omitempty"`
	Message string `json:"message"`
}

// MetaInfo represents pagination and other metadata
type MetaInfo struct {
	Page       int   `json:"page,omitempty"`
	PerPage    int   `json:"per_page,omitempty"`
	Total      int64 `json:"total,omitempty"`
	TotalPages int   `json:"total_pages,omitempty"`
}

// SuccessResponse sends a success response
func SuccessResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

// CreatedResponse sends a created response
func CreatedResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

// NoContentResponse sends a no content response
func NoContentResponse(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// PaginatedResponse sends a paginated response
func PaginatedResponse(c *gin.Context, data interface{}, page, perPage int, total int64) {
	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
		Meta: &MetaInfo{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
		},
	})
}

// ErrorResponse sends an error response
func ErrorResponse(c *gin.Context, err error) {
	var statusCode int
	var message string
	var code string

	if appErr, ok := err.(*AppError); ok {
		statusCode = appErr.Code
		message = appErr.Message
		code = http.StatusText(appErr.Code)
	} else {
		statusCode = http.StatusInternalServerError
		message = "internal server error"
		code = "INTERNAL_ERROR"
	}

	c.JSON(statusCode, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    code,
			Message: message,
		},
	})
}

// BadRequestResponse sends a bad request response
func BadRequestResponse(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "BAD_REQUEST",
			Message: message,
		},
	})
}

// UnauthorizedResponse sends an unauthorized response
func UnauthorizedResponse(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "UNAUTHORIZED",
			Message: message,
		},
	})
}

// ForbiddenResponse sends a forbidden response
func ForbiddenResponse(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "FORBIDDEN",
			Message: message,
		},
	})
}

// NotFoundResponse sends a not found response
func NotFoundResponse(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "NOT_FOUND",
			Message: message,
		},
	})
}

// ConflictResponse sends a conflict response
func ConflictResponse(c *gin.Context, message string) {
	c.JSON(http.StatusConflict, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "CONFLICT",
			Message: message,
		},
	})
}

// TooManyRequestsResponse sends a rate limit response
func TooManyRequestsResponse(c *gin.Context) {
	c.JSON(http.StatusTooManyRequests, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "TOO_MANY_REQUESTS",
			Message: "rate limit exceeded",
		},
	})
}

// ServiceUnavailableResponse sends a service unavailable response
func ServiceUnavailableResponse(c *gin.Context, message string) {
	c.JSON(http.StatusServiceUnavailable, Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    "SERVICE_UNAVAILABLE",
			Message: message,
		},
	})
}
