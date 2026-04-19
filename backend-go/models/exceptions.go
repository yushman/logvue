package models

import "fmt"

// FileTooLargeException is thrown when file exceeds max size
type FileTooLargeException struct {
	ActualSize int64
	MaxSize    int64
}

func (e *FileTooLargeException) Error() string {
	return fmt.Sprintf("File size %d bytes exceeds maximum allowed size of %d bytes", e.ActualSize, e.MaxSize)
}

// MalformedJsonException is thrown when JSON is malformed
type MalformedJsonException struct {
	Message string
}

func (e *MalformedJsonException) Error() string {
	return e.Message
}
