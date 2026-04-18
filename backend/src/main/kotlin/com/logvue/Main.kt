package com.logvue

import com.logvue.data.parser.AutoDetectParser
import com.logvue.plugins.configureRouting
import com.logvue.service.LogService
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.callloging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import java.io.File

private const val PID_FILE = ".logvue.pid"
private const val DEFAULT_PORT = 8080

fun main(args: Array<String>) {
    val port = args.indexOfFirst { it == "-p" || it == "--port" }
        .takeIf { it >= 0 }
        ?.let { args.getOrNull(it + 1)?.toIntOrNull() }
        ?: DEFAULT_PORT

    when (args.firstOrNull()) {
        "start" -> startServer(port)
        "stop" -> stopServer()
        "status" -> statusServer()
        else -> {
            println("Usage: logvue <start|stop|status> [-p|--port <port>]")
            println("  start   - Start the LogVue server")
            println("  stop    - Stop the running LogVue server")
            println("  status  - Check if server is running")
            println("  -p, --port <port>  - Specify port (default: 8080)")
        }
    }
}

private fun startServer(port: Int) {
    val pidFile = File(PID_FILE)
    if (pidFile.exists()) {
        val oldPid = pidFile.readText().trim()
        if (isProcessRunning(oldPid.toLongOrNull())) {
            println("LogVue is already running (PID: $oldPid)")
            return
        }
        pidFile.delete()
    }

    val pid = ProcessHandle.current().pid()
    pidFile.writeText(pid.toString())
    println("Starting LogVue (PID: $pid)...")

    val logParser = AutoDetectParser()
    val logService = LogService(logParser)

    embeddedServer(Netty, port = port, host = "0.0.0.0") {
        module(logService)
    }.start(wait = true)
}

private fun stopServer() {
    val pidFile = File(PID_FILE)
    if (!pidFile.exists()) {
        println("LogVue is not running (no PID file)")
        return
    }

    val pid = pidFile.readText().trim().toLongOrNull()
    if (pid == null || !isProcessRunning(pid)) {
        println("LogVue is not running")
        pidFile.delete()
        return
    }

    println("Stopping LogVue (PID: $pid)...")
    ProcessHandle.of(pid).ifPresent { it.destroy() }
    pidFile.delete()
    println("LogVue stopped")
}

private fun statusServer() {
    val pidFile = File(PID_FILE)
    if (!pidFile.exists()) {
        println("LogVue is not running (no PID file)")
        return
    }

    val pid = pidFile.readText().trim().toLongOrNull()
    if (pid == null || !isProcessRunning(pid)) {
        println("LogVue is not running (stale PID file)")
        pidFile.delete()
        return
    }

    println("LogVue is running (PID: $pid)")
}

private fun isProcessRunning(pid: Long?): Boolean {
    if (pid == null) return false
    return ProcessHandle.of(pid).map { it.isAlive }.orElse(false)
}

fun Application.module(logService: LogService) {
    install(CORS) {
        anyHost()
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Options)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Accept)
        allowHeader(HttpHeaders.Origin)
        allowCredentials = true
        allowNonSimpleContentTypes = true
    }

    install(ContentNegotiation) {
        json(
            Json {
                prettyPrint = true
                isLenient = true
                ignoreUnknownKeys = true
                coerceInputValues = true
            }
        )
    }

    install(CallLogging)

    // Serve static files from classpath (works from JAR and filesystem)
    routing {
        staticResources("/", "files")
    }

    configureRouting(logService)
}
