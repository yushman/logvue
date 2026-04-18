.PHONY: build run stop status

APP_NAME=logvue
GO_DIR=backend-go
PORT=8080

build:
	cd frontend && npm run build
	cd $(GO_DIR) && go build -o $(APP_NAME) .

run:
	cd $(GO_DIR) && ./$(APP_NAME) start -p $(PORT)

stop:
	cd $(GO_DIR) && ./$(APP_NAME) stop

status:
	cd $(GO_DIR) && ./$(APP_NAME) status
