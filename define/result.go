package define

// QueryResult is the shared Wails binding response shape.
type QueryResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
