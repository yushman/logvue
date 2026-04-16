.PHONY: build run stop status logs install

APP_NAME=logvue
JAR_DIR=backend/build/libs
JAR_FILE=$(shell ls $(JAR_DIR)/backend-0.1.0-all.jar 2>/dev/null || ls $(JAR_DIR)/backend-all.jar 2>/dev/null | head -1)
PORT=8080
LOG_DIR=/var/log/$(APP_NAME)

build:
	cd frontend && npm run build
	cd backend && ../gradlew :backend:shadowJar

run:
	@if [ -z "$(JAR_FILE)" ]; then \
		echo "JAR not found. Run 'make build' first."; \
		exit 1; \
	fi
	sudo systemd start $(APP_NAME)
	sudo systemctl status $(APP_NAME)

stop:
	sudo systemd stop $(APP_NAME)

status:
	sudo systemctl status $(APP_NAME)

logs:
	sudo journalctl -u $(APP_NAME) -f

install:
	@if [ -z "$(JAR_FILE)" ]; then \
		echo "JAR not found. Run 'make build' first."; \
		exit 1; \
	fi
	@echo "Installing systemd service..."
	@sudo cp deploy/$(APP_NAME).service /etc/systemd/system/
	@sudo systemctl daemon-reload
	@sudo systemctl enable $(APP_NAME)
	@echo "Run 'make run' to start."